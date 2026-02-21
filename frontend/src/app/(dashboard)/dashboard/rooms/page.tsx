// TODO: Implement the Rooms detail page
//
// Shows a list of all rooms with their full event history and CV data.
// Each row is expandable to show:
//   - hotel_events breakdown (event_type counts in last 24h)
//   - cv_events timeline (person_count + entry_count over time)
//   - risk_score history chart (<RiskScoreChart>)
//   - person_room_history for guests associated with this room
//
// Server component:
//   1. Fetch all room_risk rows
//   2. Render <RoomGrid> in list/table view mode
export default function RoomsPage() {
  // TODO: const supabase = await createServerSupabaseClient()
  // TODO: const rooms = await getRoomRisks(supabase)

  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold">Rooms</h1>
      {/* TODO: <RoomGrid rooms={rooms} onRoomSelect={...} /> in table/list view */}
    </div>
  )
}
