import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL  as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  throw new Error('Faltan variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

// Debug: verificar que las vars llegaron bien (solo en dev o si hay error)
if (import.meta.env.DEV) {
  console.log('[supabase] URL:', url)
  console.log('[supabase] KEY length:', key.length, '| starts:', key.substring(0, 20))
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Iniciar sesión anónima si no existe
export async function ensureAnonSession() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    await supabase.auth.signInAnonymously()
  }
}
