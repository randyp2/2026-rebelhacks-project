"use client"
/**
 * AlertFeed
 *
 * Pure presentational component — receives live alerts from the parent
 * (via useAlerts hook) rather than subscribing itself to avoid
 * duplicate Supabase channels.
 *
 * Rows with critical risk are highlighted in red.
 */

import { getRiskLevel, getRiskColor, formatRiskScore } from "@/lib/risk/scoring"
import { parseAlertExplanation } from "@/lib/risk/explanations"
import type { AlertRow } from "@/types/database"

type AlertFeedProps = {
  alerts: AlertRow[]
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1) return "just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function AlertFeed({ alerts }: AlertFeedProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Live Alerts</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {alerts.length} recent
        </span>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 space-y-2 overflow-y-auto pr-0.5">
        {alerts.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-xs italic text-muted-foreground">No alerts — all clear</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const level = getRiskLevel(alert.risk_score)
            const color = getRiskColor(level)
            const isCritical = level === "critical"
            const parsedExplanation = parseAlertExplanation(alert.explanation)

            return (
              <div
                key={alert.id}
                className={[
                  "rounded-md border p-3 text-xs transition-colors",
                  isCritical
                    ? "border-red-500/30 bg-red-950/20"
                    : "border-border bg-accent/50",
                ].join(" ")}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono font-semibold text-foreground">
                    Room {alert.room_id}
                  </span>
                  <span className={`font-mono font-bold ${color}`}>
                    {formatRiskScore(alert.risk_score)}
                  </span>
                </div>
                <p className="mb-1 leading-snug text-muted-foreground">
                  {parsedExplanation.summary}
                </p>
                <p className="text-muted-foreground">{timeAgo(alert.timestamp)}</p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
