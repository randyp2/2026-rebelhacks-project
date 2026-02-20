// TODO: Implement the Alerts page
//
// Full-page view of the alerts feed with filtering and sorting.
//
// Features:
//   - Filter by room_id, risk_score threshold, and date range
//   - Sort by timestamp (default: newest first) or risk_score
//   - Paginate: 25 alerts per page
//   - Each alert row links to the associated room detail
//   - Export to CSV button (TODO: implement client-side CSV download)
//
// Server component:
//   1. Authenticate user
//   2. Fetch initial alerts via getRecentAlerts(supabase, 25)
//   3. Pass to <AlertFeed> which handles realtime additions client-side

import { createServerSupabaseClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export default async function AlertsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) redirect("/")

  // TODO: const alerts = await getRecentAlerts(supabase, 25)

  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold">Alerts</h1>
      {/* TODO: filter controls */}
      {/* TODO: <AlertFeed initialAlerts={alerts} /> */}
    </div>
  )
}
