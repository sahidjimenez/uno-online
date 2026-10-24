CREATE TABLE nexo_private.piles (
  room_id uuid PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
  draw jsonb NOT NULL, discard jsonb NOT NULL
);
CREATE TABLE nexo_private.commands (
  room_id uuid REFERENCES rooms(id) ON DELETE CASCADE, request_id uuid,
  player_id uuid NOT NULL, command jsonb NOT NULL, result jsonb NOT NULL,
  PRIMARY KEY(room_id,request_id)
);
ALTER TABLE players ADD COLUMN nexo_available_until timestamptz;

CREATE FUNCTION nexo_private.standard_deck() RETURNS jsonb LANGUAGE sql SET search_path=pg_catalog,public AS $$
  SELECT jsonb_agg(jsonb_build_object('color',color,'type',kind) ORDER BY random()) FROM (
    SELECT color,kind FROM unnest(ARRAY['red','blue','green','yellow']) color
    CROSS JOIN unnest(ARRAY['0','1','2','3','4','5','6','7','8','9','skip','reverse','draw2']) kind
    CROSS JOIN LATERAL generate_series(1,CASE WHEN kind='0' THEN 1 ELSE 2 END) n
    UNION ALL SELECT 'wild',kind FROM unnest(ARRAY['wild','wild4']) kind CROSS JOIN generate_series(1,4) n
  ) deck
$$;

-- Caller holds the game/room lock. Return actual dealt count when every other
-- card is held; never invent cards or discard the visible top card.
CREATE FUNCTION nexo_private.deal(p_room uuid,p_player uuid,p_count integer) RETURNS integer
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE pile nexo_private.piles; c jsonb; dealt integer:=0; i integer;
BEGIN
  SELECT * INTO pile FROM nexo_private.piles WHERE room_id=p_room FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta partida requiere el mazo persistente; crea una nueva sala'; END IF;
  FOR i IN 1..p_count LOOP
    IF jsonb_array_length(pile.draw)=0 AND jsonb_array_length(pile.discard)>1 THEN
      SELECT jsonb_agg(value ORDER BY random()) INTO pile.draw FROM jsonb_array_elements(pile.discard) WITH ORDINALITY d(value,n)
        WHERE n<jsonb_array_length(pile.discard);
      pile.discard:=jsonb_build_array(pile.discard->(jsonb_array_length(pile.discard)-1));
    END IF;
    EXIT WHEN jsonb_array_length(pile.draw)=0;
    c:=pile.draw->0; pile.draw:=pile.draw-0;
    INSERT INTO hands(room_id,player_id,card_color,card_type,created_at) VALUES(p_room,p_player,(c->>'color')::card_color,(c->>'type')::card_type,clock_timestamp());
    dealt:=dealt+1;
  END LOOP;
  UPDATE nexo_private.piles SET draw=pile.draw,discard=pile.discard WHERE room_id=p_room;
  UPDATE players SET has_called_uno=false,nexo_available_until=NULL WHERE id=p_player;
  RETURN dealt;
END $$;

CREATE FUNCTION start_match(p_room uuid,p_player uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r rooms; p players; deck jsonb; c jsonb; idx integer; n integer; v integer;
BEGIN
  SELECT * INTO r FROM rooms WHERE id=p_room FOR UPDATE;
  IF NOT FOUND OR r.host_id IS DISTINCT FROM p_player THEN RAISE EXCEPTION 'Solo el anfitrión puede iniciar'; END IF;
  SELECT version INTO v FROM game_state WHERE room_id=p_room FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Estado de sala no encontrado'; END IF;
  IF r.status='playing' THEN RETURN jsonb_build_object('ok',true,'version',v); END IF;
  IF r.status<>'waiting' THEN RAISE EXCEPTION 'La partida ya terminó'; END IF;
  SELECT count(*) INTO n FROM players WHERE room_id=p_room;
  IF n<2 OR n>r.max_players THEN RAISE EXCEPTION 'Se requieren entre 2 y el máximo de jugadores'; END IF;
  IF EXISTS(SELECT 1 FROM players WHERE room_id=p_room AND (NOT is_connected OR last_heartbeat<now()-interval '45 seconds')) THEN
    RAISE EXCEPTION 'Espera a que todos los participantes estén conectados';
  END IF;
  IF EXISTS(SELECT 1 FROM hands WHERE room_id=p_room) THEN RAISE EXCEPTION 'La sala ya contiene cartas'; END IF;
  deck:=nexo_private.standard_deck();
  INSERT INTO nexo_private.piles VALUES(p_room,deck,'[]');
  FOR p IN SELECT * FROM players WHERE room_id=p_room ORDER BY seat_order LOOP
    PERFORM nexo_private.deal(p_room,p.id,7);
  END LOOP;
  SELECT draw INTO deck FROM nexo_private.piles WHERE room_id=p_room;
  SELECT (ordinality-1)::integer,value INTO idx,c FROM jsonb_array_elements(deck) WITH ORDINALITY
    WHERE value->>'type' ~ '^[0-9]$' LIMIT 1;
  UPDATE nexo_private.piles SET draw=deck-idx,discard=jsonb_build_array(c) WHERE room_id=p_room;
  UPDATE game_state SET version=version+1,status='playing',direction=1,draw_stack=0,
    current_player_id=(SELECT id FROM players WHERE room_id=p_room ORDER BY seat_order LIMIT 1),
    current_color=(c->>'color')::card_color,top_card_color=(c->>'color')::card_color,top_card_type=(c->>'type')::card_type,
    draw_pile_count=jsonb_array_length(deck)-1,updated_at=now() WHERE room_id=p_room RETURNING version INTO v;
  UPDATE rooms SET status='playing',updated_at=now() WHERE id=p_room;
  INSERT INTO events(room_id,player_id,type,version,payload) VALUES(p_room,p_player,'game_started',v,jsonb_build_object('player_count',n));
  RETURN jsonb_build_object('ok',true,'version',v);
END $$;

-- All penalties draw from the same persisted pile, under the game-state lock.
CREATE FUNCTION nexo_private.penalty(p_room uuid,p_player uuid,p_version integer,p_automatic boolean) RETURNS integer
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE p players; n integer;
BEGIN
  SELECT * INTO p FROM players WHERE id=p_player AND room_id=p_room;
  IF NOT FOUND OR p.has_called_uno OR p.nexo_available_until>clock_timestamp()
    OR (SELECT count(*) FROM hands WHERE player_id=p_player)<>1 THEN RETURN 0; END IF;
  IF EXISTS(SELECT 1 FROM nexo_private.piles WHERE room_id=p_room AND jsonb_array_length(draw)=0 AND jsonb_array_length(discard)<=1) THEN RETURN 0; END IF;
  n:=nexo_private.deal(p_room,p_player,4);
  INSERT INTO events(room_id,player_id,type,version,payload) VALUES(p_room,p_player,'uno_penalty',p_version,
    jsonb_build_object('accused_id',p_player,'cards_given',n,'automatic',p_automatic));
  -- A completely exhausted pile must not cause repeated attempts/events.
  UPDATE players SET has_called_uno=true WHERE id=p_player AND n=0;
  RETURN n;
END $$;

DROP TRIGGER automatic_uno_penalty ON game_state;
CREATE OR REPLACE FUNCTION penalize_unannounced_turn() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NEW.status='playing' AND NEW.current_player_id IS NOT NULL AND OLD.current_player_id IS DISTINCT FROM NEW.current_player_id THEN
    PERFORM nexo_private.penalty(NEW.room_id,NEW.current_player_id,NEW.version,true);
    SELECT jsonb_array_length(draw) INTO NEW.draw_pile_count FROM nexo_private.piles WHERE room_id=NEW.room_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER automatic_uno_penalty BEFORE UPDATE OF current_player_id ON game_state FOR EACH ROW EXECUTE FUNCTION penalize_unannounced_turn();

DROP FUNCTION commit_game_action(uuid,uuid,integer,uuid,jsonb,jsonb,jsonb);
CREATE FUNCTION commit_game_action(p_room uuid,p_player uuid,p_version integer,p_card uuid,
  p_cards jsonb,p_state jsonb,p_event jsonb,p_request uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE gs game_state; played hands; remaining integer; won boolean:=false; dealt integer:=0;
  result jsonb; old_command nexo_private.commands; command jsonb; next_id uuid; next_color card_color; recent hands;
BEGIN
  SELECT * INTO gs FROM game_state WHERE room_id=p_room FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Partida no encontrada'; END IF;
  IF p_request IS NULL THEN RAISE EXCEPTION 'Identificador de acción requerido'; END IF;
  command:=jsonb_build_object('version',p_version,'card',p_card,'state',p_state,'event',p_event);
  SELECT * INTO old_command FROM nexo_private.commands WHERE room_id=p_room AND request_id=p_request;
  IF FOUND THEN
    IF old_command.player_id<>p_player OR old_command.command<>command THEN RAISE EXCEPTION 'Identificador de acción reutilizado'; END IF;
    RETURN old_command.result;
  END IF;
  IF gs.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Estado desactualizado' USING ERRCODE='40001'; END IF;
  IF gs.status<>'playing' OR gs.current_player_id IS DISTINCT FROM p_player THEN RAISE EXCEPTION 'No es tu turno'; END IF;
  IF NOT EXISTS(SELECT 1 FROM players WHERE room_id=p_room AND id=p_player) THEN RAISE EXCEPTION 'Jugador no encontrado'; END IF;
  IF NOT EXISTS(SELECT 1 FROM nexo_private.piles WHERE room_id=p_room) THEN RAISE EXCEPTION 'Crea una sala nueva para usar el mazo persistente'; END IF;
  next_id:=(p_state->>'current_player_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM players WHERE room_id=p_room AND id=next_id) THEN RAISE EXCEPTION 'Siguiente jugador inválido'; END IF;
  IF p_card IS NOT NULL THEN
    IF EXISTS(SELECT 1 FROM players WHERE id=p_player AND NOT has_called_uno AND nexo_available_until>clock_timestamp())
      AND (SELECT count(*) FROM hands WHERE player_id=p_player)=1 THEN RAISE EXCEPTION 'Anuncia NEXO antes de jugar tu última carta'; END IF;
    PERFORM nexo_private.penalty(p_room,p_player,gs.version+1,true);
    SELECT * INTO played FROM hands WHERE id=p_card AND player_id=p_player AND room_id=p_room;
    IF NOT FOUND THEN RAISE EXCEPTION 'Carta no encontrada'; END IF;
    next_color:=(p_state->>'current_color')::card_color;
    IF next_color IS NULL OR next_color='wild' THEN RAISE EXCEPTION 'Elige un color válido'; END IF;
    IF gs.draw_stack>0 THEN
      IF played.card_type NOT IN ('draw2','wild4') AND NOT(played.card_type='reverse' AND played.card_color=gs.current_color) THEN RAISE EXCEPTION 'Contraataque inválido'; END IF;
    ELSIF played.card_type NOT IN ('wild','wild4') AND played.card_color<>gs.current_color AND played.card_type<>gs.top_card_type THEN
      RAISE EXCEPTION 'Carta no válida';
    END IF;
    SELECT count(*)-1 INTO remaining FROM hands WHERE player_id=p_player;
    won:=remaining=0;
    IF won AND played.card_type::text !~ '^[0-9]$' THEN RAISE EXCEPTION 'Solo puedes ganar con una carta de número'; END IF;
    DELETE FROM hands WHERE id=p_card;
    UPDATE nexo_private.piles SET discard=discard||jsonb_build_array(jsonb_build_object('color',played.card_color,'type',played.card_type)) WHERE room_id=p_room;
    UPDATE players SET has_called_uno=false,nexo_available_until=CASE WHEN remaining=1 THEN clock_timestamp()+interval '5 seconds' ELSE NULL END WHERE id=p_player;
  ELSE
    PERFORM nexo_private.penalty(p_room,p_player,gs.version+1,true);
    dealt:=nexo_private.deal(p_room,p_player,greatest(1,gs.draw_stack));
    -- Preserve the local rule: a playable drawn card permits another action.
    SELECT * INTO recent FROM hands WHERE player_id=p_player ORDER BY created_at DESC,id DESC LIMIT 1;
    IF gs.draw_stack=0 AND dealt=1 AND (recent.card_type IN ('wild','wild4') OR recent.card_color=gs.current_color OR recent.card_type=gs.top_card_type) THEN next_id:=p_player; END IF;
    p_event:=jsonb_build_object('type',CASE WHEN gs.draw_stack>0 THEN 'draw_stack_resolved' ELSE 'card_drawn' END,
      'payload',jsonb_build_object('cards_drawn',dealt,'stack_resolved',gs.draw_stack>0));
  END IF;
  UPDATE game_state SET version=gs.version+1,
    current_player_id=CASE WHEN won THEN NULL ELSE next_id END,
    direction=CASE WHEN p_card IS NULL THEN gs.direction ELSE (p_state->>'direction')::smallint END,
    current_color=CASE WHEN p_card IS NULL THEN gs.current_color ELSE next_color END,
    top_card_color=CASE WHEN p_card IS NULL THEN gs.top_card_color ELSE played.card_color END,
    top_card_type=CASE WHEN p_card IS NULL THEN gs.top_card_type ELSE played.card_type END,
    draw_stack=CASE WHEN won OR p_card IS NULL THEN 0 ELSE (p_state->>'draw_stack')::smallint END,
    draw_pile_count=(SELECT jsonb_array_length(draw) FROM nexo_private.piles WHERE room_id=p_room),
    status=CASE WHEN won THEN 'finished'::room_status ELSE 'playing'::room_status END,
    winner_id=CASE WHEN won THEN p_player ELSE NULL END,updated_at=now() WHERE room_id=p_room;
  IF won THEN UPDATE rooms SET status='finished',updated_at=now() WHERE id=p_room; END IF;
  INSERT INTO events(room_id,player_id,type,version,payload) VALUES(p_room,p_player,
    CASE WHEN won THEN 'game_finished'::event_type ELSE (p_event->>'type')::event_type END,gs.version+1,
    coalesce(p_event->'payload','{}')||jsonb_build_object('won',won));
  result:=jsonb_build_object('ok',true,'version',gs.version+1,'won',won,'cards_drawn',dealt);
  INSERT INTO nexo_private.commands VALUES(p_room,p_request,p_player,command,result);
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION announce_last_card(p_room_id uuid,p_player_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE gs game_state; p players;
BEGIN
  SELECT * INTO gs FROM game_state WHERE room_id=p_room_id FOR UPDATE;
  IF NOT FOUND OR gs.status<>'playing' THEN RAISE EXCEPTION 'La partida no está activa'; END IF;
  SELECT * INTO p FROM players WHERE id=p_player_id AND room_id=p_room_id;
  IF NOT FOUND OR (SELECT count(*) FROM hands WHERE player_id=p_player_id)<>1 THEN RAISE EXCEPTION 'Solo puedes anunciar con una carta'; END IF;
  IF p.has_called_uno THEN RETURN; END IF;
  -- Returning turn ends the window, but never before the five-second grace.
  IF gs.current_player_id=p.id AND p.nexo_available_until<=clock_timestamp() THEN
    PERFORM nexo_private.penalty(p_room_id,p.id,gs.version+1,true);
  ELSE
    UPDATE players SET has_called_uno=true WHERE id=p.id;
    INSERT INTO events(room_id,player_id,type,version) VALUES(p_room_id,p.id,'uno_called',gs.version+1);
  END IF;
  UPDATE game_state SET version=version+1,updated_at=now(),draw_pile_count=(SELECT jsonb_array_length(draw) FROM nexo_private.piles WHERE room_id=p_room_id) WHERE room_id=p_room_id;
END $$;

CREATE FUNCTION penalize_last_card(p_room uuid,p_accuser uuid,p_accused uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE gs game_state; n integer;
BEGIN
  SELECT * INTO gs FROM game_state WHERE room_id=p_room FOR UPDATE;
  IF NOT FOUND OR gs.status<>'playing' THEN RAISE EXCEPTION 'La partida no está activa'; END IF;
  IF p_accuser=p_accused OR NOT EXISTS(SELECT 1 FROM players WHERE id=p_accuser AND room_id=p_room) THEN RAISE EXCEPTION 'Acusación inválida'; END IF;
  n:=nexo_private.penalty(p_room,p_accused,gs.version+1,false);
  IF n>0 THEN UPDATE game_state SET version=version+1,updated_at=now(),
    draw_pile_count=(SELECT jsonb_array_length(draw) FROM nexo_private.piles WHERE room_id=p_room) WHERE room_id=p_room; END IF;
  RETURN jsonb_build_object('ok',true,'cards_given',n);
END $$;

CREATE FUNCTION check_action_rate(p_user uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN PERFORM nexo_private.check_rate(p_user,'game-action',60,60); END $$;
REVOKE ALL ON FUNCTION start_match(uuid,uuid),commit_game_action(uuid,uuid,integer,uuid,jsonb,jsonb,jsonb,uuid),
  penalize_last_card(uuid,uuid,uuid),check_action_rate(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION start_match(uuid,uuid),commit_game_action(uuid,uuid,integer,uuid,jsonb,jsonb,jsonb,uuid),
  penalize_last_card(uuid,uuid,uuid),check_action_rate(uuid) TO service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nexo_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA nexo_private FROM PUBLIC,anon,authenticated;
