-- ============================================================
-- UNO Online — Edge Functions / RPC helpers
-- Estas funciones corren con SECURITY DEFINER (service_role)
-- para poder escribir en tablas que los clientes no pueden tocar
-- ============================================================

-- ============================================================
-- generate_room_code() — genera código de 6 chars único
-- ============================================================
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS CHAR(6)
LANGUAGE plpgsql
AS $$
DECLARE
  chars  TEXT    := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- sin O,0,I,1 para evitar confusión
  code   CHAR(6) := '';
  i      INT;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::INT, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM rooms WHERE rooms.code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- ============================================================
-- create_room(player_name) — crea sala + jugador host atómicamente
-- Retorna: room_id, room_code, player_id
-- ============================================================
CREATE OR REPLACE FUNCTION create_room(player_name VARCHAR(30))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room_id    UUID;
  v_code       CHAR(6);
  v_player_id  UUID;
BEGIN
  -- 1. Crear sala
  v_code := generate_room_code();
  INSERT INTO rooms (code, status)
  VALUES (v_code, 'waiting')
  RETURNING id INTO v_room_id;

  -- 2. Crear jugador host (seat_order = 0)
  INSERT INTO players (room_id, user_id, name, seat_order, is_connected)
  VALUES (v_room_id, auth.uid(), player_name, 0, true)
  RETURNING id INTO v_player_id;

  -- 3. Asignar host a la sala
  UPDATE rooms SET host_id = v_player_id WHERE id = v_room_id;

  -- 4. Crear game_state vacío
  INSERT INTO game_state (room_id, status) VALUES (v_room_id, 'waiting');

  -- 5. Registrar evento
  INSERT INTO events (room_id, player_id, type, payload)
  VALUES (v_room_id, v_player_id, 'room_created', json_build_object('room_code', v_code));

  RETURN json_build_object(
    'room_id',   v_room_id,
    'room_code', v_code,
    'player_id', v_player_id
  );
END;
$$;

-- ============================================================
-- join_room(room_code, player_name) — unirse a una sala
-- Retorna: room_id, player_id, seat_order
-- ============================================================
CREATE OR REPLACE FUNCTION join_room(p_code CHAR(6), player_name VARCHAR(30))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room_id    UUID;
  v_player_id  UUID;
  v_seat       SMALLINT;
  v_count      SMALLINT;
  v_max        SMALLINT;
BEGIN
  -- Buscar sala
  SELECT id, max_players INTO v_room_id, v_max
  FROM rooms WHERE code = upper(p_code) AND status = 'waiting';

  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'Sala no encontrada o ya comenzó la partida';
  END IF;

  -- Verificar que no esté llena
  SELECT count(*) INTO v_count FROM players WHERE room_id = v_room_id;
  IF v_count >= v_max THEN
    RAISE EXCEPTION 'La sala está llena';
  END IF;

  -- Verificar que el user no esté ya en la sala
  IF EXISTS (SELECT 1 FROM players WHERE room_id = v_room_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Ya estás en esta sala';
  END IF;

  -- Asignar el próximo seat libre
  SELECT COALESCE(max(seat_order) + 1, 0) INTO v_seat
  FROM players WHERE room_id = v_room_id;

  INSERT INTO players (room_id, user_id, name, seat_order, is_connected)
  VALUES (v_room_id, auth.uid(), player_name, v_seat, true)
  RETURNING id INTO v_player_id;

  INSERT INTO events (room_id, player_id, type, payload)
  VALUES (v_room_id, v_player_id, 'player_joined', json_build_object('name', player_name, 'seat', v_seat));

  RETURN json_build_object(
    'room_id',    v_room_id,
    'player_id',  v_player_id,
    'seat_order', v_seat
  );
END;
$$;

-- ============================================================
-- heartbeat(player_id) — mantener presencia del jugador
-- ============================================================
CREATE OR REPLACE FUNCTION heartbeat(p_player_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE players
  SET is_connected = true, last_heartbeat = now()
  WHERE id = p_player_id AND user_id = auth.uid();
END;
$$;

-- ============================================================
-- mark_disconnected() — cron job o llamada periódica
-- Marca como desconectados a jugadores sin heartbeat >15s
-- ============================================================
CREATE OR REPLACE FUNCTION mark_disconnected()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE players
  SET is_connected = false
  WHERE is_connected = true
  AND last_heartbeat < now() - INTERVAL '15 seconds';
END;
$$;

-- ============================================================
-- reconnect_player(room_code, player_name) — reconectar
-- ============================================================
CREATE OR REPLACE FUNCTION reconnect_player(p_code CHAR(6))
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player players%ROWTYPE;
BEGIN
  SELECT p.* INTO v_player
  FROM players p
  JOIN rooms r ON r.id = p.room_id
  WHERE r.code = upper(p_code)
  AND p.user_id = auth.uid();

  IF v_player.id IS NULL THEN
    RAISE EXCEPTION 'No se encontró tu sesión en esta sala';
  END IF;

  UPDATE players
  SET is_connected = true, last_heartbeat = now()
  WHERE id = v_player.id;

  INSERT INTO events (room_id, player_id, type)
  VALUES (v_player.room_id, v_player.id, 'player_reconnected');

  RETURN json_build_object(
    'player_id',  v_player.id,
    'room_id',    v_player.room_id,
    'seat_order', v_player.seat_order,
    'name',       v_player.name
  );
END;
$$;
