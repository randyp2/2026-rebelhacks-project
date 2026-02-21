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
import type { EnrichedRoom } from "@/hooks/useRoomRisk"
import type { AlertRow } from "@/types/database"

type RoomDetailsPanelProps = {
  room: EnrichedRoom
  alerts: AlertRow[]
  tiedPeople: {
    name: string
    riskLevel: string | null
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

function normalizeExplanation(explanation: string | null): string | null {
  if (!explanation) return explanation
  if (!explanation.includes("Room risk threshold")) return explanation

  const firstPeriodIndex = explanation.indexOf(".")
  if (firstPeriodIndex === -1) return explanation

  const normalized = explanation.slice(firstPeriodIndex + 1).trim()
  return normalized.length > 0 ? normalized : explanation
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
  const formatPersonRiskLevel = (riskLevel: string | null): string =>
    riskLevel ? riskLevel.replace(/_/g, " ").toUpperCase() : "UNKNOWN"
  const getPersonRiskBadgeClass = (riskLevel: string | null): string => {
    const normalized = riskLevel?.toUpperCase() ?? ""

    if (normalized === "CRITICAL" || normalized === "VERY_HIGH") {
      return "text-red-200 bg-red-500/20 border border-red-400/40"
    }
    if (normalized === "HIGH") {
      return "text-orange-200 bg-orange-500/20 border border-orange-400/40"
    }
    if (normalized === "MEDIUM") {
      return "text-amber-200 bg-amber-500/20 border border-amber-400/40"
    }
    if (normalized === "LOW") {
      return "text-emerald-200 bg-emerald-500/20 border border-emerald-400/40"
    }
    return "text-slate-200 bg-white/10 border border-white/20"
  }

  return (
    <aside className="flex flex-col rounded-lg border border-white/10 bg-[#0f1623] overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-3 shrink-0">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Room</p>
          <p className="font-mono text-xl font-bold text-slate-100 leading-tight">
            {room.room_id}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Risk score badge */}
        <div className="rounded-lg bg-white/5 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
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
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Floor</p>
            <p className="mt-1 text-sm font-semibold text-slate-200">{room.floor}</p>
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Updated</p>
            <p className="mt-1 text-sm font-semibold text-slate-200 flex items-center gap-1">
              <Clock className="h-3 w-3 text-slate-500" />
              {timeAgo(room.last_updated)}
            </p>
          </div>
        </div>

        {/* People tied to this room */}
        {tiedPeople.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              People Tied to Room
            </p>
            <ul className="space-y-1.5">
              {tiedPeople.map((person) => (
                <li
                  key={person.name}
                  className="flex items-center justify-between rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-2"
                >
                  <span className="text-sm font-bold text-slate-100">{person.name}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${getPersonRiskBadgeClass(person.riskLevel)}`}
                  >
                    {formatPersonRiskLevel(person.riskLevel)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Alerts for this room */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3" />
            Recent Alerts
          </p>
          {roomAlerts.length === 0 ? (
            <p className="text-xs text-slate-600 italic">No recent alerts for this room.</p>
          ) : (
            <ul className="space-y-2">
              {roomAlerts.map((alert) => {
                const aLevel = getRiskLevel(alert.risk_score)
                const aColor = getRiskColor(aLevel)
                const explanation = normalizeExplanation(alert.explanation)
                return (
                  <li
                    key={alert.id}
                    className="rounded-lg border border-white/5 bg-white/[0.03] p-3 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-mono font-bold ${aColor}`}>
                        {formatRiskScore(alert.risk_score)}
                      </span>
                      <span className="text-slate-500">{timeAgo(alert.timestamp)}</span>
                    </div>
                    {explanation && (
                      <p className="text-slate-400 leading-snug">{explanation}</p>
                    )}
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
