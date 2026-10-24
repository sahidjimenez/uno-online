// Opt-in only. Creates disposable users and a game in an explicitly isolated
// Supabase project. Never reads the application's .env or production URL.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
const require = createRequire(new URL('../../frontend/package.json', import.meta.url))
const { createClient } = require('@supabase/supabase-js')
const ts = require('typescript')
const source = await readFile(new URL('../supabase/functions/_shared/rules.ts', import.meta.url), 'utf8')
const { canPlay } = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`)
const url = process.env.NEXO_STAGING_URL, key = process.env.NEXO_STAGING_ANON_KEY
if (!url || !key || process.env.NEXO_STAGING_CONFIRM_ISOLATED !== 'yes') {
  throw new Error('Set NEXO_STAGING_URL, NEXO_STAGING_ANON_KEY and NEXO_STAGING_CONFIRM_ISOLATED=yes for an isolated project. No requests were sent.')
}
const clients = [0, 1].map(() => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }))
async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args)
  if (error || data?.error) throw new Error(`${name}: ${error?.message ?? data.error}`)
  return data
}
async function invoke(client, name, body) {
  const { data, error } = await client.functions.invoke(name, { body: { request_id: crypto.randomUUID(), ...body } })
  if (error || data?.error) throw new Error(`${name}: failed (${error?.context?.status ?? 'application'})`)
  return data
}
let pulse
try {
  for (const client of clients) {
    const { error } = await client.auth.signInAnonymously()
    if (error) throw error
  }
  const password = crypto.randomUUID()
  const room = await rpc(clients[0], 'create_room', { player_name: 'QA host', p_is_private: true, p_password: password })
  const guest = await rpc(clients[1], 'join_room', { p_code: room.room_code, player_name: 'QA guest', p_password: password })
  const ids = [room.player_id, guest.player_id]
  assert.notEqual(ids[0], ids[1])
  const spoof = await clients[1].functions.invoke('start-game', { body: { room_id: room.room_id, player_id: ids[0], request_id: crypto.randomUUID() } })
  assert.ok(spoof.error, 'Impersonating the host must fail')
  let eventSeen = false
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Realtime subscription timeout')), 12000)
    clients[1].channel(`qa:${room.room_id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_state', filter: `room_id=eq.${room.room_id}` }, () => { eventSeen = true })
      .subscribe(status => { if (status === 'SUBSCRIBED') { clearTimeout(timer); resolve() } })
  })
  pulse = setInterval(() => clients.forEach((client, i) => { void client.rpc('heartbeat', { p_player_id: ids[i] }) }), 10000)
  await invoke(clients[0], 'start-game', { room_id: room.room_id, player_id: ids[0] })
  await invoke(clients[0], 'start-game', { room_id: room.room_id, player_id: ids[0] })
  const snapshots = () => Promise.all(clients.map(client => rpc(client, 'room_snapshot', { p_room: room.room_id })))
  let rounds = await snapshots()
  assert.ok(rounds.every(s => s.myHand.length === 7))
  const rejoined = await rpc(clients[1], 'reconnect_player', { p_code: room.room_code })
  assert.equal(rejoined.player_id, ids[1])
  for (let turn = 0; turn < 3000; turn++) {
    rounds = await snapshots()
    assert.equal(rounds[0].gameState.version, rounds[1].gameState.version)
    assert.equal(rounds[0].gameState.current_player_id, rounds[1].gameState.current_player_id)
    for (let i = 0; i < 2; i++) {
      assert.ok(rounds[i].myHand.every(c => c.player_id === ids[i]))
      assert.equal(rounds[1-i].players.find(p => p.id === ids[i]).hand_count, rounds[i].myHand.length)
    }
    if (rounds[0].gameState.status === 'finished') {
      assert.ok(eventSeen, 'No Realtime update was received')
      assert.equal(rounds[0].gameState.winner_id, rounds[1].gameState.winner_id)
      console.log('PASS: independent anonymous users, protected room, authorization, start retry, private hands, counts, reconnection, Realtime and full game.')
      break
    }
    assert.ok(turn < 2999, 'Match did not finish')
    const actor = ids.indexOf(rounds[0].gameState.current_player_id)
    let snapshot = rounds[actor]
    if (snapshot.myHand.length === 1 && !snapshot.players.find(p => p.id === ids[actor]).has_called_uno) {
      await invoke(clients[actor], 'call-uno', { room_id: room.room_id, player_id: ids[actor] })
      snapshot = await rpc(clients[actor], 'room_snapshot', { p_room: room.room_id })
    }
    const card = snapshot.myHand.find(c => canPlay(c, snapshot.gameState) && (snapshot.myHand.length > 1 || /^\d$/.test(c.card_type)))
    await invoke(clients[actor], card ? 'play-card' : 'draw-card', {
      room_id: room.room_id, player_id: ids[actor], version: snapshot.gameState.version,
      ...(card ? { card_id: card.id, chosen_color: 'blue' } : {}),
    })
    // Respect the production action limit; this is a smoke test, not a load test.
    await new Promise(resolve => setTimeout(resolve, 1200))
  }
} finally {
  clearInterval(pulse)
  await Promise.all(clients.map(client => client.removeAllChannels()))
}
