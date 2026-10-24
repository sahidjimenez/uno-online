import { OFFLINE_MODE } from './offline'
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL  as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!OFFLINE_MODE && (!url || !key)) {
  throw new Error('Faltan variables de entorno de Supabase para el modo multijugador')
}

export const supabase = createClient(url || 'http://127.0.0.1:54321', key || 'offline-placeholder', {
  auth: {
    persistSession: !OFFLINE_MODE,
    autoRefreshToken: !OFFLINE_MODE,
    detectSessionInUrl: !OFFLINE_MODE,
  },
})

// Iniciar sesión anónima si no existe
let sessionRequest: Promise<void> | null = null
export function ensureAnonSession() {
  if (!sessionRequest) sessionRequest = (async () => {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError) throw sessionError
    if (!session) {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) throw error
    }
  })().finally(() => { sessionRequest = null })
  return sessionRequest
}
