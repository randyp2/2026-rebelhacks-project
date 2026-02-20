"use client"
// TODO: Implement Supabase Realtime subscription hooks
//
// These are client-side React hooks that subscribe to Supabase Realtime channels
// and return live-updated state. Each hook cleans up its channel on unmount.
//
// Hooks to implement:
//
//   useRoomRiskRealtime(initialRooms: RoomRiskRow[]): RoomRiskRow[]
//     - Subscribes to postgres_changes on room_risk (INSERT, UPDATE)
//     - Merges incoming rows into state keyed by room_id
//     - Used by RoomGrid to keep scores current without a full refetch
//
//   useAlertsRealtime(initialAlerts: AlertRow[]): AlertRow[]
//     - Subscribes to postgres_changes on alerts (INSERT)
//     - Prepends new alerts to the list, caps at 50 entries
//     - Used by AlertFeed
//
// Channel naming convention: "room-risk-live", "alerts-live"
//
// Supabase client: import { createBrowserSupabaseClient } from "@/utils/supabase/client"

import type { RoomRiskRow, AlertRow } from "@/types/database"

// TODO: implement useRoomRiskRealtime
export function useRoomRiskRealtime(_initialRooms: RoomRiskRow[]): RoomRiskRow[] {
  // TODO: useState + useEffect with supabase.channel(...).on(...).subscribe()
  return _initialRooms
}

// TODO: implement useAlertsRealtime
export function useAlertsRealtime(_initialAlerts: AlertRow[]): AlertRow[] {
  // TODO: useState + useEffect with supabase.channel(...).on(...).subscribe()
  return _initialAlerts
}
