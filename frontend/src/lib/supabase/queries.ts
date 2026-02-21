/**
 * queries.ts
 * Typed Supabase query helpers used by server components and API routes.
 * All functions accept an authenticated Supabase client and throw on error.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  Database,
  RoomRiskRow,
  RoomRow,
  AlertRow,
  HotelEventRow,
  CvEventRow,
  PersonRow,
  PersonRiskRow,
  PersonRoomHistoryRow,
} from "@/types/database"
import type { DashboardRoom } from "@/types/dashboard"

export type TypedClient = SupabaseClient<Database>

const PAGE_SIZE = 1000

type PagedResult<T> = {
  data: T[] | null
  error: unknown
}

async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PagedResult<T>>
): Promise<T[]> {
  const rows: T[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1
    const result = await fetchPage(from, to)
    if (result.error) throw result.error

    const batch = result.data ?? []
    rows.push(...batch)

    if (batch.length < PAGE_SIZE) break
  }

  return rows
}

/** All rooms ordered by risk score descending. */
export async function getRoomRisks(client: TypedClient): Promise<RoomRiskRow[]> {
  const { data, error } = await client
    .from("room_risk")
    .select("*")
    .order("risk_score", { ascending: false })
  if (error) throw error
  return data ?? []
}

/**
 * Canonical room inventory joined with the latest room_risk snapshot.
 * The rooms table defines building structure (floor count + total room tiles),
 * while room_risk only overlays dynamic risk data.
 */
export async function getDashboardRooms(client: TypedClient): Promise<DashboardRoom[]> {
  const [roomsResult, roomRiskResult] = await Promise.all([
    client
      .from("rooms")
      .select("room_id,floor,is_active")
      .eq("is_active", true)
      .order("floor", { ascending: true })
      .order("room_id", { ascending: true })
      .limit(10000), // override Supabase's default 1000-row cap
    client.from("room_risk").select("room_id,risk_score,last_updated").limit(10000),
  ])

  if (roomsResult.error) throw roomsResult.error
  if (roomRiskResult.error) throw roomRiskResult.error

  const rooms = (roomsResult.data ?? []) as Pick<RoomRow, "room_id" | "floor" | "is_active">[]
  const roomRiskRows = roomRiskResult.data ?? []
  const riskByRoomId = new Map(roomRiskRows.map((row) => [row.room_id, row]))

  return rooms.map((room) => {
    const risk = riskByRoomId.get(room.room_id)
    return {
      room_id: room.room_id,
      floor: room.floor,
      risk_score: risk?.risk_score ?? 0,
      last_updated: risk?.last_updated ?? new Date(0).toISOString(),
    }
  })
}

/** Most recent alerts, newest first. */
export async function getRecentAlerts(
  client: TypedClient,
  limit = 50
): Promise<AlertRow[]> {
  const HIGH_RISK_THRESHOLD = 10

  const [alertsResult, roomRiskResult, roomsResult] = await Promise.all([
    client
      .from("alerts")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit),
    client.from("room_risk").select("room_id,risk_score,last_updated").limit(10000),
    client.from("rooms").select("room_id,is_active").eq("is_active", true).limit(10000),
  ])

  if (alertsResult.error) throw alertsResult.error
  if (roomRiskResult.error) throw roomRiskResult.error
  if (roomsResult.error) throw roomsResult.error

  const dbAlerts = alertsResult.data ?? []
  const roomRiskRows = roomRiskResult.data ?? []
  const activeRoomRows = roomsResult.data ?? []

  const activeRoomIds = new Set(activeRoomRows.map((row) => row.room_id))
  const activeRoomDbAlerts = dbAlerts.filter(
    (alert) => !alert.room_id || activeRoomIds.has(alert.room_id)
  )

  // Canonicalize to latest alert per room so all dashboard views read the same
  // "current room alert" state (instead of each component deduping differently).
  const latestDbAlertByRoom = new Map<string, AlertRow>()
  const unassignedAlerts: AlertRow[] = []
  for (const alert of activeRoomDbAlerts) {
    if (!alert.room_id) {
      unassignedAlerts.push(alert)
      continue
    }
    const existing = latestDbAlertByRoom.get(alert.room_id)
    if (
      !existing ||
      new Date(alert.timestamp).getTime() > new Date(existing.timestamp).getTime()
    ) {
      latestDbAlertByRoom.set(alert.room_id, alert)
    }
  }

  const roomIdsWithDbAlerts = new Set(latestDbAlertByRoom.keys())

  // Keep the UI consistent with the 3D heatmap: if a room is high risk in room_risk
  // but has no explicit alert row yet, synthesize a derived alert entry.
  const syntheticRiskAlerts: AlertRow[] = roomRiskRows
    .filter((row) => activeRoomIds.has(row.room_id))
    .filter((row) => row.risk_score >= HIGH_RISK_THRESHOLD)
    .filter((row) => !roomIdsWithDbAlerts.has(row.room_id))
    .map((row) => ({
      id: `derived-risk-${row.room_id}`,
      alert_type: "RISK_THRESHOLD",
      room_id: row.room_id,
      person_id: null,
      risk_score: row.risk_score,
      timestamp: row.last_updated,
      explanation: "High room risk score from aggregated heatmap signals",
    }))

  return [...latestDbAlertByRoom.values(), ...syntheticRiskAlerts, ...unassignedAlerts].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
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
  const [persons, risks, roomHistoryRows] = await Promise.all([
    fetchAllRows<PersonRow>((from, to) =>
      client
        .from("persons")
        .select("*")
        .order("full_name", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAllRows<PersonRiskRow>((from, to) =>
      client.from("person_risk").select("*").order("person_id", { ascending: true }).range(from, to)
    ),
    fetchAllRows<PersonRoomHistoryRow>((from, to) =>
      client
        .from("person_room_history")
        .select("*")
        .order("person_id", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ])

  const risksByPersonId = new Map<string, PersonRiskRow>()
  for (const risk of risks) {
    risksByPersonId.set(risk.person_id, risk)
  }

  const roomHistoryByPersonId = new Map<string, PersonRoomHistoryRow[]>()
  for (const historyRow of roomHistoryRows) {
    const existingRows = roomHistoryByPersonId.get(historyRow.person_id) ?? []
    existingRows.push(historyRow)
    roomHistoryByPersonId.set(historyRow.person_id, existingRows)
  }

  return persons
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
