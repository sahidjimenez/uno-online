-- ============================================================
-- Fix: infinite recursion en políticas RLS de players
-- Solución: función SECURITY DEFINER que bypasea RLS
-- para verificar membresía de sala sin recursión
-- ============================================================

-- 1. Función helper: verifica si el usuario actual es miembro de una sala
--    SECURITY DEFINER = corre como el dueño de la función (bypasea RLS)
--    STABLE = no modifica DB, puede cachearse dentro de una query
CREATE OR REPLACE FUNCTION is_room_member(p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM players
    WHERE players.room_id = p_room_id
    AND players.user_id   = auth.uid()
  );
$$;

-- 2. Eliminar políticas con recursión y reemplazarlas

-- PLAYERS
DROP POLICY IF EXISTS "players_select_same_room" ON players;
CREATE POLICY "players_select_same_room"
  ON players FOR SELECT
  USING ( is_room_member(players.room_id) );

-- HANDS
DROP POLICY IF EXISTS "hands_select_owner" ON hands;
CREATE POLICY "hands_select_owner"
  ON hands FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM players
      WHERE players.id      = hands.player_id
      AND   players.user_id = auth.uid()
    )
  );

-- GAME_STATE
DROP POLICY IF EXISTS "game_state_select_players" ON game_state;
CREATE POLICY "game_state_select_players"
  ON game_state FOR SELECT
  USING ( is_room_member(game_state.room_id) );

-- EVENTS
DROP POLICY IF EXISTS "events_select_players" ON events;
CREATE POLICY "events_select_players"
  ON events FOR SELECT
  USING ( is_room_member(events.room_id) );
