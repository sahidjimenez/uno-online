-- Presence is a lease (45 s). After 90 s without heartbeat, another member may
-- advance an absent player's turn. The absent player retains their seat/hand.
CREATE FUNCTION advance_absent_player(p_room uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE gs game_state; absent players; next_id uuid; n integer;
BEGIN
  IF NOT is_room_member(p_room) THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE='42501'; END IF;
  PERFORM nexo_private.check_rate(auth.uid(),'absent',10,60);
  SELECT * INTO gs FROM game_state WHERE room_id=p_room FOR UPDATE;
  IF gs.status IS DISTINCT FROM 'playing'::room_status THEN RAISE EXCEPTION 'Partida no activa'; END IF;
  SELECT * INTO absent FROM players WHERE id=gs.current_player_id;
  IF absent.last_heartbeat>clock_timestamp()-interval '90 seconds' THEN RAISE EXCEPTION 'Espera la reconexión del jugador'; END IF;
  SELECT id INTO next_id FROM players WHERE room_id=p_room AND id<>absent.id
    AND is_connected AND last_heartbeat>clock_timestamp()-interval '45 seconds'
    ORDER BY CASE WHEN gs.direction=1 THEN (seat_order-absent.seat_order+8)%8 ELSE (absent.seat_order-seat_order+8)%8 END LIMIT 1;
  IF next_id IS NULL THEN RAISE EXCEPTION 'No hay otro jugador conectado'; END IF;
  n:=nexo_private.deal(p_room,absent.id,greatest(1,gs.draw_stack));
  UPDATE players SET is_connected=false WHERE id=absent.id;
  UPDATE game_state SET current_player_id=next_id,version=version+1,draw_stack=0,updated_at=now(),
    draw_pile_count=(SELECT jsonb_array_length(draw) FROM nexo_private.piles WHERE room_id=p_room) WHERE room_id=p_room;
  INSERT INTO events(room_id,player_id,type,version,payload) VALUES(p_room,absent.id,'card_drawn',gs.version+1,
    jsonb_build_object('cards_drawn',n,'absent',true));
  RETURN jsonb_build_object('ok',true);
END $$;

CREATE FUNCTION leave_waiting_room(p_room uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r rooms; p players;
BEGIN
  SELECT * INTO r FROM rooms WHERE id=p_room FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO p FROM players WHERE room_id=p_room AND user_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE='42501'; END IF;
  IF r.status<>'waiting' THEN RAISE EXCEPTION 'La partida ya comenzó; vuelve a la mesa'; END IF;
  IF (SELECT count(*) FROM players WHERE room_id=p_room)=1 THEN DELETE FROM rooms WHERE id=p_room; RETURN; END IF;
  IF r.host_id=p.id THEN UPDATE rooms SET host_id=(SELECT id FROM players WHERE room_id=p_room AND id<>p.id ORDER BY seat_order LIMIT 1) WHERE id=p_room; END IF;
  UPDATE events SET payload=payload||jsonb_build_object('departed_player_id',p.id),player_id=NULL WHERE player_id=p.id;
  DELETE FROM players WHERE id=p.id;
  INSERT INTO events(room_id,type,payload) VALUES(p_room,'player_left',jsonb_build_object('player_id',p.id));
END $$;

-- Sender attribution comes from auth.uid(), never from a broadcast payload.
-- Expired records are inaccessible and pruned on subsequent sends. Retention
-- cleanup can also be scheduled by the operator, not invoked by clients.
CREATE TABLE room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('reaction','voice')),
  payload jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now()+interval '60 seconds'
);
CREATE INDEX room_messages_expiry ON room_messages(expires_at);
CREATE INDEX room_messages_room ON room_messages(room_id);
ALTER TABLE room_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON room_messages FROM PUBLIC,anon,authenticated;
GRANT SELECT ON room_messages TO authenticated;
CREATE POLICY messages_read_members ON room_messages FOR SELECT TO authenticated
  USING(is_room_member(room_id) AND expires_at>now());
ALTER PUBLICATION supabase_realtime ADD TABLE room_messages;

CREATE FUNCTION send_room_message(p_room uuid,p_kind text,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE p uuid; message jsonb; msg_id uuid:=gen_random_uuid();
BEGIN
  SELECT id INTO p FROM players WHERE room_id=p_room AND user_id=auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Acceso denegado' USING ERRCODE='42501'; END IF;
  IF p_kind='reaction' THEN
    PERFORM nexo_private.check_rate(auth.uid(),'reaction',1,1);
    IF p_payload->>'emoji' IS NULL OR p_payload->>'emoji' NOT IN ('😂','🔥','😱','😎','👏','💚') THEN RAISE EXCEPTION 'Reacción inválida'; END IF;
    message:=jsonb_build_object('emoji',p_payload->>'emoji','time',floor(extract(epoch FROM clock_timestamp())*1000));
  ELSIF p_kind='voice' THEN
    PERFORM nexo_private.check_rate(auth.uid(),'voice',1,8);
    IF p_payload->>'audio' IS NULL OR length(p_payload->>'audio') NOT BETWEEN 4 AND 128000
      OR (p_payload->>'audio') !~ '^[A-Za-z0-9+/]+={0,2}$' OR length(p_payload->>'audio')%4<>0
      OR octet_length(decode(p_payload->>'audio','base64'))>96000
      OR p_payload->>'mime' IS NULL OR length(p_payload->>'mime')>150
      OR (p_payload->>'mime') !~* '^audio/(webm|ogg|mp4)(;[[:space:]]*codecs=[A-Za-z0-9., "-]+)?$'
      OR (p_payload->>'duration') IS NULL OR (p_payload->>'duration')::numeric<=0 OR (p_payload->>'duration')::numeric>10 THEN
      RAISE EXCEPTION 'Grabación inválida';
    END IF;
    message:=jsonb_build_object('audio',p_payload->>'audio','mime',p_payload->>'mime','duration',(p_payload->>'duration')::numeric,
      'expiresAt',floor(extract(epoch FROM clock_timestamp()+interval '60 seconds')*1000));
  ELSE RAISE EXCEPTION 'Mensaje inválido'; END IF;
  message:=message||jsonb_build_object('id',msg_id,'playerId',p);
  DELETE FROM room_messages WHERE expires_at<now();
  INSERT INTO room_messages(id,room_id,player_id,kind,payload) VALUES(msg_id,p_room,p,p_kind,message);
  RETURN message;
END $$;
REVOKE ALL ON FUNCTION advance_absent_player(uuid),leave_waiting_room(uuid),send_room_message(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION advance_absent_player(uuid),leave_waiting_room(uuid),send_room_message(uuid,text,jsonb) TO authenticated;
