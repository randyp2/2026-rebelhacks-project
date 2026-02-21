"use client"
/**
 * RiskScoreChart
 *
 * Recharts time-series line chart for a single room's risk history.
 * Red dashed reference line marks the alert threshold (15).
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"

const ALERT_THRESHOLD = 15

type RiskDataPoint = {
  timestamp: string
  risk_score: number
}

type RiskScoreChartProps = {
  roomId: string
  data: RiskDataPoint[]
}

function fmtTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export default function RiskScoreChart({ roomId, data }: RiskScoreChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-border bg-accent/40">
        <p className="text-xs italic text-muted-foreground">No history for room {roomId}</p>
      </div>
    )
  }

  const chartData = data.map((d) => ({ time: fmtTime(d.timestamp), score: d.risk_score }))

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-[10px] uppercase tracking-wider text-muted-foreground">
        Risk history — Room {roomId}
      </p>
      <ResponsiveContainer width="100%" height={110}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="time"
            tick={{ fontSize: 9, fill: "#475569" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: "#475569" }}
            tickLine={false}
            axisLine={false}
            width={26}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1e2535",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "6px",
              fontSize: "11px",
              color: "#cbd5e1",
            }}
            cursor={{ stroke: "rgba(255,255,255,0.08)" }}
          />
          {/* Alert threshold marker */}
          <ReferenceLine
            y={ALERT_THRESHOLD}
            stroke="#ef4444"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#3b82f6"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "#60a5fa" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
