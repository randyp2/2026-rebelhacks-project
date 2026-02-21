/**
 * DashboardPage
 *
 * Currently running in DEMO MODE — uses local placeholder data.
 *
 * TODO: restore Supabase auth + data fetching:
 *   1. Uncomment the auth block below
 *   2. Replace MOCK_ROOMS / MOCK_ALERTS with getRoomRisks / getRecentAlerts
 *   3. Delete src/lib/mockData.ts once Supabase tables are populated
 */

// TODO (step 1): uncomment when Supabase auth is ready
// import { redirect } from "next/navigation"
// import { createServerSupabaseClient } from "@/utils/supabase/server"
// import { getRoomRisks, getRecentAlerts } from "@/lib/supabase/queries"

import { MOCK_ROOMS, MOCK_ALERTS } from "@/lib/mockData"
import Header from "@/components/layout/Header"
import DashboardClient from "@/components/dashboard/DashboardClient"

export default async function DashboardPage() {
  // TODO (step 1): replace mock data block with this once Supabase is wired up:
  //
  // const supabase = await createServerSupabaseClient()
  // const { data: { user }, error } = await supabase.auth.getUser()
  // if (!user || error) redirect("/")
  //
  // const [rooms, alerts] = await Promise.all([
  //   getRoomRisks(supabase).catch(() => []),
  //   getRecentAlerts(supabase).catch(() => []),
  // ])
  //
  // const userFullName = (user.user_metadata?.full_name as string) ?? user.email ?? null
  // const oneHourAgo = Date.now() - 3_600_000
  // const recentAlertCount = alerts.filter(
  //   (a) => new Date(a.timestamp).getTime() > oneHourAgo
  // ).length

  const rooms = MOCK_ROOMS
  const alerts = MOCK_ALERTS
  const userFullName = "Demo User"
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
