-- ============================================================
-- UNO Online — Seed data para desarrollo local
-- Crea una sala de prueba con 3 jugadores y cartas repartidas
-- ============================================================

-- IMPORTANTE: correr esto solo en entorno local de Supabase
-- Requiere crear usuarios anónimos primero en auth.users

-- Insertar sala de prueba
INSERT INTO rooms (id, code, status, max_players)
VALUES ('00000000-0000-0000-0000-000000000001', 'TEST01', 'playing', 8);

-- Insertar jugadores de prueba (user_id simulados)
INSERT INTO players (id, room_id, user_id, name, seat_order, is_connected)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Jugador_1', 0, true),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'Jugador_2', 1, true),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'Jugador_3', 2, true);

-- Asignar host
UPDATE rooms SET host_id = '10000000-0000-0000-0000-000000000001'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Game state inicial
INSERT INTO game_state (room_id, version, status, current_player_id, direction, current_color, top_card_color, top_card_type, draw_pile_count)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  1, 'playing',
  '10000000-0000-0000-0000-000000000001',
  1, 'red', 'red', '7', 87  -- 108 cartas - 3*7 repartidas - 1 descarte = 86
);

-- Mano del Jugador_1 (7 cartas de ejemplo)
INSERT INTO hands (room_id, player_id, card_color, card_type) VALUES
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'red',    '3'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'blue',   '7'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'green',  'skip'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'yellow', '2'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'wild',   'wild'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'red',    'draw2'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'blue',   'reverse');
