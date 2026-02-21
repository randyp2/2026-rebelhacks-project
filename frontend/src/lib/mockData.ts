/**
 * mockData.ts
 *
 * Placeholder data for local development and demos.
 * Replace these with real Supabase queries when ready.
 *
 * TODO: remove this file and connect to Supabase via:
 *   - getRoomRisks(supabase)   → src/lib/supabase/queries.ts
 *   - getRecentAlerts(supabase) → src/lib/supabase/queries.ts
 */

import type { RoomRiskRow, AlertRow } from "@/types/database"

// 10 floors × 50 rooms — deterministic risk scores so the heatmap
// always looks interesting and consistent across renders.
const FLOOR_COUNT = 10
const ROOMS_PER_FLOOR = 50

// Risk "personality" per floor so each floor looks distinct in the 3D view
const FLOOR_BASE_RISK: Record<number, number> = {
  1: 2,   // Lobby level — mostly quiet
  2: 6,
  3: 11,
  4: 18,  // Higher traffic floors
  5: 22,
  6: 14,
  7: 5,   // Top floor — quiet again
  8: 9,
  9: 12,
  10: 7,
}

function seededRisk(floor: number, room: number): number {
  const base = FLOOR_BASE_RISK[floor] ?? 8
  // Small room-level variance baked in — no Math.random() so values are stable
  const variance = ((floor * 13 + room * 7) % 9) - 4   // –4 … +4
  return Math.max(0, Math.min(30, base + variance))
}

export const MOCK_ROOMS: RoomRiskRow[] = Array.from(
  { length: FLOOR_COUNT },
  (_, fi) => {
    const floor = fi + 1
    return Array.from({ length: ROOMS_PER_FLOOR }, (_, ri) => {
      const roomNum = floor * 100 + (ri + 1)
      return {
        room_id: String(roomNum),
        risk_score: seededRisk(floor, ri + 1),
        last_updated: new Date(Date.now() - ri * 120_000).toISOString(),
      }
    })
  }
).flat()

// Sample alerts tied to the high-risk floors
export const MOCK_ALERTS: AlertRow[] = [
  {
    id: "a1",
    alert_type: "RISK_THRESHOLD",
    person_id: null,
    room_id: "501",
    risk_score: 24.0,
    explanation: "CV traffic anomaly + linen spike detected",
    timestamp: new Date(Date.now() - 5 * 60_000).toISOString(),
  },
  {
    id: "a2",
    alert_type: "RISK_THRESHOLD",
    person_id: null,
    room_id: "412",
    risk_score: 19.5,
    explanation: "Keycard reset (×2) + short stay pattern",
    timestamp: new Date(Date.now() - 12 * 60_000).toISOString(),
  },
  {
    id: "a3",
    alert_type: "RISK_THRESHOLD",
    person_id: null,
    room_id: "503",
    risk_score: 22.1,
    explanation: "High pedestrian entry count in last 30 min",
    timestamp: new Date(Date.now() - 18 * 60_000).toISOString(),
  },
  {
    id: "a4",
    alert_type: "RISK_THRESHOLD",
    person_id: null,
    room_id: "308",
    risk_score: 15.3,
    explanation: "Linen spike (×3) flagged",
    timestamp: new Date(Date.now() - 34 * 60_000).toISOString(),
  },
  {
    id: "a5",
    alert_type: "RISK_THRESHOLD",
    person_id: null,
    room_id: "601",
    risk_score: 16.8,
    explanation: "Short stay + keycard anomaly",
    timestamp: new Date(Date.now() - 51 * 60_000).toISOString(),
  },
]
