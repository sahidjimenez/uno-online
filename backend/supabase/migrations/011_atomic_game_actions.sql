-- Only trusted Edge Functions can commit a move. Lock/version validation,
-- hand changes, next turn, penalties and event insertion succeed or roll back together.
CREATE OR REPLACE FUNCTION public.commit_game_action(
  p_room uuid, p_player uuid, p_version integer, p_card uuid,
  p_cards jsonb, p_state jsonb, p_event jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  gs game_state%ROWTYPE;
  played hands%ROWTYPE;
  remaining integer;
  won boolean := false;
BEGIN
  SELECT * INTO gs FROM game_state WHERE room_id=p_room FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida no encontrada'; END IF;
  IF gs.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Estado desactualizado' USING ERRCODE='40001'; END IF;
  IF gs.status <> 'playing' OR gs.current_player_id IS DISTINCT FROM p_player THEN RAISE EXCEPTION 'No es tu turno'; END IF;
  IF NOT EXISTS (SELECT 1 FROM players WHERE id=p_player AND room_id=p_room) THEN RAISE EXCEPTION 'Jugador no encontrado'; END IF;
  IF p_card IS NOT NULL THEN
    DELETE FROM hands WHERE id=p_card AND player_id=p_player AND room_id=p_room RETURNING * INTO played;
    IF NOT FOUND THEN RAISE EXCEPTION 'Carta no encontrada'; END IF;
    SELECT count(*) INTO remaining FROM hands WHERE player_id=p_player;
    won := remaining=0;
    IF won AND played.card_type::text !~ '^[0-9]$' THEN RAISE EXCEPTION 'Solo puedes ganar con una carta de número'; END IF;
  ELSE
    IF jsonb_array_length(p_cards) <> greatest(1, gs.draw_stack) THEN RAISE EXCEPTION 'Cantidad de cartas incorrecta'; END IF;
    INSERT INTO hands(room_id,player_id,card_color,card_type)
      SELECT p_room,p_player,(c->>'card_color')::card_color,(c->>'card_type')::card_type FROM jsonb_array_elements(p_cards) c;
  END IF;
  UPDATE players SET has_called_uno=false WHERE id=p_player;
  UPDATE game_state SET
    version=gs.version+1,
    current_player_id=CASE WHEN won THEN NULL ELSE (p_state->>'current_player_id')::uuid END,
    direction=coalesce((p_state->>'direction')::smallint,gs.direction),
    current_color=coalesce((p_state->>'current_color')::card_color,gs.current_color),
    top_card_color=coalesce((p_state->>'top_card_color')::card_color,gs.top_card_color),
    top_card_type=coalesce((p_state->>'top_card_type')::card_type,gs.top_card_type),
    draw_stack=CASE WHEN won THEN 0 ELSE (p_state->>'draw_stack')::smallint END,
    draw_pile_count=coalesce((p_state->>'draw_pile_count')::smallint,gs.draw_pile_count),
    status=CASE WHEN won THEN 'finished'::room_status ELSE 'playing'::room_status END,
    winner_id=CASE WHEN won THEN p_player ELSE NULL END, updated_at=now()
    WHERE room_id=p_room;
  IF won THEN UPDATE rooms SET status='finished',updated_at=now() WHERE id=p_room; END IF;
  INSERT INTO events(room_id,player_id,type,version,payload) VALUES
    (p_room,p_player,CASE WHEN won THEN 'game_finished'::event_type ELSE (p_event->>'type')::event_type END,
     gs.version+1,coalesce(p_event->'payload','{}'::jsonb)||jsonb_build_object('won',won));
  RETURN jsonb_build_object('ok',true,'version',gs.version+1,'won',won);
END;
$$;
REVOKE ALL ON FUNCTION public.commit_game_action(uuid,uuid,integer,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_game_action(uuid,uuid,integer,uuid,jsonb,jsonb,jsonb) TO service_role;
