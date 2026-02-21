<<<<<<< Updated upstream
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
=======
import { Suspense } from "react";

import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function DashboardFallback() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-9 w-full animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  );
}
>>>>>>> Stashed changes

export default function DashboardPage() {
  return (
<<<<<<< Updated upstream
    <div className="flex h-full flex-col overflow-hidden">
      <Header
        title="Overview"
        userFullName={userFullName}
        userAvatarUrl={null}
        unreadAlertCount={recentAlertCount}
      />
      <DashboardClient initialRooms={rooms} initialAlerts={alerts} />
=======
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Suspense fallback={<DashboardFallback />}>
        <DashboardContent />
      </Suspense>
>>>>>>> Stashed changes
    </div>
  )
}
