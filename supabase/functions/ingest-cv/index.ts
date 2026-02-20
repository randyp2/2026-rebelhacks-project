// TODO: Implement the ingest-cv Edge Function
//
// REST endpoint that accepts CV metadata from the Python pipeline.
// This is an alternative to writing directly from Python to Supabase;
// use it if you want server-side validation before insertion.
//
// Method: POST /functions/v1/ingest-cv
// Auth: disabled — uses a shared API key header instead (X-CV-API-Key)
//       to avoid requiring a user JWT from the Python process.
//
// Request body (array of cv_events):
//   [
//     {
//       "room_id": "304",
//       "person_count": 3,
//       "entry_count": 12,
//       "timestamp": "2026-03-01T01:32:00Z"
//     },
//     ...
//   ]
//
// Behavior:
//   1. Validate X-CV-API-Key header matches CV_API_KEY env var
//   2. Validate each record: room_id (string), person_count (int ≥ 0),
//      entry_count (int ≥ 0), timestamp (ISO 8601)
//   3. Batch-insert valid records into cv_events
//   4. For each unique room_id in the batch, invoke score-risk edge function
//   5. Return { inserted: number, errors: string[] }
//
// Environment variables:
//   CV_API_KEY — shared secret for Python → Edge Function auth
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import "jsr:@supabase/functions-js/edge-runtime.d.ts"

Deno.serve(async (req: Request) => {
  // TODO: implement
  // 1. Check X-CV-API-Key header
  // 2. Parse and validate body array
  // 3. Batch insert into cv_events
  // 4. Invoke score-risk for each unique room_id
  // 5. Return summary

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    )
  }

  // TODO: replace stub
  return new Response(
    JSON.stringify({ inserted: 0, errors: [] }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
})
