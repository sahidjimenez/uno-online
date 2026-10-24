import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from '../../frontend/node_modules/typescript/lib/typescript.js'
import { database, room } from './helpers/database.mjs'
const source=await readFile(new URL('../supabase/functions/_shared/rules.ts',import.meta.url),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {canPlay,applyCard,nextPlayerIndex}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)
let db
before(async()=>{db=await database()})
after(async()=>{await db?.close()})
async function state(r) { return (await db.query('SELECT * FROM game_state WHERE room_id=$1',[r.id])).rows[0] }
async function hands(r) { return (await db.query('SELECT * FROM hands WHERE room_id=$1 ORDER BY created_at,id',[r.id])).rows }
async function invariant(r) {
  const held=await hands(r)
  const pile=(await db.query('SELECT * FROM nexo_private.piles WHERE room_id=$1',[r.id])).rows[0]
  const cards=[...pile.draw,...pile.discard,...held.map(c=>({color:c.card_color,type:c.card_type}))]
  assert.equal(cards.length,108)
  const counts=new Map()
  for(const c of cards) counts.set(`${c.color}:${c.type}`,(counts.get(`${c.color}:${c.type}`)??0)+1)
  assert.equal(counts.size,54)
  for(const [key,count] of counts) assert.equal(count,key.startsWith('wild:')?4:key.endsWith(':0')?1:2,key)
  const gs=await state(r)
  assert.equal(gs.draw_pile_count,pile.draw.length)
  assert.deepEqual(pile.discard.at(-1),{color:gs.top_card_color,type:gs.top_card_type})
}
async function command(r,gs,card=null,request=crypto.randomUUID(),eventType='card_played',chosen='blue') {
  const index=r.players.indexOf(gs.current_player_id)
  const update=card?applyCard({color:card.card_color,type:card.card_type},chosen,gs,r.players.length,index):{}
  const direction=update.direction??gs.direction
  const skip=card&&(card.card_type==='skip'||(card.card_type==='reverse'&&r.players.length===2&&gs.draw_stack===0))
  const next=r.players[nextPlayerIndex(index,r.players.length,direction,skip)]
  return db.query('SELECT commit_game_action($1,$2,$3,$4,$5,$6,$7,$8) AS result',[
    r.id,gs.current_player_id,gs.version,card?.id??null,'[]',
    JSON.stringify({direction,draw_stack:gs.draw_stack,...update,current_player_id:next}),
    JSON.stringify({type:eventType,payload:{}}),request,
  ])
}
test('concurrent starts deal exactly once and non-host cannot start',async()=>{
  const r=await room(db,4)
  await assert.rejects(db.query('SELECT start_match($1,$2)',[r.id,r.players[1]]),/anfitrión/)
  await Promise.all([db.query('SELECT start_match($1,$2)',[r.id,r.players[0]]),db.query('SELECT start_match($1,$2)',[r.id,r.players[0]])])
  assert.equal((await hands(r)).length,28)
  assert.equal((await state(r)).version,1)
  await invariant(r)
})
test('duplicate draw is idempotent; a different stale request cannot deal again',async()=>{
  const r=await room(db); await db.query('SELECT start_match($1,$2)',[r.id,r.players[0]])
  const gs=await state(r), request=crypto.randomUUID()
  const first=await command(r,gs,null,request)
  const second=await command(r,gs,null,request)
  assert.deepEqual(second.rows,first.rows)
  assert.equal((await hands(r)).length,15)
  await assert.rejects(command(r,gs),/desactualizado/)
  await invariant(r)
})
test('failed event rolls back deck, hands and version',async()=>{
  const r=await room(db); await db.query('SELECT start_match($1,$2)',[r.id,r.players[0]])
  const gs=await state(r)
  const card=(await hands(r)).find(c=>c.player_id===gs.current_player_id&&canPlay(c,gs))
  if(!card) {
    // Force a legal color without changing any cards; visible card is adjusted
    // consistently so the rollback invariant still checks the real deck.
    const first=(await hands(r)).find(c=>c.player_id===gs.current_player_id)
    gs.current_color=first.card_color==='wild'?'red':first.card_color
    await db.query('UPDATE game_state SET current_color=$2 WHERE room_id=$1',[r.id,gs.current_color])
  }
  const playable=card??(await hands(r)).find(c=>c.player_id===gs.current_player_id&&canPlay(c,gs))
  await assert.rejects(command(r,gs,playable,crypto.randomUUID(),'invalid_event'))
  assert.equal((await state(r)).version,gs.version)
  assert.equal((await hands(r)).length,14)
  await invariant(r)
})
test('mixed stacks use active color; reverse preserves stack and changes target',async()=>{
  const gs={draw_stack:6,current_color:'blue',top_card_color:'wild',top_card_type:'wild4',direction:1}
  assert.equal(canPlay({card_color:'blue',card_type:'reverse'},gs),true)
  assert.equal(canPlay({card_color:'red',card_type:'reverse'},gs),false)
  const next=applyCard({color:'blue',type:'reverse'},null,gs,3,1)
  assert.equal(next.direction,-1)
  assert.equal(next.draw_stack??gs.draw_stack,6)
  assert.equal(nextPlayerIndex(1,3,next.direction),0)
})
for(const count of [2,4,8]) test(`complete ${count}-player game conserves every card on every action`,async()=>{
  const r=await room(db,count); await db.query('SELECT start_match($1,$2)',[r.id,r.players[0]])
  for(let turn=0;turn<5000;turn++) {
    const gs=await state(r)
    if(gs.status==='finished') { await invariant(r); assert.equal((await hands(r)).filter(c=>c.player_id===gs.winner_id).length,0); return }
    const hand=(await hands(r)).filter(c=>c.player_id===gs.current_player_id)
    if(hand.length===1) {
      await db.query('SELECT announce_last_card($1,$2)',[r.id,gs.current_player_id])
      Object.assign(gs,await state(r))
    }
    const card=hand.find(c=>canPlay(c,gs)&&(hand.length>1||/^\d$/.test(c.card_type)))
    await command(r,gs,card)
    await invariant(r)
  }
  assert.fail('Game did not finish within 5000 actions')
})

test('NEXO has a minimum grace, rejects invalid announcements and penalizes once',async()=>{
  const r=await room(db); await db.query('SELECT start_match($1,$2)',[r.id,r.players[0]])
  await assert.rejects(db.query('SELECT announce_last_card($1,$2)',[r.id,r.players[0]]),/una carta/)
  // Return six cards to the pile, preserving all deck multiplicities.
  const hand=(await hands(r)).filter(c=>c.player_id===r.players[1])
  for(const c of hand.slice(1)) {
    await db.query("UPDATE nexo_private.piles SET draw=draw||$2::jsonb WHERE room_id=$1",[r.id,JSON.stringify([{color:c.card_color,type:c.card_type}])])
    await db.query('DELETE FROM hands WHERE id=$1',[c.id])
  }
  await db.query("UPDATE players SET nexo_available_until=clock_timestamp()+interval '5 seconds' WHERE id=$1",[r.players[1]])
  const accuse=()=>db.query('SELECT penalize_last_card($1,$2,$3) AS r',[r.id,...r.players])
  assert.equal((await accuse()).rows[0].r.cards_given,0)
  await db.query("UPDATE players SET nexo_available_until=clock_timestamp()-interval '1 second' WHERE id=$1",[r.players[1]])
  assert.equal((await accuse()).rows[0].r.cards_given,4)
  assert.equal((await accuse()).rows[0].r.cards_given,0)
  await invariant(r)
})
