-- ============================================================
-- UNO Online — Matchmaking: salas públicas/privadas
-- ============================================================

-- Agregar columnas a rooms
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS is_private   BOOLEAN   DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS password_hash TEXT      DEFAULT NULL;

-- Índice para búsqueda rápida de salas públicas disponibles
CREATE INDEX IF NOT EXISTS idx_rooms_matchmaking
  ON rooms (status, is_private)
  WHERE status = 'waiting' AND is_private = false;

-- ============================================================
-- Actualizar create_room para aceptar is_private y password
-- ============================================================
CREATE OR REPLACE FUNCTION create_room(
  player_name TEXT,
  p_is_private BOOLEAN DEFAULT false,
  p_password   TEXT    DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room_id   UUID;
  v_code      CHAR(6);
  v_player_id UUID;
  v_pw_hash   TEXT;
BEGIN
  -- Generar código único de 6 chars
  LOOP
    v_code := upper(substring(md5(random()::text) FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM rooms WHERE code = v_code);
  END LOOP;

  -- Hash de contraseña si se provee
  IF p_password IS NOT NULL AND p_password <> '' THEN
    v_pw_hash := crypt(p_password, gen_salt('bf', 8));
  ELSE
    v_pw_hash := NULL;
  END IF;

  -- Crear sala
  INSERT INTO rooms (code, status, is_private, password_hash)
  VALUES (v_code, 'waiting', p_is_private, v_pw_hash)
  RETURNING id INTO v_room_id;

  -- Crear jugador host (seat 0)
  INSERT INTO players (room_id, user_id, name, seat_order)
  VALUES (v_room_id, auth.uid(), player_name, 0)
  RETURNING id INTO v_player_id;

  -- Asignar host
  UPDATE rooms SET host_id = v_player_id WHERE id = v_room_id;

  RETURN json_build_object(
    'room_id',   v_room_id,
    'room_code', v_code,
    'player_id', v_player_id
  );
END;
$$;

-- ============================================================
-- Actualizar join_room para verificar contraseña
-- ============================================================
CREATE OR REPLACE FUNCTION join_room(
  p_code      TEXT,
  player_name TEXT,
  p_password  TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room       rooms%ROWTYPE;
  v_seat       SMALLINT;
  v_player_id  UUID;
  v_count      INT;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE code = upper(p_code);
  IF NOT FOUND THEN RAISE EXCEPTION 'Sala no encontrada'; END IF;
  IF v_room.status <> 'waiting' THEN RAISE EXCEPTION 'La partida ya inició'; END IF;

  -- Verificar contraseña si la sala es privada con password
  IF v_room.password_hash IS NOT NULL THEN
    IF p_password IS NULL OR p_password = '' THEN
      RAISE EXCEPTION 'Esta sala requiere contraseña';
    END IF;
    IF v_room.password_hash <> crypt(p_password, v_room.password_hash) THEN
      RAISE EXCEPTION 'Contraseña incorrecta';
    END IF;
  END IF;

  SELECT COUNT(*) INTO v_count FROM players WHERE room_id = v_room.id;
  IF v_count >= v_room.max_players THEN RAISE EXCEPTION 'Sala llena'; END IF;

  -- Asignar siguiente seat libre
  SELECT COALESCE(MAX(seat_order), -1) + 1 INTO v_seat FROM players WHERE room_id = v_room.id;

  INSERT INTO players (room_id, user_id, name, seat_order)
  VALUES (v_room.id, auth.uid(), player_name, v_seat)
  RETURNING id INTO v_player_id;

  RETURN json_build_object(
    'room_id',   v_room.id,
    'room_code', v_room.code,
    'player_id', v_player_id
  );
END;
$$;

-- ============================================================
-- find_public_room — buscar sala pública disponible
-- ============================================================
CREATE OR REPLACE FUNCTION find_public_room(player_name TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room       rooms%ROWTYPE;
  v_seat       SMALLINT;
  v_player_id  UUID;
  v_count      INT;
BEGIN
  -- Buscar sala pública con espacio disponible (más jugadores primero = más activa)
  SELECT r.* INTO v_room
  FROM rooms r
  WHERE r.status = 'waiting'
    AND r.is_private = false
    AND r.password_hash IS NULL
    AND (SELECT COUNT(*) FROM players p WHERE p.room_id = r.id) < r.max_players
  ORDER BY (SELECT COUNT(*) FROM players p WHERE p.room_id = r.id) DESC,
           r.created_at DESC
  LIMIT 1;

  -- Si no hay sala disponible, crear una nueva pública
  IF NOT FOUND THEN
    RETURN create_room(player_name, false, NULL);
  END IF;

  SELECT COUNT(*) INTO v_count FROM players WHERE room_id = v_room.id;
  SELECT COALESCE(MAX(seat_order), -1) + 1 INTO v_seat FROM players WHERE room_id = v_room.id;

  INSERT INTO players (room_id, user_id, name, seat_order)
  VALUES (v_room.id, auth.uid(), player_name, v_seat)
  RETURNING id INTO v_player_id;

  RETURN json_build_object(
    'room_id',   v_room.id,
    'room_code', v_room.code,
    'player_id', v_player_id,
    'matched',   true
  );
END;
$$;

-- Habilitar extensión pgcrypto para crypt() si no existe
CREATE EXTENSION IF NOT EXISTS pgcrypto;
