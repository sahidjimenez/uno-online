-- ============================================================
-- UNO Online — Listado público de salas + limpieza automática
-- ============================================================

-- Índice para acelerar consultas por fecha en rooms
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);

-- ============================================================
-- list_public_rooms() — devuelve salas públicas disponibles
-- SECURITY DEFINER para poder contar jugadores sin RLS
-- ============================================================
CREATE OR REPLACE FUNCTION list_public_rooms()
RETURNS TABLE (
  room_id       UUID,
  room_code     CHAR(6),
  player_count  BIGINT,
  max_players   SMALLINT,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.code,
    COUNT(p.id)::BIGINT,
    r.max_players,
    r.created_at
  FROM rooms r
  LEFT JOIN players p ON p.room_id = r.id
  WHERE r.status = 'waiting'
    AND (r.is_private = false OR r.is_private IS NULL)
    AND r.created_at > now() - INTERVAL '3 hours'
  GROUP BY r.id, r.code, r.max_players, r.created_at
  HAVING COUNT(p.id) < r.max_players
  ORDER BY r.created_at DESC
  LIMIT 20;
END;
$$;

-- ============================================================
-- cleanup_old_rooms() — elimina salas con más de 3 horas
-- Se puede llamar manualmente o via pg_cron / cron job
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_old_rooms()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM rooms
  WHERE created_at < now() - INTERVAL '3 hours'
    AND status IN ('waiting', 'finished');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
