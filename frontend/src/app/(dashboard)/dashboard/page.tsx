/**
 * DashboardPage
 *
 * Streams the dashboard shell immediately and resolves Supabase-backed
 * user + risk/alert data behind a Suspense boundary to avoid blocking route
 * navigation on uncached fetches.
 */

import { Suspense } from "react"
import { createServerSupabaseClient } from "@/utils/supabase/server"
import { getDashboardRooms, getRecentAlerts } from "@/lib/supabase/queries"
import Header from "@/components/layout/Header"
import DashboardClient from "@/components/dashboard/DashboardClient"

function DashboardFallback() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header
        title="Overview"
        userFullName={null}
        userAvatarUrl={null}
        unreadAlertCount={0}
      />
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-500">
        Loading dashboard...
      </div>
    </div>
  )
}

async function DashboardPageContent() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Parallel fetch — both queries run concurrently
  const [rooms, alerts] = await Promise.all([
    getDashboardRooms(supabase).catch(() => []),
    getRecentAlerts(supabase).catch(() => []),
  ])

  const userFullName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? null

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

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardPageContent />
    </Suspense>
  )
}
