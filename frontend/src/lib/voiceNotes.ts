export const MAX_VOICE_BYTES = 96000
export const VOICE_TTL = 60000
export const VOICE_COOLDOWN = 8000
export interface VoicePacket { id: string; playerId: string; audio: string; mime: string; duration: number; expiresAt: number }
// Browsers can report codec parameters with spaces and quoted values.
export function normalizeVoiceMime(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 150) return null
  const match = /^\s*(audio\/(?:webm|ogg|mp4))\s*(?:;\s*codecs\s*=\s*(?:"([a-zA-Z0-9., -]+)"|([a-zA-Z0-9., -]+)))?\s*$/i.exec(value)
  if (!match) return null
  const codec = (match[2] ?? match[3])?.trim()
  return match[1].toLowerCase() + (codec ? `;codecs=${codec}` : '')
}
export function isVoicePacket(value: unknown, playerIds: string[], now = Date.now()): value is VoicePacket {
  if (!value || typeof value !== 'object') return false
  const p = value as VoicePacket
  return typeof p.id === 'string' && p.id.length <= 80 && playerIds.includes(p.playerId)
    && typeof p.audio === 'string' && p.audio.length > 0 && p.audio.length <= Math.ceil(MAX_VOICE_BYTES / 3) * 4
    && /^[A-Za-z0-9+/]+={0,2}$/.test(p.audio) && p.audio.length % 4 === 0
    && normalizeVoiceMime(p.mime) !== null
    && Number.isFinite(p.duration) && p.duration > 0 && p.duration <= 10
    && Number.isFinite(p.expiresAt) && p.expiresAt > now && p.expiresAt <= now + VOICE_TTL + 5000
}
