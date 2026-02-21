"use client"
/**
 * DashboardClient
 *
 * The interactive shell of the overview page.
 * Owns all state: selectedFloor, selectedRoom.
 * Building3D is lazy-loaded (ssr: false) to keep Three.js off the server.
 *
 * Layout (desktop):
 *   ┌──────────────────────────────────┬──────────────────┐
 *   │  3D Building with in-scene       │  RoomDetailsPanel │
 *   │  heatmap on selected floor       │  AlertFeed        │
 *   └──────────────────────────────────┴──────────────────┘
 */

import { useState, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import AlertFeed from "@/components/dashboard/AlertFeed"
import RoomDetailsPanel from "@/components/panels/RoomDetailsPanel"
import FloorHeatmap from "@/components/heatmap/FloorHeatmap"
import { useRoomRisk } from "@/hooks/useRoomRisk"
import { useAlerts } from "@/hooks/useAlerts"
import type { EnrichedRoom } from "@/hooks/useRoomRisk"
import type { RoomRiskRow, AlertRow } from "@/types/database"

// Lazy-load the Canvas so Three.js is never bundled into the server render
const Building3D = dynamic(
  () => import("@/components/building/Building3D"),
  { ssr: false, loading: () => <div className="h-72 w-full animate-pulse bg-white/5 rounded-lg" /> }
)

type Props = {
  initialRooms: RoomRiskRow[]
  initialAlerts: AlertRow[]
}

export default function DashboardClient({ initialRooms, initialAlerts }: Props) {
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<EnrichedRoom | null>(null)
  const [isFloorMapOpen, setIsFloorMapOpen] = useState(false)

  const { rooms, floorData } = useRoomRisk(initialRooms)
  const alerts = useAlerts(initialAlerts)

  const floorRooms = useMemo(
    () => (selectedFloor !== null ? rooms.filter((r) => r.floor === selectedFloor) : []),
    [rooms, selectedFloor]
  )

  const handleFloorSelect = (floor: number) => {
    // Toggle: clicking the same floor again deselects it
    setSelectedFloor((prev) => {
      const next = prev === floor ? null : floor
      if (next === null) setIsFloorMapOpen(false)
      return next
    })
    setSelectedRoom(null)
  }

  // For the 2D heatmap (receives full EnrichedRoom)
  const handleRoomSelect = (room: EnrichedRoom) => {
    setSelectedRoom((prev) => (prev?.room_id === room.room_id ? null : room))
  }

  // For the 3D building tiles (receives only roomId string)
  const handleRoomSelectById = useCallback(
    (roomId: string) => {
      const room = rooms.find((r) => r.room_id === roomId) ?? null
      if (!room) return
      setSelectedRoom((prev) => (prev?.room_id === roomId ? null : room))
    },
    [rooms]
  )

  return (
    <div className="flex min-h-0 flex-1 gap-4 p-4">
      {/* ── Left column: 3D view ── */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Building Overview
            </span>
            {selectedFloor ? (
              <>
                <span className="text-[10px] text-slate-600">
                  — Floor {selectedFloor} selected · click again to deselect
                </span>
              </>
            ) : (
              <span className="text-[10px] text-slate-700">
                — Click a floor to drill down
              </span>
            )}
          </div>
          <Building3D
            floors={floorData}
            selectedFloor={selectedFloor}
            onFloorSelect={handleFloorSelect}
            onRoomSelect={handleRoomSelectById}
          />
        </div>

        {selectedFloor !== null && isFloorMapOpen ? (
          <FloorHeatmap
            floor={selectedFloor}
            rooms={floorRooms}
            selectedRoomId={selectedRoom?.room_id ?? null}
            onRoomSelect={handleRoomSelect}
            onMinimize={() => setIsFloorMapOpen(false)}
          />
        ) : selectedFloor === null ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-white/8 py-8">
            <p className="text-xs italic text-slate-700">
              Select a floor to see the room layout
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsFloorMapOpen(true)}
            className="flex items-center justify-center rounded-lg border border-dashed border-white/15 bg-[#0f1623] py-8 text-xs font-medium text-slate-300 transition hover:bg-[#111a29] hover:text-slate-100"
          >
            Click to expand floor map
          </button>
        )}
      </div>

      {/* ── Right column: details + alert feed ── */}
      <div className="flex w-72 shrink-0 flex-col gap-4">
        {/* Room details panel (conditional) */}
        {selectedRoom && (
          <RoomDetailsPanel
            room={selectedRoom}
            alerts={alerts}
            onClose={() => setSelectedRoom(null)}
          />
        )}

        {/* Alert feed — always visible */}
        <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-white/10 bg-[#0f1623] p-4">
          <AlertFeed alerts={alerts} />
        </div>
      </div>
    </div>
  )
}
