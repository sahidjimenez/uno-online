-- Apply the penalty in the same transaction that grants the next player's turn.
CREATE OR REPLACE FUNCTION public.penalize_unannounced_turn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  announced boolean;
  card_count integer;
  dealt integer;
BEGIN
  IF NEW.status <> 'playing' OR NEW.current_player_id IS NULL
     OR OLD.current_player_id IS NOT DISTINCT FROM NEW.current_player_id THEN
    RETURN NEW;
  END IF;

  SELECT has_called_uno INTO announced FROM players
    WHERE id = NEW.current_player_id AND room_id = NEW.room_id FOR UPDATE;
  SELECT count(*) INTO card_count FROM hands WHERE player_id = NEW.current_player_id;
  IF card_count <> 1 OR announced IS TRUE THEN RETURN NEW; END IF;

  -- Reconstruct available cards using the 108-card deck's multiplicities, excluding
  -- hands and the visible discard. This also replenishes an exhausted draw pile.
  WITH standard AS (
    SELECT color::card_color AS color, kind::card_type AS kind,
      CASE WHEN kind = '0' THEN 1 ELSE 2 END AS copies
    FROM unnest(ARRAY['red','blue','green','yellow']) AS c(color)
    CROSS JOIN unnest(ARRAY['0','1','2','3','4','5','6','7','8','9','skip','reverse','draw2']) AS t(kind)
    UNION ALL SELECT 'wild'::card_color, 'wild'::card_type, 4
    UNION ALL SELECT 'wild'::card_color, 'wild4'::card_type, 4
  ), held AS (
    SELECT card_color AS color, card_type AS kind, count(*) AS copies
      FROM hands WHERE room_id = NEW.room_id GROUP BY card_color, card_type
  ), available AS (
    SELECT s.color, s.kind FROM standard s LEFT JOIN held h USING (color, kind)
    CROSS JOIN LATERAL generate_series(1, greatest(0, s.copies - coalesce(h.copies, 0)::integer
      - CASE WHEN s.color = NEW.top_card_color AND s.kind = NEW.top_card_type THEN 1 ELSE 0 END)) n
  )
  INSERT INTO hands (room_id, player_id, card_color, card_type)
    SELECT NEW.room_id, NEW.current_player_id, color, kind FROM available ORDER BY random() LIMIT 4;
  GET DIAGNOSTICS dealt = ROW_COUNT;
  IF dealt <> 4 THEN RAISE EXCEPTION 'No hay suficientes cartas disponibles para la penalización'; END IF;
  UPDATE players SET has_called_uno = false WHERE id = NEW.current_player_id;
  NEW.draw_pile_count := greatest(0, CASE WHEN NEW.draw_pile_count < 4
    THEN 108 - (SELECT count(*) FROM hands WHERE room_id = NEW.room_id) - 1
    ELSE NEW.draw_pile_count - 4 END);
  INSERT INTO events (room_id, player_id, type, version, payload)
    VALUES (NEW.room_id, NEW.current_player_id, 'uno_penalty', NEW.version,
      jsonb_build_object('accused_id', NEW.current_player_id, 'cards_given', 4, 'automatic', true));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS automatic_uno_penalty ON public.game_state;
CREATE TRIGGER automatic_uno_penalty BEFORE UPDATE OF current_player_id ON public.game_state
  FOR EACH ROW EXECUTE FUNCTION public.penalize_unannounced_turn();

-- Serialize announcements with the turn transition, so a late request cannot
-- mark a five-card hand as announced after the automatic penalty was applied.
CREATE OR REPLACE FUNCTION public.announce_last_card(p_room_id uuid, p_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status room_status;
  announced boolean;
BEGIN
  SELECT status INTO current_status FROM game_state WHERE room_id = p_room_id FOR UPDATE;
  IF current_status IS DISTINCT FROM 'playing'::room_status THEN RAISE EXCEPTION 'La partida no está activa'; END IF;
  SELECT has_called_uno INTO announced FROM players WHERE id = p_player_id AND room_id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Jugador no encontrado'; END IF;
  IF (SELECT count(*) FROM hands WHERE player_id = p_player_id) <> 1 THEN
    RAISE EXCEPTION 'Solo puedes avisar cuando tienes una carta';
  END IF;
  IF announced IS TRUE THEN RETURN; END IF;
  UPDATE players SET has_called_uno = true WHERE id = p_player_id;
  INSERT INTO events (room_id, player_id, type, payload)
    VALUES (p_room_id, p_player_id, 'uno_called', jsonb_build_object('player_id', p_player_id));
END;
$$;
REVOKE ALL ON FUNCTION public.announce_last_card(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.announce_last_card(uuid, uuid) TO service_role;
