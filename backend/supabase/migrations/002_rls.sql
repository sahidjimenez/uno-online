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
