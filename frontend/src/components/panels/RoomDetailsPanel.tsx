"use client"
/**
 * RoomDetailsPanel
 *
 * Slide-in side panel shown when the user clicks a room tile.
 * Displays: risk score + level, floor, last_updated, and up to 10 recent alerts.
 */

import { useMemo } from "react"
import { X, Clock, AlertTriangle } from "lucide-react"
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

export default function RoomDetailsPanel({ room, alerts, onClose }: RoomDetailsPanelProps) {
  const roomAlerts = useMemo(
    () => alerts.filter((a) => a.room_id === room.room_id).slice(0, 10),
    [alerts, room.room_id]
  )

  const level = getRiskLevel(room.risk_score)
  const levelColor = getRiskColor(level)

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
                    {alert.explanation && (
                      <p className="text-slate-400 leading-snug">{alert.explanation}</p>
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
