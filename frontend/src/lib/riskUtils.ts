/**
 * riskUtils.ts
 *
 * Pure helpers for deriving floor information from room IDs and
 * aggregating per-floor risk data.
 *
 * Convention: room_id leading digits encode the floor.
 *   "101" → floor 1   "215" → floor 2   "1001" → floor 10
 */

import type { RoomRiskRow } from "@/types/database"

/**
 * Extract the floor number from a room ID string.
 * Falls back to floor 1 if the ID doesn't follow the convention.
 */
export function getFloorFromRoomId(roomId: string): number {
  const digits = roomId.replace(/\D/g, "")
  if (!digits || digits.length < 3) return 1
  // 3-digit → first digit is floor; 4-digit → first two digits
  return digits.length >= 4
    ? parseInt(digits.slice(0, 2), 10)
    : parseInt(digits[0], 10)
}

/**
 * Group an array of room_risk rows by their derived floor number.
 */
export function groupRoomsByFloor(rooms: RoomRiskRow[]): Map<number, RoomRiskRow[]> {
  const map = new Map<number, RoomRiskRow[]>()
  for (const room of rooms) {
    const floor = getFloorFromRoomId(room.room_id)
    if (!map.has(floor)) map.set(floor, [])
    map.get(floor)!.push(room)
  }
  return map
}

/**
 * Compute the mean risk score for a set of rooms on one floor.
 * Returns 0 for an empty array.
 */
export function getFloorAverageRisk(rooms: RoomRiskRow[]): number {
  if (!rooms.length) return 0
  const total = rooms.reduce((sum, r) => sum + r.risk_score, 0)
  return total / rooms.length
}
