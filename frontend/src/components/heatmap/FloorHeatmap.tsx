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
  onMinimize?: () => void
}

const LEGEND = [
  { label: "Low",      score: 2  },
  { label: "Medium",   score: 10 },
  { label: "High",     score: 20 },
  { label: "Critical", score: 30 },
] as const
const CLUSTER_SIZE = 5

export default function FloorHeatmap({
  floor,
  rooms,
  selectedRoomId,
  onRoomSelect,
  onMinimize,
}: FloorHeatmapProps) {
  const sorted = useMemo(
    () => [...rooms].sort((a, b) => Number(a.room_id) - Number(b.room_id)),
    [rooms]
  )
  const hottestRoomIds = useMemo(() => {
    if (!sorted.length) return new Set<string>()
    const maxRisk = Math.max(...sorted.map((r) => r.risk_score))
    return new Set(sorted.filter((r) => r.risk_score === maxRisk).map((r) => r.room_id))
  }, [sorted])

  const roomById = useMemo(
    () => new Map(sorted.map((room) => [room.room_id, room])),
    [sorted]
  )

  const hottestCluster = useMemo(() => {
    if (!sorted.length) return null

    const parseSuffix = (roomId: string): number => {
      const digits = roomId.replace(/\D/g, "")
      if (!digits) return 0
      return parseInt(digits.slice(-2), 10)
    }

    const clusterScores = new Map<number, { roomIds: string[]; totalRisk: number }>()
    for (const room of sorted) {
      const suffix = parseSuffix(room.room_id)
      const bucket = Math.floor(Math.max(suffix - 1, 0) / CLUSTER_SIZE)
      const current = clusterScores.get(bucket) ?? { roomIds: [], totalRisk: 0 }
      current.roomIds.push(room.room_id)
      current.totalRisk += room.risk_score
      clusterScores.set(bucket, current)
    }

    let topBucket = -1
    let topAverage = -1
    for (const [bucket, { roomIds, totalRisk }] of clusterScores.entries()) {
      const avg = totalRisk / roomIds.length
      if (avg > topAverage) {
        topAverage = avg
        topBucket = bucket
      }
    }
    if (topBucket < 0) return null
    const best = clusterScores.get(topBucket)
    if (!best) return null
    return { roomIds: new Set(best.roomIds), averageRisk: topAverage }
  }, [sorted])

  const hottestRoomSummary = useMemo(() => {
    const firstId = Array.from(hottestRoomIds)[0]
    if (!firstId) return null
    const room = roomById.get(firstId)
    return room ? `Room ${room.room_id} (${room.risk_score.toFixed(1)})` : null
  }, [hottestRoomIds, roomById])

  const hottestClusterSummary = useMemo(() => {
    if (!hottestCluster || hottestCluster.roomIds.size === 0) return null
    const ids = Array.from(hottestCluster.roomIds).sort((a, b) => Number(a) - Number(b))
    const first = ids[0]
    const last = ids[ids.length - 1]
    return `${first}-${last} (${hottestCluster.averageRisk.toFixed(1)} avg)`
  }, [hottestCluster])

  return (
    <div className="rounded-lg border border-white/10 bg-[#0f1623] p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-200">Floor {floor}</span>
        <span className="text-xs text-slate-500">— {rooms.length} rooms</span>
        <span className="ml-auto text-[10px] text-slate-600 uppercase tracking-wider">
          Click room for details
        </span>
        {onMinimize && (
          <button
            type="button"
            onClick={onMinimize}
            className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-slate-300 transition hover:bg-white/5"
          >
            Minimize
          </button>
        )}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
        {hottestRoomSummary && (
          <span className="rounded border border-red-400/70 bg-red-500/10 px-2 py-0.5">
            Highest-risk room: {hottestRoomSummary}
          </span>
        )}
        {hottestClusterSummary && (
          <span className="rounded border border-amber-300/70 bg-amber-500/10 px-2 py-0.5">
            Highest-risk cluster: {hottestClusterSummary}
          </span>
        )}
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
              isTopRiskRoom={hottestRoomIds.has(room.room_id)}
              isTopRiskCluster={hottestCluster?.roomIds.has(room.room_id) ?? false}
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
        <div className="flex items-center gap-1 text-slate-400">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-red-400/90" />
          <span>Top room</span>
        </div>
        <div className="flex items-center gap-1 text-slate-400">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-amber-300/90 bg-amber-300/20" />
          <span>Top cluster</span>
        </div>
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
