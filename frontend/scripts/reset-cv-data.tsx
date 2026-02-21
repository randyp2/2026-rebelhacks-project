/**
 * Reset CV ingestion tables in Supabase via REST API.
 *
 * Deletes all rows from:
 *  - cv_risk_evidence
 *  - cv_frame_analysis
 *  - cv_video_summaries
 *  - cv_events
 *
 * Required env:
 *  - SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *  - SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)
 *
 * Run:
 *   cd frontend
 *   pnpm dlx tsx scripts/reset-cv-data.tsx
 */

type TableSpec = {
  table: string
  pkColumn: string
}

const TABLES: TableSpec[] = [
  { table: "cv_risk_evidence", pkColumn: "id" },
  { table: "cv_frame_analysis", pkColumn: "id" },
  { table: "cv_video_summaries", pkColumn: "video_id" },
  { table: "cv_events", pkColumn: "id" },
]

function requireEnv(name: string, fallbackName?: string): string {
  const value = process.env[name]?.trim()
  if (value) return value
  if (fallbackName) {
    const fallback = process.env[fallbackName]?.trim()
    if (fallback) return fallback
  }
  throw new Error(`Missing required env var: ${name}${fallbackName ? ` (or ${fallbackName})` : ""}`)
}

function buildHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  }
}

async function countRows(supabaseUrl: string, headers: HeadersInit, table: string): Promise<number> {
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`)
  url.searchParams.set("select", "*")

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      ...headers,
      Prefer: "count=exact",
      Range: "0-0",
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`count failed for ${table}: ${response.status} ${text.slice(0, 300)}`)
  }

  const contentRange = response.headers.get("content-range")
  // format: "0-0/123" or "*/0"
  const totalPart = contentRange?.split("/")[1]
  const parsed = Number(totalPart)
  return Number.isFinite(parsed) ? parsed : 0
}

async function deleteAllRows(
  supabaseUrl: string,
  headers: HeadersInit,
  table: string,
  pkColumn: string,
): Promise<void> {
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`)
  // Force a filter so delete affects all rows intentionally.
  url.searchParams.set(pkColumn, "not.is.null")

  const response = await fetch(url.toString(), {
    method: "DELETE",
    headers: {
      ...headers,
      Prefer: "return=minimal",
    },
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`delete failed for ${table}: ${response.status} ${text.slice(0, 300)}`)
  }
}

async function main(): Promise<void> {
  const supabaseUrl = requireEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL").replace(/\/+$/, "")
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY")
  const headers = buildHeaders(serviceRoleKey)

  console.log("CV data reset starting...")
  for (const { table } of TABLES) {
    const before = await countRows(supabaseUrl, headers, table)
    console.log(`  before ${table}: ${before}`)
  }

  for (const { table, pkColumn } of TABLES) {
    await deleteAllRows(supabaseUrl, headers, table, pkColumn)
  }

  console.log("CV data reset complete.")
  for (const { table } of TABLES) {
    const after = await countRows(supabaseUrl, headers, table)
    console.log(`  after  ${table}: ${after}`)
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`reset failed: ${message}`)
  process.exit(1)
})
