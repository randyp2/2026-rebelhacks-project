/**
 * DashboardPage
 *
 * Streams the dashboard shell immediately and resolves Supabase-backed
 * user + risk/alert data behind a Suspense boundary to avoid blocking route
 * navigation on uncached fetches.
 */

import { Suspense } from "react"
import { createServerSupabaseClient } from "@/utils/supabase/server"
import {
  getDashboardRooms,
  getPersonsWithRisk,
  getRecentAlerts,
  type PersonWithRiskRow,
} from "@/lib/supabase/queries"
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
  type TiedPerson = {
    name: string
    riskLevel: PersonWithRiskRow["risk_level"]
  }

  function buildRoomToPeople(persons: PersonWithRiskRow[]): Record<string, TiedPerson[]> {
    const roomToPeopleByName = new Map<string, Map<string, TiedPerson>>()

    for (const person of persons) {
      for (const roomId of person.current_rooms) {
        if (!roomToPeopleByName.has(roomId)) {
          roomToPeopleByName.set(roomId, new Map<string, TiedPerson>())
        }

        roomToPeopleByName.get(roomId)?.set(person.full_name, {
          name: person.full_name,
          riskLevel: person.risk_level,
        })
      }
    }

    const roomToPeople: Record<string, TiedPerson[]> = {}
    for (const [roomId, peopleByName] of roomToPeopleByName.entries()) {
      roomToPeople[roomId] = Array.from(peopleByName.values()).sort((left, right) =>
        left.name.localeCompare(right.name)
      )
    }

    return roomToPeople
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Parallel fetch — both queries run concurrently
  const [rooms, alerts, persons] = await Promise.all([
    getDashboardRooms(supabase).catch(() => []),
    getRecentAlerts(supabase).catch(() => []),
    getPersonsWithRisk(supabase).catch(() => []),
  ])
  const roomToPeople = buildRoomToPeople(persons)

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
      <DashboardClient
        initialRooms={rooms}
        initialAlerts={alerts}
        initialRoomToPeople={roomToPeople}
      />
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
