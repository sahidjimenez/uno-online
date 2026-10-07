import { describe, expect, it } from 'vitest'
import { isVoicePacket, MAX_VOICE_BYTES, VOICE_TTL } from './voiceNotes'
const now = 100000
const packet = { id: 'clip-1', playerId: 'me', audio: 'YWJj', mime: 'audio/webm;codecs=opus', duration: 5, expiresAt: now + VOICE_TTL }
describe('temporary voice packets', () => {
  it('accepts a short clip from a member of the table', () => { expect(isVoicePacket(packet, ['me'], now)).toBe(true) })
  it('rejects players outside the table', () => { expect(isVoicePacket(packet, ['other'], now)).toBe(false) })
  it.each([0, -1, 11, NaN])('rejects invalid durations: %s', duration => { expect(isVoicePacket({ ...packet, duration }, ['me'], now)).toBe(false) })
  it.each([now, now - 1, now + VOICE_TTL + 6000, NaN])('rejects expired or excessive lifetimes: %s', expiresAt => { expect(isVoicePacket({ ...packet, expiresAt }, ['me'], now)).toBe(false) })
  it.each(['text/html', 'video/webm', 'audio/unknown'])('rejects unsupported mime types: %s', mime => { expect(isVoicePacket({ ...packet, mime }, ['me'], now)).toBe(false) })
  it('rejects malformed and oversized audio', () => {
    expect(isVoicePacket({ ...packet, audio: 'not-a-clip' }, ['me'], now)).toBe(false)
    expect(isVoicePacket({ ...packet, audio: 'A'.repeat(MAX_VOICE_BYTES * 2) }, ['me'], now)).toBe(false)
    expect(isVoicePacket(null, ['me'], now)).toBe(false)
  })
})
