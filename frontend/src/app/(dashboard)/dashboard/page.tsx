/**
 * DashboardPage (server component)
 *
 * 1. Verifies auth — redirects to "/" on failure.
 * 2. Fetches initial room risks + recent alerts server-side (fast first paint).
 * 3. Hands data to DashboardClient which manages all interactivity.
 */

import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/utils/supabase/server"
import { getRoomRisks, getRecentAlerts } from "@/lib/supabase/queries"
import Header from "@/components/layout/Header"
import DashboardClient from "@/components/dashboard/DashboardClient"

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) redirect("/")

  // Parallel fetch — both queries run concurrently
  const [rooms, alerts] = await Promise.all([
    getRoomRisks(supabase).catch(() => []),
    getRecentAlerts(supabase).catch(() => []),
  ])

  const userFullName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? null

  // Count alerts from the last hour for the notification badge
  const oneHourAgo = Date.now() - 3_600_000
  const recentAlertCount = alerts.filter(
    (a) => new Date(a.timestamp).getTime() > oneHourAgo
  ).length

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
