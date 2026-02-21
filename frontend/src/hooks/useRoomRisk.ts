"use client"
/**
 * useRoomRisk
 *
 * Top-level hook consumed by DashboardClient.
 * Wraps the raw Realtime subscription and computes derived shape:
 *   - enrichedRooms: each room tagged with its derived floor number
 *   - floorData:     per-floor aggregates (averageRisk, room list) sorted ascending
 */

import { useMemo } from "react"
import { useRoomRiskRealtime } from "@/lib/supabase/realtime"
import { groupRoomsByFloor, getFloorAverageRisk, getFloorFromRoomId } from "@/lib/riskUtils"
import type { RoomRiskRow } from "@/types/database"

/** RoomRiskRow enriched with a pre-computed floor number. */
export type EnrichedRoom = RoomRiskRow & { floor: number }

/** Aggregated per-floor data used by Building3D. */
export type FloorData = {
  floor: number
  averageRisk: number
  rooms: RoomRiskRow[]
}

export function useRoomRisk(initialRooms: RoomRiskRow[]): {
  rooms: EnrichedRoom[]
  floorData: FloorData[]
} {
  const liveRooms = useRoomRiskRealtime(initialRooms)

  const rooms = useMemo<EnrichedRoom[]>(
    () => liveRooms.map((r) => ({ ...r, floor: getFloorFromRoomId(r.room_id) })),
    [liveRooms]
  )

  const floorData = useMemo<FloorData[]>(() => {
    const grouped = groupRoomsByFloor(liveRooms)
    return Array.from(grouped.entries())
      .map(([floor, floorRooms]) => ({
        floor,
        averageRisk: getFloorAverageRisk(floorRooms),
        rooms: floorRooms,
      }))
      .sort((a, b) => a.floor - b.floor)
  }, [liveRooms])

  return { rooms, floorData }
}
