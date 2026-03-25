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
