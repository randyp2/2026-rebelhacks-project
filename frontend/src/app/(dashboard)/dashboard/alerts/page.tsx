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
//   1. Fetch recent alert rows.
//   2. Render a table of currently alerted rooms (latest alert per room).
import { UltraQualityDataTable } from "@/components/ui/ultra-quality-data-table"
import { getRecentAlerts } from "@/lib/supabase/queries"
import { createServerSupabaseClient } from "@/utils/supabase/server"

export default async function AlertsPage() {
  const supabase = await createServerSupabaseClient()
  const alerts = await getRecentAlerts(supabase, 500).catch(() => [])

  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold">Alerts</h1>
      <UltraQualityDataTable alerts={alerts} />
    </div>
  )
}
