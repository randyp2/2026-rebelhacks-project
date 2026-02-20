// TODO: Implement the Persons page
//
// Lists all persons in the database with their stay history and risk context.
//
// Features:
//   - Search by full_name
//   - Each row shows: full_name, last stay date, number of past stays,
//     number of flagged stays (was_flagged_dangerous = true)
//   - Clicking a row expands person_room_history with risk scores at time of stay
//   - Privacy note: no biometric data is shown — name + booking history only
//
// Server component:
//   1. Authenticate user
//   2. Fetch persons ordered by last_room_purchase_timestamp DESC

import { createServerSupabaseClient } from "@/utils/supabase/server"
import { redirect } from "next/navigation"

export default async function PersonsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (!user || error) redirect("/")

  // TODO: fetch persons from supabase

  return (
    <div className="p-4">
      <h1 className="mb-4 text-2xl font-bold">Persons</h1>
      {/* TODO: search input */}
      {/* TODO: persons table with expandable rows */}
    </div>
  )
}
