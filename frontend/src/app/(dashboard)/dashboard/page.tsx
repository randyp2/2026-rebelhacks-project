/**
 * DashboardPage
 *
 * 1. Fetches initial room risks + recent alerts server-side (fast first paint).
 * 2. Passes optional user profile info for header display when available.
 * 3. Hands data to DashboardClient which manages all interactivity.
 */

import { createServerSupabaseClient } from "@/utils/supabase/server"
import { getRoomRisks, getRecentAlerts } from "@/lib/supabase/queries"
import Header from "@/components/layout/Header"
import DashboardClient from "@/components/dashboard/DashboardClient"
import { MOCK_ALERTS, MOCK_ROOMS } from "@/lib/mockData"

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Parallel fetch — both queries run concurrently
  const [rooms, alerts] = await Promise.all([
    getRoomRisks(supabase).catch(() => []),
    getRecentAlerts(supabase).catch(() => []),
  ])

  const userFullName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? null

  // Use loaded alerts count for the notification badge.
  const recentAlertCount = alerts.length

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header
        title="Overview"
        userFullName={userFullName}
        userAvatarUrl={null}
        unreadAlertCount={recentAlertCount}
      />
      <DashboardClient initialRooms={rooms} initialAlerts={alerts} />
    </div>
  )
}
