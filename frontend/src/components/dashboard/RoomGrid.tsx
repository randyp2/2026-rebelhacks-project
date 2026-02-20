// TODO: Implement RoomGrid
// Grid overview of all monitored rooms, each represented by a RoomRiskCard.
//
// Props:
//   - rooms: RoomRiskRow[] — current risk scores for all rooms
//   - onRoomSelect: (roomId: string) => void — passed through to each card
//
// Behavior:
//   - Responsive CSS grid: 2 cols on mobile, 4 on tablet, 6 on desktop
//   - Sort rooms by risk_score descending so highest-risk appear first
//   - Subscribes to Supabase Realtime on `room_risk` to update scores live
//     (see useRoomRiskRealtime in lib/supabase/realtime.ts)
//   - Show an empty state message when rooms array is empty

import type { RoomRiskRow } from "@/types/database"

type RoomGridProps = {
  rooms: RoomRiskRow[]
  onRoomSelect: (roomId: string) => void
}

export default function RoomGrid(_props: RoomGridProps) {
  // TODO: implement — render a grid of <RoomRiskCard> components
  return null
}
