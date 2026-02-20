"use client"
/**
 * FloorHeatmap
 *
 * 2D top-down grid of all rooms on a selected floor.
 * Rooms are sorted by room_id for consistent layout.
 * Uses CSS grid with auto-fill so it works across widths.
 */

import { useMemo } from "react"
import RoomTile from "./RoomTile"
import { getRiskHexColor } from "@/lib/riskColor"
import type { EnrichedRoom } from "@/hooks/useRoomRisk"

type FloorHeatmapProps = {
  floor: number
  rooms: EnrichedRoom[]
  selectedRoomId: string | null
  onRoomSelect: (room: EnrichedRoom) => void
}

const LEGEND = [
  { label: "Low",      score: 2  },
  { label: "Medium",   score: 10 },
  { label: "High",     score: 20 },
  { label: "Critical", score: 30 },
] as const

export default function FloorHeatmap({
  floor,
  rooms,
  selectedRoomId,
  onRoomSelect,
}: FloorHeatmapProps) {
  const sorted = useMemo(
    () => [...rooms].sort((a, b) => a.room_id.localeCompare(b.room_id)),
    [rooms]
  )

  return (
    <div className="rounded-lg border border-white/10 bg-[#0f1623] p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-200">Floor {floor}</span>
        <span className="text-xs text-slate-500">— {rooms.length} rooms</span>
        <span className="ml-auto text-[10px] text-slate-600 uppercase tracking-wider">
          Click room for details
        </span>
      </div>

      {/* Room grid */}
      {sorted.length > 0 ? (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))" }}
        >
          {sorted.map((room) => (
            <RoomTile
              key={room.room_id}
              room={room}
              isSelected={selectedRoomId === room.room_id}
              onClick={onRoomSelect}
            />
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-xs text-slate-500 italic">
          No rooms found on floor {floor}
        </p>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center gap-4 text-[10px] text-slate-500">
        <span className="uppercase tracking-wider">Risk</span>
        {LEGEND.map(({ label, score }) => (
          <div key={label} className="flex items-center gap-1">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: getRiskHexColor(score) }}
            />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
