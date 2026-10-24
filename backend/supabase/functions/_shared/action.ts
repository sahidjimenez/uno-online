import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.100.0'
import { corsResponse, json, err } from './cors.ts'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Client = SupabaseClient
type Body = Record<string, unknown> & { room_id: string; player_id: string; request_id: string }

/** Every privileged endpoint derives ownership from a verified JWT. */
export function action(handler: (db: Client, body: Body) => Promise<Response>, accuser = false) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return corsResponse()
    if (req.method !== 'POST') return err('Método no permitido', 405)
    try {
      const token = req.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
      if (!token) return err('Sesión requerida', 401)
      const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      const { data, error } = await db.auth.getUser(token)
      if (error || !data.user) return err('Sesión inválida', 401)
      const { error: limited } = await db.rpc('check_action_rate', { p_user: data.user.id })
      if (limited) return err('Demasiadas solicitudes; espera un momento', 429)
      if (Number(req.headers.get('content-length') ?? 0) > 4096) return err('Solicitud demasiado grande', 413)
      const reader = req.body?.getReader()
      if (!reader) return err('Solicitud inválida')
      let size = 0
      const chunks: Uint8Array[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > 4096) { await reader.cancel(); return err('Solicitud demasiado grande', 413) }
        chunks.push(value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
      let body: Body
      try { body = JSON.parse(new TextDecoder().decode(bytes)) } catch { return err('JSON inválido') }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return err('Solicitud inválida')
      if (accuser) body.player_id = body.accuser_id as string
      if (![body.room_id, body.player_id, body.request_id].every(value => typeof value === 'string' && uuid.test(value))) return err('Identificadores inválidos')
      if ('card_id' in body && (typeof body.card_id !== 'string' || !uuid.test(body.card_id))) return err('Carta inválida')
      if ('accused_id' in body && (typeof body.accused_id !== 'string' || !uuid.test(body.accused_id))) return err('Jugador inválido')
      if ('version' in body && (!Number.isSafeInteger(body.version) || Number(body.version) < 0)) return err('Versión inválida')
      const { data: player } = await db.from('players').select('id').eq('id', body.player_id).eq('room_id', body.room_id).eq('user_id', data.user.id).single()
      if (!player) return err('Jugador no autorizado', 403)
      return await handler(db, body)
    } catch (error) {
      // No bodies, tokens or card contents in diagnostics.
      console.error('game_action_failed', error instanceof Error ? error.name : 'UnknownError')
      return err('No pudimos procesar la acción', 500)
    }
  }
}

export function rpcResult(data: unknown, error: { code?: string; message: string } | null) {
  if (!error) return json(data ?? { ok: true })
  if (error.code === '40001') return err('Estado desactualizado; actualiza la mesa', 409)
  if (error.code === 'P0001') return err(error.message, 400)
  return err('No pudimos confirmar la acción', 400)
}
