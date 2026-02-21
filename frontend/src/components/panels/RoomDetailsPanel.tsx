"use client"
/**
 * RoomDetailsPanel
 *
 * Slide-in side panel shown when the user clicks a room tile.
 * Displays: risk score + level, floor, last_updated, tied people, and up to 10 recent alerts.
 */

import { useMemo } from "react"
import { X, Clock, AlertTriangle, Users } from "lucide-react"
import {
  getRiskLevel,
  getRiskColor,
  formatRiskScore,
} from "@/lib/risk/scoring"
import { parseAlertExplanation } from "@/lib/risk/explanations"
import type { EnrichedRoom } from "@/hooks/useRoomRisk"
import type { AlertRow } from "@/types/database"

type RoomDetailsPanelProps = {
  room: EnrichedRoom
  alerts: AlertRow[]
  tiedPeople: {
    name: string
    riskLevel: string | null
    riskScore: number | null
  }[]
  onClose: () => void
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

export default function RoomDetailsPanel({
  room,
  alerts,
  tiedPeople,
  onClose,
}: RoomDetailsPanelProps) {
  const roomAlerts = useMemo(
    () => alerts.filter((a) => a.room_id === room.room_id).slice(0, 10),
    [alerts, room.room_id]
  )

  const level = getRiskLevel(room.risk_score)
  const levelColor = getRiskColor(level)
  const resolvePersonRiskLevel = (riskScore: number | null, riskLevel: string | null) => {
    if (riskScore !== null && Number.isFinite(riskScore)) return getRiskLevel(riskScore)
    const normalized = riskLevel?.toUpperCase() ?? ""
    if (normalized === "VERY_HIGH") return "critical"
    if (normalized === "CRITICAL") return "critical"
    if (normalized === "HIGH") return "high"
    if (normalized === "MEDIUM") return "medium"
    if (normalized === "LOW") return "low"
    return "unknown"
  }

  const formatPersonRiskLevel = (level: string): string =>
    level === "unknown" ? "UNKNOWN" : level.toUpperCase()

  const getPersonRiskBadgeClass = (level: string): string => {
    if (level === "critical") {
      return "text-red-200 bg-red-500/20 border border-red-400/40"
    }
    if (level === "high") {
      return "text-orange-200 bg-orange-500/20 border border-orange-400/40"
    }
    if (level === "medium") {
      return "text-amber-200 bg-amber-500/20 border border-amber-400/40"
    }
    if (level === "low") {
      return "text-emerald-200 bg-emerald-500/20 border border-emerald-400/40"
    }
    return "text-foreground bg-accent/40 border border-border"
  }

  return (
    <aside className="flex flex-col rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Room</p>
          <p className="font-mono text-xl font-bold text-foreground leading-tight">
            {room.room_id}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Risk score badge */}
        <div className="rounded-lg bg-accent/40 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Current Risk Score
          </p>
          <p className={`font-mono text-4xl font-bold ${levelColor}`}>
            {formatRiskScore(room.risk_score)}
          </p>
          <span
            className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${levelColor} bg-current/10`}
          >
            {level}
          </span>
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-accent/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Floor</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{room.floor}</p>
          </div>
          <div className="rounded-lg bg-accent/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Updated</p>
            <p className="mt-1 text-sm font-semibold text-foreground flex items-center gap-1">
              <Clock className="h-3 w-3 text-muted-foreground" />
              {timeAgo(room.last_updated)}
            </p>
          </div>
        </div>

        {/* People tied to this room */}
        {tiedPeople.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              People Tied to Room
            </p>
            <ul className="space-y-1.5">
              {tiedPeople.map((person) => {
                const resolvedLevel = resolvePersonRiskLevel(
                  person.riskScore,
                  person.riskLevel
                )

                return (
                  <li
                    key={person.name}
                    className="flex items-center justify-between rounded-md border border-border bg-accent/50 px-2.5 py-2"
                  >
                    <span className="text-sm font-bold text-foreground">{person.name}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${getPersonRiskBadgeClass(
                        resolvedLevel
                      )}`}
                    >
                      {formatPersonRiskLevel(resolvedLevel)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Alerts for this room */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" />
            Recent Alerts
          </p>
          {roomAlerts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No recent alerts for this room.</p>
          ) : (
            <ul className="space-y-2">
              {roomAlerts.map((alert) => {
                const aLevel = getRiskLevel(alert.risk_score)
                const aColor = getRiskColor(aLevel)
                const explanation = parseAlertExplanation(alert.explanation)
                return (
                  <li
                    key={alert.id}
                    className="rounded-lg border border-border bg-accent/50 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-mono font-bold ${aColor}`}>
                        {formatRiskScore(alert.risk_score)}
                      </span>
                      <span className="text-muted-foreground">{timeAgo(alert.timestamp)}</span>
                    </div>
                    <p className="text-muted-foreground leading-snug">
                      {explanation.summary}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </aside>
  )
}
