-- ============================================================
-- Fix: create_room en 007_matchmaking.sql omitió el INSERT
-- en game_state, causando que start-game fallara silenciosamente
-- (UPDATE sin filas que actualizar, sin error retornado)
-- ============================================================

-- Backfill: crear game_state para rooms que no tienen una
INSERT INTO game_state (room_id, status)
SELECT r.id, r.status
FROM rooms r
WHERE NOT EXISTS (
  SELECT 1 FROM game_state gs WHERE gs.room_id = r.id
);

-- Corregir create_room para incluir el INSERT en game_state
CREATE OR REPLACE FUNCTION create_room(
  player_name  TEXT,
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

  -- Crear game_state vacío (corregido: faltaba en 007)
  INSERT INTO game_state (room_id, status) VALUES (v_room_id, 'waiting');

  RETURN json_build_object(
    'room_id',   v_room_id,
    'room_code', v_code,
    'player_id', v_player_id
  );
END;
$$;
