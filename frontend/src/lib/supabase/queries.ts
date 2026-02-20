// TODO: Implement typed Supabase query helpers
//
// All functions accept an authenticated Supabase client (server-side) and
// return strongly-typed rows from the Database type.
//
// Functions to implement:
//
//   getRoomRisks(client)
//     → fetch all room_risk rows ordered by risk_score DESC
//
//   getRecentAlerts(client, limit = 50)
//     → fetch the most recent `limit` alerts ordered by timestamp DESC
//
//   getHotelEvents(client, roomId: string, windowMinutes = 60)
//     → fetch hotel_events for a room within the last N minutes
//
//   getCvEvents(client, roomId: string, windowMinutes = 60)
//     → fetch cv_events for a room within the last N minutes
//
//   getPersonHistory(client, personId: string)
//     → fetch person_room_history joined with room_risk for a given person
//
//   getRoomEventSummary(client, roomId: string)
//     → aggregate counts per event_type for a room in the last 24h
//
// Example usage (server component):
//   const supabase = await createServerSupabaseClient()
//   const rooms = await getRoomRisks(supabase)

import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

export type TypedClient = SupabaseClient<Database>

// TODO: implement getRoomRisks
export async function getRoomRisks(_client: TypedClient) {
  // TODO
  return []
}

// TODO: implement getRecentAlerts
export async function getRecentAlerts(_client: TypedClient, _limit = 50) {
  // TODO
  return []
}

// TODO: implement getHotelEvents
export async function getHotelEvents(
  _client: TypedClient,
  _roomId: string,
  _windowMinutes = 60
) {
  // TODO
  return []
}

// TODO: implement getCvEvents
export async function getCvEvents(
  _client: TypedClient,
  _roomId: string,
  _windowMinutes = 60
) {
  // TODO
  return []
}

// TODO: implement getPersonHistory
export async function getPersonHistory(_client: TypedClient, _personId: string) {
  // TODO
  return []
}

// TODO: implement getRoomEventSummary
export async function getRoomEventSummary(_client: TypedClient, _roomId: string) {
  // TODO
  return []
}
