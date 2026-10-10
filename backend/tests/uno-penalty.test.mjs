import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

let db
before(async () => {
  db = new PGlite()
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;')
  for (const name of ['001_schema.sql', '009_uno_penalty_event.sql', '010_automatic_uno_penalty.sql', '011_atomic_game_actions.sql']) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'))
  }
})
after(async () => { await db.close() })
async function fixture() {
  await db.exec('TRUNCATE rooms CASCADE')
  const room = (await db.query("INSERT INTO rooms(code,status) VALUES ('TEST01','playing') RETURNING id")).rows[0].id
  const players = []
  for (let i = 0; i < 3; i++) players.push((await db.query('INSERT INTO players(room_id,user_id,name,seat_order) VALUES ($1,gen_random_uuid(),$2,$3) RETURNING id', [room, `Player ${i}`, i])).rows[0].id)
  await db.query("INSERT INTO game_state(room_id,status,current_player_id,draw_pile_count,top_card_color,top_card_type) VALUES ($1,'playing',$2,50,'red','5')", [room, players[0]])
  await db.query("INSERT INTO hands(room_id,player_id,card_color,card_type) VALUES ($1,$2,'blue','7')", [room, players[1]])
  return { room, players }
}
async function nextTurn(room, player) { await db.query('UPDATE game_state SET current_player_id=$2, version=version+1 WHERE room_id=$1', [room, player]) }
async function handCount(player) { return Number((await db.query('SELECT count(*) AS n FROM hands WHERE player_id=$1', [player])).rows[0].n) }

test('arrival gives four cards atomically, leaves the turn active, emits one event', async () => {
  const { room, players } = await fixture()
  await nextTurn(room, players[1])
  assert.equal(await handCount(players[1]), 5)
  const state = (await db.query('SELECT * FROM game_state WHERE room_id=$1', [room])).rows[0]
  assert.equal(state.current_player_id, players[1]); assert.equal(state.draw_pile_count, 46)
  const events = (await db.query("SELECT * FROM events WHERE type='uno_penalty'")).rows
  assert.equal(events.length, 1); assert.equal(events[0].payload.cards_given, 4)
  await nextTurn(room, players[1])
  assert.equal(await handCount(players[1]), 5)
  await assert.rejects(db.query('SELECT announce_last_card($1,$2)', [room, players[1]]))
})
test('an announcement before arrival prevents the penalty and duplicate calls do not emit twice', async () => {
  const { room, players } = await fixture()
  await db.query('SELECT announce_last_card($1,$2)', [room, players[1]])
  await db.query('SELECT announce_last_card($1,$2)', [room, players[1]])
  await nextTurn(room, players[1])
  assert.equal(await handCount(players[1]), 1)
  assert.equal((await db.query("SELECT * FROM events WHERE type='uno_called'")).rows.length, 1)
  assert.equal((await db.query("SELECT * FROM events WHERE type='uno_penalty'")).rows.length, 0)
})
test('skips do not penalize a player whose turn has not arrived', async () => {
  const { room, players } = await fixture()
  await nextTurn(room, players[2]); assert.equal(await handCount(players[1]), 1)
  await nextTurn(room, players[1]); assert.equal(await handCount(players[1]), 5)
})
test('refills the pile and preserves the draw stack', async () => {
  const { room, players } = await fixture()
  await db.query('UPDATE game_state SET draw_pile_count=0, draw_stack=6 WHERE room_id=$1', [room])
  await nextTurn(room, players[1])
  assert.equal(await handCount(players[1]), 5)
  const state = (await db.query('SELECT * FROM game_state WHERE room_id=$1', [room])).rows[0]
  assert.equal(state.draw_stack, 6); assert.equal(state.draw_pile_count, 102)
})
test('a finished game never applies a next-turn penalty', async () => {
  const { room, players } = await fixture()
  await db.query("UPDATE game_state SET status='finished', current_player_id=$2 WHERE room_id=$1", [room, players[1]])
  assert.equal(await handCount(players[1]), 1)
})
async function commitDraw(room, player, version, type = 'card_drawn') {
  return db.query('SELECT commit_game_action($1,$2,$3,NULL,$4::jsonb,$5::jsonb,$6::jsonb) AS result', [room, player, version,
    JSON.stringify([{card_color:'red',card_type:'2'}]),
    JSON.stringify({current_player_id:player,draw_stack:0,draw_pile_count:49}),
    JSON.stringify({type,payload:{cards_drawn:1}})])
}
test('failed event insertion rolls back hand, turn and version together', async () => {
  const {room,players}=await fixture()
  await assert.rejects(commitDraw(room,players[0],0,'invalid_event'))
  assert.equal(await handCount(players[0]),0)
  assert.equal((await db.query('SELECT version FROM game_state WHERE room_id=$1',[room])).rows[0].version,0)
})
test('two submissions for the same version can only deal once', async () => {
  const {room,players}=await fixture()
  const results=await Promise.allSettled([commitDraw(room,players[0],0),commitDraw(room,players[0],0)])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  assert.equal(await handCount(players[0]),1)
  assert.equal((await db.query('SELECT version FROM game_state WHERE room_id=$1',[room])).rows[0].version,1)
})
test('atomic play rejects a special winning card without deleting it', async () => {
  const {room,players}=await fixture()
  const card=(await db.query("INSERT INTO hands(room_id,player_id,card_color,card_type) VALUES ($1,$2,'red','skip') RETURNING id",[room,players[0]])).rows[0].id
  await assert.rejects(db.query("SELECT commit_game_action($1,$2,0,$3,'[]','{}','{}')",[room,players[0],card]))
  assert.equal(await handCount(players[0]),1)
})
test('playing a card commits the next turn and its automatic penalty together', async () => {
  const {room,players}=await fixture()
  const inserted=await db.query("INSERT INTO hands(room_id,player_id,card_color,card_type) VALUES ($1,$2,'red','7'),($1,$2,'blue','8') RETURNING id",[room,players[0]])
  const result=await db.query('SELECT commit_game_action($1,$2,0,$3,\'[]\',$4::jsonb,$5::jsonb) AS result',[room,players[0],inserted.rows[0].id,
    JSON.stringify({current_player_id:players[1],current_color:'red',top_card_color:'red',top_card_type:'7',draw_stack:0}),
    JSON.stringify({type:'card_played',payload:{card:{color:'red',type:'7'}}})])
  assert.equal(result.rows[0].result.ok,true)
  assert.equal(await handCount(players[0]),1)
  assert.equal(await handCount(players[1]),5)
  assert.equal((await db.query('SELECT count(*)::int AS n FROM events')).rows[0].n,2)
})
