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
