// Display-layer risk helpers — authoritative scoring lives in the score-risk Edge Function.

export type RiskLevel = "low" | "medium" | "high" | "critical"

export type SignalInput = {
  type: string
  frequency: number
  weight: number
}

/** Map a numeric risk score to a severity bucket. */
export function getRiskLevel(score: number): RiskLevel {
  if (score >= 25) return "critical"
  if (score >= 15) return "high"
  if (score >= 5) return "medium"
  return "low"
}

/** Tailwind text-color class for a given risk level. */
export function getRiskColor(level: RiskLevel): string {
  switch (level) {
    case "critical": return "text-red-500"
    case "high":     return "text-orange-400"
    case "medium":   return "text-yellow-400"
    case "low":      return "text-emerald-400"
  }
}

/** Format score to one decimal place (e.g. 12.3). */
export function formatRiskScore(score: number): string {
  return score.toFixed(1)
}

/**
 * Convert a list of triggered signals into a human-readable sentence.
 * e.g. "Linen spike (×3) + CV traffic anomaly (×1)"
 */
export function explainSignals(signals: SignalInput[]): string {
  if (!signals.length) return "No signals triggered"
  return signals
    .filter((s) => s.frequency > 0)
    .sort((a, b) => b.weight * b.frequency - a.weight * a.frequency)
    .map((s) => {
      const label = s.type.replace(/_/g, " ")
      return `${label.charAt(0).toUpperCase() + label.slice(1)} (×${s.frequency})`
    })
    .join(" + ")
}
