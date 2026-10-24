-- Additive hardening. Apply only after verifying the deployed migration history.
-- Internal state and helpers are never exposed through the public API.
CREATE SCHEMA IF NOT EXISTS nexo_private;
REVOKE ALL ON SCHEMA nexo_private FROM PUBLIC, anon, authenticated;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;

CREATE TABLE nexo_private.rate_limits (
  user_id uuid NOT NULL, scope text NOT NULL, started_at timestamptz NOT NULL,
  count integer NOT NULL, PRIMARY KEY(user_id, scope)
);
CREATE FUNCTION nexo_private.check_rate(p_user uuid, p_scope text, p_max integer, p_seconds integer)
RETURNS void LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE n integer;
BEGIN
  IF p_user IS NULL THEN RAISE EXCEPTION 'Sesión requerida' USING ERRCODE='42501'; END IF;
  INSERT INTO nexo_private.rate_limits VALUES(p_user,p_scope,clock_timestamp(),1)
  ON CONFLICT(user_id,scope) DO UPDATE SET
    count=CASE WHEN rate_limits.started_at < clock_timestamp()-make_interval(secs=>p_seconds) THEN 1 ELSE rate_limits.count+1 END,
    started_at=CASE WHEN rate_limits.started_at < clock_timestamp()-make_interval(secs=>p_seconds) THEN clock_timestamp() ELSE rate_limits.started_at END
  RETURNING count INTO n;
  IF n>p_max THEN RAISE EXCEPTION 'Demasiadas solicitudes; espera un momento' USING ERRCODE='P0001'; END IF;
END $$;

-- No client may mutate game fields, seats, membership or room status directly.
REVOKE ALL ON rooms,players,hands,game_state,events FROM anon,authenticated;
GRANT SELECT ON players,hands,game_state,events TO authenticated;
-- Column grants prevent hashes from being returned even by a member's SELECT *.
GRANT SELECT(id,code,status,host_id,max_players,created_at,updated_at,is_private) ON rooms TO authenticated;
DROP POLICY IF EXISTS rooms_select_all ON rooms;
CREATE POLICY rooms_select_members ON rooms FOR SELECT TO authenticated USING (is_room_member(id));
DROP POLICY IF EXISTS rooms_insert_authenticated ON rooms;
DROP POLICY IF EXISTS rooms_update_host ON rooms;
DROP POLICY IF EXISTS players_insert_self ON players;
DROP POLICY IF EXISTS players_update_self ON players;

-- Remove older signatures that bypass passwords. CREATE OR REPLACE does not
-- replace a differently typed overload.
DROP FUNCTION IF EXISTS create_room(varchar);
DROP FUNCTION IF EXISTS join_room(character,varchar);
ALTER FUNCTION is_room_member(uuid) SET search_path = pg_catalog,public;
ALTER FUNCTION heartbeat(uuid) SET search_path = pg_catalog,public;
ALTER FUNCTION reconnect_player(character) SET search_path = pg_catalog,public;
ALTER FUNCTION mark_disconnected() SET search_path = pg_catalog,public;
ALTER FUNCTION cleanup_old_rooms() SET search_path = pg_catalog,public;
REVOKE ALL ON FUNCTION mark_disconnected(),cleanup_old_rooms() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION mark_disconnected(),cleanup_old_rooms() TO service_role;

CREATE OR REPLACE FUNCTION create_room(player_name text,p_is_private boolean DEFAULT false,p_password text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public,extensions AS $$
DECLARE r rooms; p uuid; code_text text;
BEGIN
  PERFORM nexo_private.check_rate(auth.uid(),'create',5,60);
  IF player_name IS NULL OR length(btrim(player_name)) NOT BETWEEN 1 AND 30 OR length(coalesce(p_password,''))>128 THEN
    RAISE EXCEPTION 'Nombre o contraseña inválidos';
  END IF;
  LOOP
    code_text:=upper(substr(encode(gen_random_bytes(8),'hex'),1,6));
    BEGIN
      INSERT INTO rooms(code,is_private,password_hash) VALUES(code_text,coalesce(p_is_private,false),
        CASE WHEN coalesce(p_password,'')<>'' THEN crypt(p_password,gen_salt('bf',8)) ELSE NULL END) RETURNING * INTO r;
      EXIT;
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
  END LOOP;
  INSERT INTO players(room_id,user_id,name,seat_order) VALUES(r.id,auth.uid(),btrim(player_name),0) RETURNING id INTO p;
  UPDATE rooms SET host_id=p WHERE id=r.id;
  INSERT INTO game_state(room_id) VALUES(r.id);
  INSERT INTO events(room_id,player_id,type) VALUES(r.id,p,'room_created');
  RETURN json_build_object('room_id',r.id,'room_code',r.code,'player_id',p);
END $$;

CREATE OR REPLACE FUNCTION join_room(p_code text,player_name text,p_password text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public,extensions AS $$
DECLARE r rooms; p players; seat integer;
BEGIN
  PERFORM nexo_private.check_rate(auth.uid(),'join',20,60);
  -- Catch validation errors inside this block so failed password attempts still
  -- commit the outer rate counter. Clients must handle the returned error.
  BEGIN
    IF player_name IS NULL OR length(btrim(player_name)) NOT BETWEEN 1 AND 30 OR length(coalesce(p_password,''))>128 THEN
      RAISE EXCEPTION 'Nombre o contraseña inválidos';
    END IF;
    SELECT * INTO r FROM rooms WHERE code=upper(btrim(p_code)) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Sala no encontrada'; END IF;
    SELECT * INTO p FROM players WHERE room_id=r.id AND user_id=auth.uid();
    IF FOUND THEN
      UPDATE players SET is_connected=true,last_heartbeat=now() WHERE id=p.id;
      RETURN json_build_object('room_id',r.id,'room_code',r.code,'player_id',p.id);
    END IF;
    IF r.status<>'waiting' THEN RAISE EXCEPTION 'La partida ya inició'; END IF;
    IF r.password_hash IS NOT NULL AND (p_password IS NULL OR crypt(p_password,r.password_hash)<>r.password_hash) THEN
      RAISE EXCEPTION 'Contraseña incorrecta';
    END IF;
    IF (SELECT count(*) FROM players WHERE room_id=r.id)>=r.max_players THEN RAISE EXCEPTION 'Sala llena'; END IF;
    SELECT min(candidate) INTO seat FROM generate_series(0,r.max_players-1) candidate
      WHERE NOT EXISTS(SELECT 1 FROM players WHERE room_id=r.id AND seat_order=candidate);
    INSERT INTO players(room_id,user_id,name,seat_order) VALUES(r.id,auth.uid(),btrim(player_name),seat) RETURNING * INTO p;
    INSERT INTO events(room_id,player_id,type) VALUES(r.id,p.id,'player_joined');
    RETURN json_build_object('room_id',r.id,'room_code',r.code,'player_id',p.id);
  EXCEPTION WHEN raise_exception THEN RETURN json_build_object('error',SQLERRM);
  END;
END $$;

CREATE OR REPLACE FUNCTION find_public_room(player_name text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
DECLARE r rooms;
BEGIN
  PERFORM nexo_private.check_rate(auth.uid(),'matchmaking',10,60);
  SELECT * INTO r FROM rooms WHERE status='waiting' AND NOT is_private AND password_hash IS NULL
    AND created_at>now()-interval '3 hours'
    AND (SELECT count(*) FROM players WHERE room_id=rooms.id)<max_players
    ORDER BY created_at DESC LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RETURN create_room(player_name,false,NULL); END IF;
  RETURN join_room(r.code::text,player_name,NULL);
END $$;

CREATE OR REPLACE FUNCTION list_public_rooms()
RETURNS TABLE(room_id uuid,room_code character(6),player_count bigint,max_players smallint,created_at timestamptz)
LANGUAGE sql SECURITY DEFINER SET search_path = pg_catalog,public AS $$
  SELECT r.id,r.code,count(p.id),r.max_players,r.created_at FROM rooms r LEFT JOIN players p ON p.room_id=r.id
  WHERE auth.uid() IS NOT NULL AND r.status='waiting' AND NOT r.is_private AND r.password_hash IS NULL
    AND r.created_at>now()-interval '3 hours'
  GROUP BY r.id HAVING count(p.id)<r.max_players ORDER BY r.created_at DESC LIMIT 20
$$;

-- A single SQL statement uses one MVCC snapshot for state, public counts and
-- the caller's hand. Presence expires server-side without a public cleanup RPC.
CREATE FUNCTION room_snapshot(p_room uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog,public AS $$
  SELECT jsonb_build_object(
    'gameState',to_jsonb(gs),
    'room',jsonb_build_object('id',r.id,'host_id',r.host_id,'max_players',r.max_players,'status',r.status),
    'players',(SELECT coalesce(jsonb_agg((to_jsonb(p)-'user_id')||jsonb_build_object(
      'is_connected',p.is_connected AND p.last_heartbeat>now()-interval '45 seconds',
      'hand_count',(SELECT count(*) FROM hands h WHERE h.player_id=p.id)) ORDER BY p.seat_order),'[]'::jsonb) FROM players p WHERE p.room_id=r.id),
    'myHand',(SELECT coalesce(jsonb_agg(to_jsonb(h) ORDER BY h.created_at,h.id),'[]'::jsonb) FROM hands h
      JOIN players p ON p.id=h.player_id WHERE h.room_id=r.id AND p.user_id=auth.uid()))
  FROM rooms r JOIN game_state gs ON gs.room_id=r.id
  WHERE r.id=p_room AND is_room_member(r.id)
$$;

REVOKE ALL ON FUNCTION create_room(text,boolean,text),join_room(text,text,text),find_public_room(text),list_public_rooms(),
  heartbeat(uuid),reconnect_player(character),room_snapshot(uuid),is_room_member(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION create_room(text,boolean,text),join_room(text,text,text),find_public_room(text),list_public_rooms(),
  heartbeat(uuid),reconnect_player(character),room_snapshot(uuid),is_room_member(uuid) TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA nexo_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA nexo_private FROM PUBLIC,anon,authenticated;
