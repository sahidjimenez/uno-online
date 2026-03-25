-- ============================================================
-- UNO Online — Schema inicial
-- Supabase / PostgreSQL
-- ============================================================

-- Tipos enumerados
CREATE TYPE room_status     AS ENUM ('waiting', 'playing', 'finished');
CREATE TYPE card_color      AS ENUM ('red', 'blue', 'green', 'yellow', 'wild');
CREATE TYPE card_type       AS ENUM ('0','1','2','3','4','5','6','7','8','9','skip','reverse','draw2','wild','wild4');
CREATE TYPE event_type      AS ENUM (
  'room_created', 'player_joined', 'player_left', 'game_started',
  'card_played', 'card_drawn', 'uno_called',
  'skip_applied', 'reverse_applied', 'draw_stack_added', 'draw_stack_resolved',
  'color_chosen', 'turn_changed', 'game_finished', 'player_reconnected'
);

-- ============================================================
-- rooms — sala de juego
-- ============================================================
CREATE TABLE rooms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          CHAR(6)       UNIQUE NOT NULL,       -- código de sala (ej: "A7F3K2")
  status        room_status   DEFAULT 'waiting',
  host_id       UUID,                                 -- se actualiza después de crear players
  max_players   SMALLINT      DEFAULT 8 CHECK (max_players BETWEEN 2 AND 8),
  created_at    TIMESTAMPTZ   DEFAULT now(),
  updated_at    TIMESTAMPTZ   DEFAULT now()
);

-- ============================================================
-- players — jugadores en una sala
-- ============================================================
CREATE TABLE players (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         UUID          NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id         UUID          NOT NULL,             -- auth.uid() de Supabase Auth (anónimo)
  name            VARCHAR(30)   NOT NULL,
  seat_order      SMALLINT      NOT NULL,             -- posición en la mesa (0-7)
  is_connected    BOOLEAN       DEFAULT true,
  last_heartbeat  TIMESTAMPTZ   DEFAULT now(),
  has_called_uno  BOOLEAN       DEFAULT false,
  created_at      TIMESTAMPTZ   DEFAULT now(),
  UNIQUE (room_id, seat_order),
  UNIQUE (room_id, user_id)
);

-- FK diferida para evitar dependencia circular rooms ↔ players
ALTER TABLE rooms
  ADD CONSTRAINT fk_rooms_host
  FOREIGN KEY (host_id) REFERENCES players(id)
  DEFERRABLE INITIALLY DEFERRED;

-- ============================================================
-- hands — cartas privadas de cada jugador (RLS estricto)
-- ============================================================
CREATE TABLE hands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID         NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id   UUID         NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  card_color  card_color   NOT NULL,
  card_type   card_type    NOT NULL,
  created_at  TIMESTAMPTZ  DEFAULT now()
);

-- ============================================================
-- game_state — estado actual de la partida con versioning
-- ============================================================
CREATE TABLE game_state (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID          UNIQUE NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  version             INTEGER       DEFAULT 0,         -- optimistic locking
  status              room_status   DEFAULT 'waiting',
  current_player_id   UUID          REFERENCES players(id),
  direction           SMALLINT      DEFAULT 1          -- 1 = horario, -1 = antihorario
                      CHECK (direction IN (1, -1)),
  current_color       card_color,                      -- color activo (importa en Wild)
  top_card_color      card_color,                      -- color de la carta visible
  top_card_type       card_type,                       -- tipo de la carta visible
  draw_stack          SMALLINT      DEFAULT 0,         -- penalidad acumulada (+2/+4)
  draw_pile_count     SMALLINT      DEFAULT 0,         -- cartas restantes en el mazo
  winner_id           UUID          REFERENCES players(id),
  updated_at          TIMESTAMPTZ   DEFAULT now()
);

-- ============================================================
-- events — log inmutable de acciones del juego
-- ============================================================
CREATE TABLE events (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID         NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id   UUID         REFERENCES players(id),
  type        event_type   NOT NULL,
  payload     JSONB        DEFAULT '{}',    -- datos del evento (carta jugada, color elegido, etc.)
  version     INTEGER,                      -- versión del game_state en el momento del evento
  created_at  TIMESTAMPTZ  DEFAULT now()
);

-- ============================================================
-- Índices de rendimiento
-- ============================================================
CREATE INDEX idx_players_room        ON players(room_id);
CREATE INDEX idx_players_user        ON players(user_id);
CREATE INDEX idx_hands_player        ON hands(player_id);
CREATE INDEX idx_hands_room          ON hands(room_id);
CREATE INDEX idx_events_room         ON events(room_id);
CREATE INDEX idx_events_room_version ON events(room_id, version);
CREATE INDEX idx_game_state_room     ON game_state(room_id);
-- ============================================================
-- UNO Online — Row Level Security (RLS)
-- ============================================================

-- Activar RLS en todas las tablas
ALTER TABLE rooms       ENABLE ROW LEVEL SECURITY;
ALTER TABLE players     ENABLE ROW LEVEL SECURITY;
ALTER TABLE hands       ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_state  ENABLE ROW LEVEL SECURITY;
ALTER TABLE events      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ROOMS
-- ============================================================

-- Cualquiera puede leer salas (para buscar por código)
CREATE POLICY "rooms_select_all"
  ON rooms FOR SELECT
  USING (true);

-- Solo usuarios autenticados pueden crear salas
CREATE POLICY "rooms_insert_authenticated"
  ON rooms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Solo el host puede actualizar la sala
CREATE POLICY "rooms_update_host"
  ON rooms FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = rooms.host_id
      AND players.user_id = auth.uid()
    )
  );

-- ============================================================
-- PLAYERS
-- ============================================================

-- Todos los jugadores de una sala pueden verse entre sí
-- (necesario para mostrar avatares, conteo de cartas, turnos)
CREATE POLICY "players_select_same_room"
  ON players FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players AS me
      WHERE me.room_id = players.room_id
      AND me.user_id = auth.uid()
    )
  );

-- Un usuario solo puede insertarse a sí mismo
CREATE POLICY "players_insert_self"
  ON players FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Solo el propio jugador puede actualizarse (heartbeat, UNO, reconexión)
CREATE POLICY "players_update_self"
  ON players FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================
-- HANDS — la más crítica: solo el dueño ve sus cartas
-- ============================================================

-- Un jugador solo puede leer SUS propias cartas
CREATE POLICY "hands_select_owner"
  ON hands FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id = hands.player_id
      AND players.user_id = auth.uid()
    )
  );

-- Solo se insertan cartas via funciones de servidor (service_role)
-- Los clientes no insertan cartas directamente
CREATE POLICY "hands_insert_service"
  ON hands FOR INSERT
  WITH CHECK (false);  -- bloqueado para clientes; solo service_role puede insertar

-- Solo se eliminan cartas via funciones de servidor
CREATE POLICY "hands_delete_service"
  ON hands FOR DELETE
  USING (false);  -- bloqueado para clientes

-- ============================================================
-- GAME_STATE
-- ============================================================

-- Todos los jugadores de la sala pueden leer el estado
CREATE POLICY "game_state_select_players"
  ON game_state FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.room_id = game_state.room_id
      AND players.user_id = auth.uid()
    )
  );

-- Solo service_role puede escribir (las Edge Functions manejan esto)
CREATE POLICY "game_state_insert_service"
  ON game_state FOR INSERT
  WITH CHECK (false);

CREATE POLICY "game_state_update_service"
  ON game_state FOR UPDATE
  USING (false);

-- ============================================================
-- EVENTS
-- ============================================================

-- Todos los jugadores de la sala pueden leer los eventos
CREATE POLICY "events_select_players"
  ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.room_id = events.room_id
      AND players.user_id = auth.uid()
    )
  );

-- Eventos solo los inserta service_role
CREATE POLICY "events_insert_service"
  ON events FOR INSERT
  WITH CHECK (false);
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
-- ============================================================
-- UNO Online — Configuración de Supabase Realtime
-- ============================================================

-- Habilitar Realtime en las tablas que el frontend escucha
-- (se configura también desde el dashboard de Supabase)

ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE events;

-- hands NO se agrega a Realtime — los cambios de mano se notifican
-- via events (type: 'card_drawn', 'card_played') y el frontend
-- hace un SELECT de su propia mano cuando recibe esos eventos.
-- Esto evita que otros jugadores reciban actualizaciones de cartas ajenas.
