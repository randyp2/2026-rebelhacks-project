// TODO: Implement AlertFeed
// Real-time scrollable list of threshold-breach alerts from the `alerts` table.
//
// Behavior:
//   - Subscribes to Supabase Realtime INSERT events on the `alerts` table
//     via the useAlertsRealtime hook (see lib/supabase/realtime.ts)
//   - Each alert row shows: room_id, risk_score, explanation, relative timestamp
//   - New alerts slide in at the top; cap the visible list at 50 entries
//   - Highlight rows with risk_score > 20 in red
//
// Data flow:
//   Parent (DashboardPage) fetches initial alerts and passes them in;
//   this component appends real-time additions client-side.

import type { AlertRow } from "@/types/database"

type AlertFeedProps = {
  initialAlerts: AlertRow[]
}

export default function AlertFeed(_props: AlertFeedProps) {
  // TODO: implement
  return null
}
