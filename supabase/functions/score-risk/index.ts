import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "npm:@supabase/supabase-js@2"

const ALERT_THRESHOLD = Number(Deno.env.get("ALERT_THRESHOLD") ?? "15")
const HIGH_PERSON_RISK_THRESHOLD = Number(
  Deno.env.get("HIGH_PERSON_RISK_THRESHOLD") ?? "70",
)
const DEFAULT_LOOKBACK_HOURS = Number(Deno.env.get("LOOKBACK_HOURS") ?? "24")
const DEFAULT_WINDOW_MINUTES = Number(Deno.env.get("WINDOW_MINUTES") ?? "60")
const DEFAULT_LIMIT = Number(Deno.env.get("SCORE_RISK_LIMIT") ?? "100")

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Signal weights as defined in the PRD
const SIGNAL_WEIGHTS: Record<string, number> = {
  short_stay: 2,
  linen_spike: 3,
  keycard_reset: 3,
  cv_traffic_anomaly: 5,
}

type ScoreRiskRequest = {
  lookback_hours?: unknown
  window_minutes?: unknown
  room_ids?: unknown
  room_id?: unknown
  limit?: unknown
}

type PersonRiskSummary = {
  person_id: string
  risk_score: number
  risk_level: string
}

function numberOrFallback(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function intInRange(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = Math.trunc(numberOrFallback(value, fallback))
  return Math.min(max, Math.max(min, parsed))
}

function normalizeRoomIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const deduped = new Set<string>()

  for (const roomId of value) {
    if (typeof roomId !== "string") continue
    const normalized = roomId.trim()
    if (normalized) deduped.add(normalized)
  }

  return [...deduped]
}

function parseRoomHistoryRoomIds(roomHistory: unknown): string[] {
  if (!Array.isArray(roomHistory)) return []

  const deduped = new Set<string>()
  for (const entry of roomHistory) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue
    const roomId = (entry as Record<string, unknown>).room_id
    if (typeof roomId !== "string") continue
    const normalized = roomId.trim()
    if (normalized) deduped.add(normalized)
  }

  return [...deduped]
}

function toNumeric(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(
      null,
      { headers: CORS_HEADERS },
    )
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    )
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    )
  }

  const body: ScoreRiskRequest = await req.json().catch(() => ({}))
  const lookbackHours = intInRange(body.lookback_hours, DEFAULT_LOOKBACK_HOURS, 1, 168)
  const windowMinutes = intInRange(body.window_minutes, DEFAULT_WINDOW_MINUTES, 1, 1440)
  const limit = intInRange(body.limit, DEFAULT_LIMIT, 1, 500)

  const roomIdsFromArray = normalizeRoomIds(body.room_ids)
  const singleRoomId = typeof body.room_id === "string" ? body.room_id.trim() : ""
  const targetRoomIds = roomIdsFromArray.length > 0
    ? roomIdsFromArray
    : singleRoomId
    ? [singleRoomId]
    : []

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: processedRooms, error: refreshRoomError } = await supabase.rpc(
    "refresh_room_risk",
    {
      p_lookback_hours: lookbackHours,
      p_window_minutes: windowMinutes,
      p_room_ids: targetRoomIds.length > 0 ? targetRoomIds : null,
    },
  )

  if (refreshRoomError) {
    return new Response(
      JSON.stringify({ error: refreshRoomError.message }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    )
  }

  const { data: processedPersons, error: refreshPersonError } = await supabase.rpc(
    "refresh_person_risk",
  )

  if (refreshPersonError) {
    return new Response(
      JSON.stringify({ error: refreshPersonError.message }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    )
  }

  let roomQuery = supabase
    .from("room_risk")
    .select("room_id,risk_score,last_updated")
    .order("risk_score", { ascending: false })
    .limit(limit)

  if (targetRoomIds.length > 0) {
    roomQuery = roomQuery.in("room_id", targetRoomIds)
  }

  const { data: roomRows, error: roomRowsError } = await roomQuery
  if (roomRowsError) {
    return new Response(
      JSON.stringify({ error: roomRowsError.message }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    )
  }

  const { data: personRiskRows, error: personRiskError } = await supabase
    .from("person_risk")
    .select("person_id,risk_score,risk_level")
    .gte("risk_score", HIGH_PERSON_RISK_THRESHOLD)
    .order("risk_score", { ascending: false })

  if (personRiskError) {
    return new Response(
      JSON.stringify({ error: personRiskError.message }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      },
    )
  }

  const highRiskPeople = (personRiskRows ?? []).map((row) => ({
    person_id: row.person_id,
    risk_score: toNumeric(row.risk_score),
    risk_level: row.risk_level,
  }))

  const highRiskPersonById = new Map<string, PersonRiskSummary>()
  for (const person of highRiskPeople) {
    highRiskPersonById.set(person.person_id, person)
  }

  const roomToPeople = new Map<string, Map<string, PersonRiskSummary>>()
  if (highRiskPeople.length > 0) {
    const personIds = highRiskPeople.map((person) => person.person_id)
    const { data: roomHistoryRows, error: roomHistoryError } = await supabase
      .from("person_room_history")
      .select("person_id,room_history")
      .in("person_id", personIds)

    if (roomHistoryError) {
      return new Response(
        JSON.stringify({ error: roomHistoryError.message }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        },
      )
    }

    for (const row of roomHistoryRows ?? []) {
      const person = highRiskPersonById.get(row.person_id)
      if (!person) continue

      const roomIds = parseRoomHistoryRoomIds(row.room_history)
      for (const roomId of roomIds) {
        if (!roomToPeople.has(roomId)) {
          roomToPeople.set(roomId, new Map<string, PersonRiskSummary>())
        }
        roomToPeople.get(roomId)?.set(person.person_id, person)
      }
    }
  }

  const topRooms = (roomRows ?? []).map((room) => {
    const topPeopleForRoom = [
      ...(roomToPeople.get(room.room_id)?.values() ?? []),
    ]
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 5)

    return {
      room_id: room.room_id,
      risk_score: toNumeric(room.risk_score),
      last_updated: room.last_updated,
      top_persons: topPeopleForRoom,
    }
  })

  return new Response(
    JSON.stringify({
      processed_rooms: Number(processedRooms ?? 0),
      processed_persons: Number(processedPersons ?? 0),
      alert_threshold: ALERT_THRESHOLD,
      high_person_risk_threshold: HIGH_PERSON_RISK_THRESHOLD,
      top_rooms: topRooms,
    }),
    {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    },
  )
})

// Exported for testing
export {
  ALERT_THRESHOLD,
  DEFAULT_LOOKBACK_HOURS,
  DEFAULT_LIMIT,
  DEFAULT_WINDOW_MINUTES,
  HIGH_PERSON_RISK_THRESHOLD,
  SIGNAL_WEIGHTS,
}
