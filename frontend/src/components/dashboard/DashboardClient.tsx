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
 *   │  3D Building (top)               │  RoomDetailsPanel │
 *   │  FloorHeatmap (when floor set)   │  NotificationList │
 *   └──────────────────────────────────┴──────────────────┘
 */

import { useState, useMemo } from "react"
import dynamic from "next/dynamic"
import { NotificationList } from "@/components/animate-ui/components/community/notification-list"
import FloorHeatmap from "@/components/heatmap/FloorHeatmap"
import RoomDetailsPanel from "@/components/panels/RoomDetailsPanel"
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

  const { rooms, floorData } = useRoomRisk(initialRooms)
  const alerts = useAlerts(initialAlerts)

  // Rooms on the currently selected floor
  const floorRooms = useMemo(
    () => (selectedFloor !== null ? rooms.filter((r) => r.floor === selectedFloor) : []),
    [rooms, selectedFloor]
  )

  const handleFloorSelect = (floor: number) => {
    // Toggle: clicking the same floor again deselects it
    setSelectedFloor((prev) => (prev === floor ? null : floor))
    setSelectedRoom(null)
  }

  const handleRoomSelect = (room: EnrichedRoom) => {
    // Toggle: clicking the same room again closes the panel
    setSelectedRoom((prev) => (prev?.room_id === room.room_id ? null : room))
  }

  return (
    <div className="flex min-h-0 flex-1 gap-4 p-4">
      {/* ── Left column: 3D view + heatmap ── */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* 3D Building */}
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Building Overview
            </span>
            {selectedFloor ? (
              <span className="text-[10px] text-slate-600">
                — Floor {selectedFloor} selected · click again to deselect
              </span>
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
          />
        </div>

        {/* 2D Floor Heatmap (shown when a floor is selected) */}
        {selectedFloor !== null ? (
          <FloorHeatmap
            floor={selectedFloor}
            rooms={floorRooms}
            selectedRoomId={selectedRoom?.room_id ?? null}
            onRoomSelect={handleRoomSelect}
          />
        ) : (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-white/8 py-8">
            <p className="text-xs italic text-slate-700">
              Select a floor to see the room layout
            </p>
          </div>
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

        {/* Alert list — always visible */}
        <div className="flex min-h-0 flex-1 flex-col">
          <NotificationList alerts={alerts} />
        </div>
      </div>
    </div>
  )
}
