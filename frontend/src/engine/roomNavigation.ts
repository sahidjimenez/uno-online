export const TABLE_RADIUS = 2.6
export const ROOM_LIMIT = 8.4

/** Keep a walking camera inside the room and outside the table and chairs. */
export function canWalkTo(x: number, z: number, seats: number): boolean {
  if (Math.abs(x) > ROOM_LIMIT || Math.abs(z) > ROOM_LIMIT) return false
  if (Math.hypot(x, z) < TABLE_RADIUS + 0.32) return false
  for (let i = 0; i < seats; i++) {
    const angle = i * Math.PI * 2 / seats
    if (Math.hypot(x - Math.sin(angle) * 3.3, z - Math.cos(angle) * 3.3) < 0.65) return false
  }
  return true
}
