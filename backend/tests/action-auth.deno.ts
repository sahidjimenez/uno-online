import { action } from '../supabase/functions/_shared/action.ts'
const assert = { equal(actual: unknown, expected: unknown) { if (!Object.is(actual, expected)) throw new Error(`Expected ${expected}, received ${actual}`) } }

Deno.test('HTTP guard rejects missing/invalid tokens, impersonation, malformed input and overload', async () => {
  const user = crypto.randomUUID(), player = crypto.randomUUID(), room = crypto.randomUUID()
  let limited = false, executions = 0
  // Local Auth/PostgREST transport double: exercises the real Supabase client,
  // not a substitute for validating a deployed Supabase JWT configuration.
  const controller = new AbortController()
  const server = Deno.serve({ hostname: '127.0.0.1', port: 0, signal: controller.signal, onListen() {} }, req => {
    const url = new URL(req.url)
    const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
    if (url.pathname === '/auth/v1/user') return req.headers.get('authorization') === 'Bearer valid'
      ? reply({ id: user, aud: 'authenticated', role: 'authenticated' }) : reply({ message: 'Invalid token' }, 401)
    if (url.pathname === '/rest/v1/rpc/check_action_rate') return limited ? reply({ code: 'P0001', message: 'limited' }, 400) : reply(null)
    if (url.pathname === '/rest/v1/players') return url.searchParams.get('id') === `eq.${player}` && url.searchParams.get('room_id') === `eq.${room}` && url.searchParams.get('user_id') === `eq.${user}`
      ? reply({ id: player }) : reply({ code: 'PGRST116', message: 'not found' }, 406)
    return reply({}, 404)
  })
  Deno.env.set('SUPABASE_URL', `http://127.0.0.1:${server.addr.port}`)
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key')
  const handler = action(async () => { executions++; return new Response('{}') })
  const body = { room_id: room, player_id: player, request_id: crypto.randomUUID() }
  const request = (token: string | null, value: unknown = body, method = 'POST') => new Request('http://localhost/action', {
    method, headers: token ? { authorization: `Bearer ${token}` } : {}, body: method === 'POST' ? JSON.stringify(value) : undefined,
  })
  const check = async (req: Request, status: number) => { const result = await handler(req); assert.equal(result.status, status); await result.text() }
  try {
    await check(request(null), 401)
    await check(request('invalid'), 401)
    await check(request('valid', { ...body, player_id: crypto.randomUUID() }), 403)
    await check(request('valid', { ...body, room_id: crypto.randomUUID() }), 403)
    await check(request('valid', { ...body, version: '1' }), 400)
    await check(request('valid', null), 400)
    await check(request('valid', { ...body, padding: 'x'.repeat(5000) }), 413)
    await check(request('valid', body, 'GET'), 405)
    await check(request('valid'), 200)
    limited = true
    await check(request('valid'), 429)
    assert.equal(executions, 1)
  } finally { controller.abort(); await server.finished }
})
