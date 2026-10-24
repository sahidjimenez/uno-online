import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { database, room, asUser } from './helpers/database.mjs'
let db
before(async()=>{db=await database()})
after(async()=>{await db?.close()})
test('waiting host leaves, seat is released and new host is authoritative',async()=>{
  const r=await room(db,3)
  await asUser(db,r.users[0],'SELECT leave_waiting_room($1)',[r.id])
  assert.equal((await db.query('SELECT host_id FROM rooms WHERE id=$1',[r.id])).rows[0].host_id,r.players[1])
  assert.equal((await db.query('SELECT count(*)::int AS n FROM players WHERE room_id=$1',[r.id])).rows[0].n,2)
  await asUser(db,r.users[1],'SELECT leave_waiting_room($1)',[r.id])
  await asUser(db,r.users[2],'SELECT leave_waiting_room($1)',[r.id])
  assert.equal((await db.query('SELECT id FROM rooms WHERE id=$1',[r.id])).rows.length,0)
})
test('presence expires, authenticated recovery preserves seat and cards',async()=>{
  const r=await room(db)
  await db.query('SELECT start_match($1,$2)',[r.id,r.players[0]])
  await db.query("UPDATE players SET last_heartbeat=now()-interval '60 seconds' WHERE id=$1",[r.players[0]])
  const snapshot=(await asUser(db,r.users[1],'SELECT room_snapshot($1) AS s',[r.id])).rows[0].s
  assert.equal(snapshot.players.find(p=>p.id===r.players[0]).is_connected,false)
  await assert.rejects(asUser(db,r.users[1],'SELECT advance_absent_player($1)',[r.id]),/Espera/)
  await db.query("UPDATE players SET last_heartbeat=now()-interval '100 seconds' WHERE id=$1",[r.players[0]])
  await asUser(db,r.users[1],'SELECT advance_absent_player($1)',[r.id])
  assert.equal((await db.query('SELECT current_player_id FROM game_state WHERE room_id=$1',[r.id])).rows[0].current_player_id,r.players[1])
  const recovered=(await asUser(db,r.users[0],'SELECT reconnect_player($1) AS r',[r.code])).rows[0].r
  assert.equal(recovered.player_id,r.players[0])
  const hand=(await asUser(db,r.users[0],'SELECT room_snapshot($1) AS s',[r.id])).rows[0].s.myHand
  assert.equal(hand.length,8)
  await assert.rejects(asUser(db,r.users[1],'SELECT leave_waiting_room($1)',[r.id]),/comenzó/)
})
test('messages cannot spoof sender, leak across rooms or bypass rate limits',async()=>{
  const r=await room(db)
  const payload={playerId:r.players[1],id:crypto.randomUUID(),emoji:'🔥'}
  const result=(await asUser(db,r.users[0],"SELECT send_room_message($1,'reaction',$2) AS m",[r.id,JSON.stringify(payload)])).rows[0].m
  assert.equal(result.playerId,r.players[0]); assert.notEqual(result.id,payload.id)
  await assert.rejects(asUser(db,r.users[0],"SELECT send_room_message($1,'reaction',$2)",[r.id,JSON.stringify(payload)]),/Demasiadas/)
  assert.equal((await asUser(db,crypto.randomUUID(),'SELECT * FROM room_messages')).rows.length,0)
  assert.equal((await asUser(db,r.users[1],'SELECT * FROM room_messages WHERE room_id=$1',[r.id])).rows.length,1)
  await assert.rejects(asUser(db,r.users[1],"INSERT INTO room_messages(room_id,player_id,kind,payload) VALUES($1,$2,'reaction','{}')",[r.id,r.players[0]]),/permission denied/)
  await db.query("UPDATE room_messages SET expires_at=now()-interval '1 second' WHERE room_id=$1",[r.id])
  assert.equal((await asUser(db,r.users[1],'SELECT * FROM room_messages WHERE room_id=$1',[r.id])).rows.length,0)
})
test('voice packets validate size and format and retain server identity',async()=>{
  const r=await room(db)
  const send=p=>asUser(db,r.users[0],"SELECT send_room_message($1,'voice',$2) AS m",[r.id,JSON.stringify(p)])
  await assert.rejects(send({audio:'!!!!',mime:'audio/webm',duration:1}),/inválida/)
  await assert.rejects(send({audio:'AAAA',mime:'text/html',duration:1}),/inválida/)
  await assert.rejects(send({audio:'AAAA',mime:'audio/webm',duration:11}),/inválida/)
  const m=(await send({audio:'AAAA',mime:'audio/webm;codecs=opus',duration:1,playerId:r.players[1]})).rows[0].m
  assert.equal(m.playerId,r.players[0]); assert.ok(m.expiresAt>Date.now())
})
