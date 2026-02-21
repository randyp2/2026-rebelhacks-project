"use client"
/**
 * RoomTile
 *
 * A single cell in the 2D floor heatmap grid.
 * Fully reusable and memoized — no side effects.
 *
 * Color comes from getRiskHexColor so it matches the 3D building exactly.
 * Hover tooltip shows room_id + score.  Click opens the details panel.
 */

import { memo, useState } from "react"
import { getRiskHexColor } from "@/lib/riskColor"
import { formatRiskScore } from "@/lib/risk/scoring"
import type { EnrichedRoom } from "@/hooks/useRoomRisk"

type RoomTileProps = {
  room: EnrichedRoom
  isSelected: boolean
  isTopRiskRoom?: boolean
  isTopRiskCluster?: boolean
  onClick: (room: EnrichedRoom) => void
}

const RoomTile = memo(function RoomTile({
  room,
  isSelected,
  isTopRiskRoom = false,
  isTopRiskCluster = false,
  onClick,
}: RoomTileProps) {
  const [hovered, setHovered] = useState(false)
  const bgColor = getRiskHexColor(room.risk_score)

  return (
    <button
      type="button"
      onClick={() => onClick(room)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`Room ${room.room_id}\nRisk: ${formatRiskScore(room.risk_score)}\nUpdated: ${new Date(room.last_updated).toLocaleTimeString()}`}
      className="relative flex flex-col items-center justify-center rounded p-1.5 text-primary-foreground transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      style={{
        backgroundColor: bgColor,
        filter: hovered
          ? "brightness(1.35)"
          : isSelected
            ? "brightness(1.2)"
            : "brightness(1)",
        transform: hovered ? "scale(1.06)" : "scale(1)",
        boxShadow: [
          isSelected ? "0 0 0 2px white, 0 0 0 4px rgba(255,255,255,0.2)" : "",
          isTopRiskRoom ? "0 0 0 2px rgba(255, 75, 75, 0.95)" : "",
          isTopRiskCluster ? "0 0 0 2px rgba(253, 224, 71, 0.9) inset" : "",
        ]
          .filter(Boolean)
          .join(", "),
        minHeight: "56px",
      }}
    >
      <span className="text-[10px] font-mono font-bold leading-none opacity-90 truncate w-full text-center">
        {room.room_id}
      </span>
      <span className="text-[11px] font-mono font-bold leading-none mt-1">
        {formatRiskScore(room.risk_score)}
      </span>
    </button>
  )
})

export default RoomTile
