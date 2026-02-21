/**
 * riskUtils.ts
 *
 * Pure helpers for deriving floor information from room IDs and
 * aggregating per-floor risk data.
 *
 * Convention: room_id = concat(floor, lpad(seq, 3, '0'))
 *   Floors 1-9  → 4-digit IDs: "1001"–"9999"  (first 1 digit = floor)
 *   Floor 10    → 5-digit IDs: "10001"–"10999" (first 2 digits = floor)
 */

import type { RoomRiskRow } from "@/types/database"

/**
 * Extract the floor number from a room ID string.
 * Falls back to floor 1 if the ID doesn't follow the convention.
 */
export function getFloorFromRoomId(roomId: string): number {
  const digits = roomId.replace(/\D/g, "")
  if (!digits || digits.length < 3) return 1
  // 5+ digits → first two digits are the floor (e.g. "10001" → 10)
  // 3-4 digits → first digit is the floor (e.g. "1001" → 1, "1100" → 1)
  return digits.length >= 5
    ? parseInt(digits.slice(0, 2), 10)
    : parseInt(digits[0], 10)
}

type RoomWithOptionalFloor = {
  room_id: string
  floor?: number
}

/**
 * Group an array of room_risk rows by their derived floor number.
 */
export function groupRoomsByFloor<T extends RoomWithOptionalFloor>(rooms: T[]): Map<number, T[]> {
  const map = new Map<number, T[]>()
  for (const room of rooms) {
    const floor = typeof room.floor === "number" ? room.floor : getFloorFromRoomId(room.room_id)
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
