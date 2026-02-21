/**
 * queries.ts
 * Typed Supabase query helpers used by server components and API routes.
 * All functions accept an authenticated Supabase client and throw on error.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  Database,
  RoomRiskRow,
  AlertRow,
  HotelEventRow,
  CvEventRow,
  PersonRow,
  PersonRiskRow,
  PersonRoomHistoryRow,
} from "@/types/database"

export type TypedClient = SupabaseClient<Database>

/** All rooms ordered by risk score descending. */
export async function getRoomRisks(client: TypedClient): Promise<RoomRiskRow[]> {
  const { data, error } = await client
    .from("room_risk")
    .select("*")
    .order("risk_score", { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Most recent alerts, newest first. */
export async function getRecentAlerts(
  client: TypedClient,
  limit = 50
): Promise<AlertRow[]> {
  const { data, error } = await client
    .from("alerts")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

/** Hotel events for a room within the last N minutes, newest first. */
export async function getHotelEvents(
  client: TypedClient,
  roomId: string,
  windowMinutes = 60
): Promise<HotelEventRow[]> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString()
  const { data, error } = await client
    .from("hotel_events")
    .select("*")
    .eq("room_id", roomId)
    .gte("timestamp", since)
    .order("timestamp", { ascending: false })
  if (error) throw error
  return data ?? []
}

/** CV events for a room within the last N minutes, newest first. */
export async function getCvEvents(
  client: TypedClient,
  roomId: string,
  windowMinutes = 60
): Promise<CvEventRow[]> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString()
  const { data, error } = await client
    .from("cv_events")
    .select("*")
    .eq("room_id", roomId)
    .gte("timestamp", since)
    .order("timestamp", { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Full stay history for a person, newest first. */
export async function getPersonHistory(
  client: TypedClient,
  personId: string
): Promise<PersonRoomHistoryRow[]> {
  const { data, error } = await client
    .from("person_room_history")
    .select("*")
    .eq("person_id", personId)
    .order("purchase_timestamp", { ascending: false })
  if (error) throw error
  return data ?? []
}

export type PersonWithRiskRow = {
  id: PersonRow["id"]
  full_name: PersonRow["full_name"]
  last_room_purchase_timestamp: PersonRow["last_room_purchase_timestamp"]
  card_history: PersonRow["card_history"]
  current_rooms: string[]
  risk_level: PersonRiskRow["risk_level"] | null
  risk_score: number | null
  last_updated: PersonRiskRow["last_updated"] | null
  score_breakdown: PersonRiskRow["score_breakdown"] | null
}

function extractCurrentRooms(historyRows: PersonRoomHistoryRow[]): string[] {
  const latestByRoomId = new Map<string, number>()

  for (const row of historyRows) {
    if (!Array.isArray(row.room_history)) continue

    for (const entry of row.room_history) {
      if (!entry || typeof entry !== "object") continue

      const roomId = "room_id" in entry && typeof entry.room_id === "string" ? entry.room_id : null
      if (!roomId) continue

      const timestamp =
        "timestamp" in entry && typeof entry.timestamp === "string"
          ? Date.parse(entry.timestamp)
          : Number.NaN
      const sortableTimestamp = Number.isFinite(timestamp) ? timestamp : 0

      const existing = latestByRoomId.get(roomId) ?? -1
      if (sortableTimestamp > existing) {
        latestByRoomId.set(roomId, sortableTimestamp)
      }
    }
  }

  return Array.from(latestByRoomId.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([roomId]) => roomId)
}

/** Persons merged with risk profile metadata. */
export async function getPersonsWithRisk(client: TypedClient): Promise<PersonWithRiskRow[]> {
  const [personsResult, risksResult, roomHistoryResult] = await Promise.all([
    client.from("persons").select("*").order("full_name", { ascending: true }),
    client.from("person_risk").select("*"),
    client.from("person_room_history").select("*"),
  ])

  if (personsResult.error) throw personsResult.error
  if (risksResult.error) throw risksResult.error
  if (roomHistoryResult.error) throw roomHistoryResult.error

  const risksByPersonId = new Map<string, PersonRiskRow>()
  for (const risk of risksResult.data ?? []) {
    risksByPersonId.set(risk.person_id, risk)
  }

  const roomHistoryByPersonId = new Map<string, PersonRoomHistoryRow[]>()
  for (const historyRow of roomHistoryResult.data ?? []) {
    const existingRows = roomHistoryByPersonId.get(historyRow.person_id) ?? []
    existingRows.push(historyRow)
    roomHistoryByPersonId.set(historyRow.person_id, existingRows)
  }

  return (personsResult.data ?? [])
    .map((person) => {
      const risk = risksByPersonId.get(person.id)
      const currentRooms = extractCurrentRooms(roomHistoryByPersonId.get(person.id) ?? [])
      return {
        id: person.id,
        full_name: person.full_name,
        last_room_purchase_timestamp: person.last_room_purchase_timestamp,
        card_history: person.card_history,
        current_rooms: currentRooms,
        risk_level: risk?.risk_level ?? null,
        risk_score: risk ? Number(risk.risk_score) : null,
        last_updated: risk?.last_updated ?? null,
        score_breakdown: risk?.score_breakdown ?? null,
      }
    })
    .sort((left, right) => {
      const riskDelta = (right.risk_score ?? -1) - (left.risk_score ?? -1)
      if (riskDelta !== 0) return riskDelta
      return left.full_name.localeCompare(right.full_name)
    })
}

/** Aggregated event-type counts for a room in the last 24 hours. */
export async function getRoomEventSummary(
  client: TypedClient,
  roomId: string
): Promise<{ event_type: string; count: number }[]> {
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString()
  const { data, error } = await client
    .from("hotel_events")
    .select("event_type")
    .eq("room_id", roomId)
    .gte("timestamp", since)
  if (error) throw error

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.event_type] = (counts[row.event_type] ?? 0) + 1
  }
  return Object.entries(counts).map(([event_type, count]) => ({ event_type, count }))
}
