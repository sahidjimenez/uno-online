export const MAX_VOICE_BYTES = 96000
export const VOICE_TTL = 60000
export const VOICE_COOLDOWN = 8000
export interface VoicePacket { id: string; playerId: string; audio: string; mime: string; duration: number; expiresAt: number }
export function isVoicePacket(value: unknown, playerIds: string[], now = Date.now()): value is VoicePacket {
  if (!value || typeof value !== 'object') return false
  const p = value as VoicePacket
  return typeof p.id === 'string' && p.id.length <= 80 && playerIds.includes(p.playerId)
    && typeof p.audio === 'string' && p.audio.length > 0 && p.audio.length <= Math.ceil(MAX_VOICE_BYTES / 3) * 4
    && /^[A-Za-z0-9+/]+={0,2}$/.test(p.audio) && p.audio.length % 4 === 0
    && typeof p.mime === 'string' && /^audio\/(webm|ogg|mp4)(;codecs=[a-zA-Z0-9., -]+)?$/.test(p.mime)
    && Number.isFinite(p.duration) && p.duration > 0 && p.duration <= 10
    && Number.isFinite(p.expiresAt) && p.expiresAt > now && p.expiresAt <= now + VOICE_TTL + 5000
}
