// TODO: Implement RoomRiskCard
// Displays a single room's current risk score with color-coded severity.
//
// Props:
//   - roomId: string — the room identifier (e.g. "304")
//   - riskScore: number — aggregated weighted risk score
//   - lastUpdated: string — ISO timestamp of last score calculation
//   - onSelect?: (roomId: string) => void — optional click handler to drill into room detail
//
// Behavior:
//   - Color band: green (0–5), yellow (5–15), red (>15)
//   - Display risk score with one decimal place
//   - Show time elapsed since lastUpdated (e.g. "2m ago")
//   - Clicking the card fires onSelect with the roomId

import type { RoomRiskRow } from "@/types/database"

type RoomRiskCardProps = Pick<RoomRiskRow, "room_id" | "risk_score" | "last_updated"> & {
  onSelect?: (roomId: string) => void
}

export default function RoomRiskCard(_props: RoomRiskCardProps) {
  // TODO: implement
  return null
}
