// TODO: Implement the score-risk Edge Function
//
// Triggered by:
//   a) POST /functions/v1/score-risk  (called by the CV ingestor after each flush)
//   b) Supabase Database Webhook on hotel_events INSERT (optional: set up in dashboard)
//
// Request body:
//   { "room_id": "304" }
//
// Behavior:
//   1. Query hotel_events for this room in the last 60-minute rolling window
//      and count occurrences per event_type
//   2. Query cv_events for the latest entry_count and person_count
//   3. Apply weighted scoring formula:
//        Risk Score = Σ(weight × frequency × time_decay)
//      Weights (from PRD):
//        short_stay       → 2
//        linen_spike      → 3
//        keycard_reset    → 3
//        cv_traffic_anomaly → 5
//      time_decay: linear decay over 60 min (events in last 10 min = weight ×1.0,
//                  events 10–30 min ago = ×0.7, 30–60 min ago = ×0.4)
//   4. Upsert into room_risk: { room_id, risk_score, last_updated: now() }
//   5. If risk_score >= ALERT_THRESHOLD (default: 15), insert into alerts:
//        { room_id, risk_score, explanation, timestamp }
//      Build explanation string from triggered signals.
//   6. Return { room_id, risk_score, alerted: boolean }
//
// Environment variables (set in Supabase dashboard):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ALERT_THRESHOLD

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const ALERT_THRESHOLD = Number(Deno.env.get("ALERT_THRESHOLD") ?? "15")

// Signal weights as defined in the PRD
const SIGNAL_WEIGHTS: Record<string, number> = {
  short_stay: 2,
  linen_spike: 3,
  keycard_reset: 3,
  cv_traffic_anomaly: 5,
}

Deno.serve(async (req: Request) => {
  // TODO: implement
  // 1. Parse { room_id } from request body
  // 2. Create Supabase service-role client
  // 3. Query hotel_events + cv_events
  // 4. Compute risk_score with time decay
  // 5. Upsert room_risk
  // 6. Conditionally insert alert
  // 7. Return JSON response

  const body = await req.json().catch(() => ({}))
  const room_id: string | undefined = body?.room_id

  if (!room_id) {
    return new Response(
      JSON.stringify({ error: "room_id is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  // TODO: replace stub with real scoring logic
  const risk_score = 0
  const alerted = false

  return new Response(
    JSON.stringify({ room_id, risk_score, alerted }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
})

// Exported for testing
export { ALERT_THRESHOLD, SIGNAL_WEIGHTS }
