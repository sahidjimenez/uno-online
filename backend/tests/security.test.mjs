import { before, after, test } from 'node:test'
import assert from 'node:assert/strict'
import { database, asUser, room } from './helpers/database.mjs'
let db
before(async () => { db = await database() })
after(async () => { await db?.close() })

test('all migrations restore; only approved room overloads remain', async () => {
  const rows = (await db.query("SELECT proname,pronargs FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('join_room','create_room')")).rows
  assert.equal(rows.length, 2)
  assert.ok(rows.every(r => r.pronargs === 3))
})
test('members cannot read password hashes or write game/membership fields', async () => {
  const r = await room(db, 2, true, 'secret')
  for (const sql of [
    'SELECT password_hash FROM rooms', 'SELECT * FROM rooms',
    "UPDATE players SET has_called_uno=true", "UPDATE rooms SET status='playing'",
    'DELETE FROM hands', 'SELECT * FROM nexo_private.piles',
  ]) await assert.rejects(asUser(db, r.users[0], sql), /permission denied/)
  await assert.rejects(asUser(db, crypto.randomUUID(), "INSERT INTO players(room_id,user_id,name,seat_order) VALUES($1,auth.uid(),'Intruder',7)", [r.id]), /permission denied/)
  assert.equal((await asUser(db, crypto.randomUUID(), 'SELECT id,code FROM rooms')).rows.length, 0)
  assert.equal((await asUser(db, r.users[0], 'SELECT id FROM rooms')).rows.length, 1)
})
test('password protected entry, retry and capacity are authoritative', async () => {
  const r = await room(db, 1, true, 'password')
  const user = crypto.randomUUID()
  const join = pass => asUser(db, user, 'SELECT join_room($1,$2,$3) AS r', [r.code, 'Guest', pass])
  assert.match((await join('wrong')).rows[0].r.error, /Contraseña/)
  const first = (await join('password')).rows[0].r
  assert.equal((await join(null)).rows[0].r.player_id, first.player_id)
  await db.query('UPDATE rooms SET max_players=2 WHERE id=$1',[r.id])
  const full = (await asUser(db, crypto.randomUUID(), 'SELECT join_room($1,$2,$3) AS r', [r.code,'Third','password'])).rows[0].r
  assert.match(full.error, /llena/)
})
test('failed passwords consume rate allowance', async () => {
  const r = await room(db, 1, true, 'secret')
  const user = crypto.randomUUID()
  for (let i=0;i<20;i++) await asUser(db,user,'SELECT join_room($1,$2,$3)',[r.code,'Guest','bad'])
  await assert.rejects(asUser(db,user,'SELECT join_room($1,$2,$3)',[r.code,'Guest','secret']),/Demasiadas/)
})
test('client roles cannot execute privileged commands, maintenance or helpers', async () => {
  const user=crypto.randomUUID()
  for (const sql of [
    'SELECT start_match(gen_random_uuid(),gen_random_uuid())',
    'SELECT announce_last_card(gen_random_uuid(),gen_random_uuid())',
    'SELECT penalize_last_card(gen_random_uuid(),gen_random_uuid(),gen_random_uuid())',
    'SELECT cleanup_old_rooms()', 'SELECT mark_disconnected()',
    'SELECT nexo_private.standard_deck()',
  ]) await assert.rejects(asUser(db,user,sql), /permission denied/)
})
test('snapshot contains public counts but only the caller hand', async () => {
  const r=await room(db)
  await db.query('SELECT start_match($1,$2)',[r.id,r.players[0]])
  const s=(await asUser(db,r.users[0],'SELECT room_snapshot($1) AS s',[r.id])).rows[0].s
  assert.equal(s.myHand.length,7)
  assert.ok(s.myHand.every(c=>c.player_id===r.players[0]))
  assert.ok(s.players.every(p=>p.hand_count===7 && !('user_id' in p)))
  assert.equal((await asUser(db,crypto.randomUUID(),'SELECT room_snapshot($1) AS s',[r.id])).rows[0].s,null)
})
