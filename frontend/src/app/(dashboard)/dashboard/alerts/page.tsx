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
import type { AlertRow } from "@/types/database"

function normalizeExplanation(explanation: string | null): string | null {
  if (!explanation) return explanation
  if (!explanation.includes("Room risk threshold")) return explanation

  const firstPeriodIndex = explanation.indexOf(".")
  if (firstPeriodIndex === -1) return explanation

  const normalized = explanation.slice(firstPeriodIndex + 1).trim()
  return normalized.length > 0 ? normalized : explanation
}

function normalizeAlert(alert: AlertRow): AlertRow {
  return {
    ...alert,
    explanation: normalizeExplanation(alert.explanation),
  }
}

export default async function AlertsPage() {
  const supabase = await createServerSupabaseClient()
  const alerts = await getRecentAlerts(supabase, 500).catch(() => [])
  const normalizedAlerts = alerts.map(normalizeAlert)

  return (
    <div className="h-full overflow-auto p-4">
      <h1 className="mb-4 text-2xl font-bold">Alerts</h1>
      <UltraQualityDataTable alerts={normalizedAlerts} />
    </div>
  )
}
