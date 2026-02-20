// TODO: Implement the seed-demo Edge Function
//
// Generates and inserts statistically realistic synthetic hotel data
// to replay during the hackathon demo. This avoids needing real hotel data.
//
// Method: POST /functions/v1/seed-demo
// Auth: requires authenticated user (JWT)
//
// Request body:
//   {
//     "rooms": 20,          // number of rooms to simulate (default: 20)
//     "hours": 24,          // hours of history to generate (default: 24)
//     "anomaly_rooms": [3, 7, 12]  // room indices that should appear anomalous
//   }
//
// Behavior:
//   1. Generate `rooms` room IDs (e.g. "101"–"120")
//   2. For each room, generate hotel_events over the last `hours`:
//        - Normal rooms: ~2 keycard events/hr, occasional linen requests
//        - Anomaly rooms: short_stay + high linen_spike + keycard_resets clustered
//   3. Generate cv_events: anomaly rooms have high person_count + entry_count spikes
//   4. Generate persons + person_room_history with some persons having prior flags
//   5. Invoke score-risk for each room to compute initial risk scores
//   6. Return { rooms_seeded: number, events_created: number }
//
// This function should be idempotent (safe to call multiple times for demo resets).

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

Deno.serve(async (_req: Request) => {
  // TODO: implement synthetic data generation

  return new Response(
    JSON.stringify({ rooms_seeded: 0, events_created: 0 }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
})
