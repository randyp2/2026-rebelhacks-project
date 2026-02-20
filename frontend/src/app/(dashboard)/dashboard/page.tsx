// TODO: Implement the main SafeStay AI dashboard page
//
// This is a server component that:
//   1. Authenticates the user (redirect to "/" if unauthenticated)
//   2. Fetches initial data via server-side Supabase queries:
//        - getRoomRisks(supabase)    → passed to <RoomGrid>
//        - getRecentAlerts(supabase) → passed to <AlertFeed>
//   3. Renders the dashboard shell with:
//        - <Header title="Overview" .../>
//        - <RoomGrid rooms={rooms} onRoomSelect={...} />
//        - <AlertFeed initialAlerts={alerts} />
//        - <RiskScoreChart .../>  (rendered for selected room; start with room 0)
//
// Layout sketch:
//   ┌─────────────────────────────────────────────┐
//   │  Header                                     │
//   ├──────────────────────┬──────────────────────┤
//   │  RoomGrid            │  AlertFeed           │
//   │  (left 2/3)          │  (right 1/3)         │
//   ├──────────────────────┴──────────────────────┤
//   │  RiskScoreChart (full width, selected room) │
//   └─────────────────────────────────────────────┘

import { createServerSupabaseClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) {
    redirect("/")
  }

  // TODO: const rooms = await getRoomRisks(supabase)
  // TODO: const alerts = await getRecentAlerts(supabase)

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* TODO: <Header title="Overview" userFullName={user.user_metadata?.full_name} userAvatarUrl={null} /> */}
      <main className="flex flex-1 gap-4 p-4">
        {/* TODO: <RoomGrid rooms={rooms} onRoomSelect={...} /> */}
        {/* TODO: <AlertFeed initialAlerts={alerts} /> */}
      </main>
      {/* TODO: <RiskScoreChart roomId={selectedRoom} data={chartData} /> */}
    </div>
  )
}
