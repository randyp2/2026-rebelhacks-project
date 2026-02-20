// TODO: Implement client-side risk scoring display helpers
//
// NOTE: The authoritative scoring runs server-side in the Supabase Edge Function
// `score-risk` (see supabase/functions/score-risk/index.ts).
// This module contains only display-layer helpers used by the frontend.
//
// Functions to implement:
//
//   getRiskLevel(score: number): "low" | "medium" | "high" | "critical"
//     Thresholds:
//       0–4   → "low"
//       5–14  → "medium"
//       15–24 → "high"
//       25+   → "critical"
//
//   getRiskColor(level: RiskLevel): string
//     Returns a Tailwind CSS color class string for the given level.
//     e.g. "text-green-500", "text-yellow-500", "text-orange-500", "text-red-600"
//
//   formatRiskScore(score: number): string
//     Returns the score formatted to one decimal place (e.g. "12.3")
//
//   explainSignals(signals: SignalInput[]): string
//     Given a list of triggered signals, returns a human-readable
//     explanation string for the alerts table's `explanation` column.
//     e.g. "Linen spike (×3) + CV traffic anomaly (×2) + Keycard resets (×1)"

export type RiskLevel = "low" | "medium" | "high" | "critical"

export type SignalInput = {
  type: string
  frequency: number
  weight: number
}

// TODO: implement getRiskLevel
export function getRiskLevel(_score: number): RiskLevel {
  // TODO
  return "low"
}

// TODO: implement getRiskColor
export function getRiskColor(_level: RiskLevel): string {
  // TODO
  return "text-gray-500"
}

// TODO: implement formatRiskScore
export function formatRiskScore(_score: number): string {
  // TODO
  return "0.0"
}

// TODO: implement explainSignals
export function explainSignals(_signals: SignalInput[]): string {
  // TODO
  return ""
}
