"use client"

import { useMemo, useState } from "react"
import { formatRiskScore } from "@/lib/risk/scoring"
import type { PersonWithRiskRow } from "@/lib/supabase/queries"

type SortableKey =
  | "full_name"
  | "risk_level"
  | "risk_score"
  | "card_swipe_count"
  | "last_room_purchase_timestamp"
  | "last_updated"

type UltraQualityPersonsDataTableProps = {
  persons: PersonWithRiskRow[]
}

type EnrichedPerson = PersonWithRiskRow & {
  normalizedRiskLevel: "low" | "medium" | "high" | "unknown"
  cardSwipeCount: number
  uniqueCardCount: number
  bookings30d: number | null
  trafficEntries30d: number | null
}

const RISK_LEVEL_ORDER: Record<EnrichedPerson["normalizedRiskLevel"], number> = {
  high: 3,
  medium: 2,
  low: 1,
  unknown: 0,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function extractCardStats(cardHistory: PersonWithRiskRow["card_history"]) {
  if (!Array.isArray(cardHistory)) return { total: 0, unique: 0 }

  const uniqueCardHashes = new Set<string>()
  for (const cardEntry of cardHistory) {
    if (!isRecord(cardEntry)) continue
    const cardHash = cardEntry.card_hash
    if (typeof cardHash === "string" && cardHash.length > 0) {
      uniqueCardHashes.add(cardHash)
    }
  }

  return {
    total: cardHistory.length,
    unique: uniqueCardHashes.size,
  }
}

function readBreakdownMetric(
  scoreBreakdown: PersonWithRiskRow["score_breakdown"],
  key: "bookings_30d" | "traffic_entries_30d"
) {
  if (!isRecord(scoreBreakdown)) return null
  const raw = scoreBreakdown.raw
  if (!isRecord(raw)) return null
  return parseNumeric(raw[key])
}

function normalizeRiskLevel(level: string | null): EnrichedPerson["normalizedRiskLevel"] {
  if (!level) return "unknown"
  const lowered = level.toLowerCase()
  if (lowered === "high" || lowered === "medium" || lowered === "low") return lowered
  return "unknown"
}

function getRiskLevelClass(level: EnrichedPerson["normalizedRiskLevel"]) {
  if (level === "high") return "text-red-400"
  if (level === "medium") return "text-yellow-400"
  if (level === "low") return "text-emerald-400"
  return "text-slate-400"
}

function formatRiskLevel(level: EnrichedPerson["normalizedRiskLevel"]) {
  if (level === "unknown") return "Unknown"
  return level.charAt(0).toUpperCase() + level.slice(1)
}

function formatTimestamp(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

export function UltraQualityPersonsDataTable({ persons }: UltraQualityPersonsDataTableProps) {
  const [search, setSearch] = useState("")
  const [sortConfig, setSortConfig] = useState<{
    key: SortableKey
    direction: "asc" | "desc"
  }>({
    key: "risk_score",
    direction: "desc",
  })
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const enrichedRows = useMemo<EnrichedPerson[]>(() => {
    return persons.map((person) => {
      const { total, unique } = extractCardStats(person.card_history)
      return {
        ...person,
        normalizedRiskLevel: normalizeRiskLevel(person.risk_level),
        cardSwipeCount: total,
        uniqueCardCount: unique,
        bookings30d: readBreakdownMetric(person.score_breakdown, "bookings_30d"),
        trafficEntries30d: readBreakdownMetric(person.score_breakdown, "traffic_entries_30d"),
      }
    })
  }, [persons])

  const filtered = useMemo(() => {
    if (!search) return enrichedRows
    const term = search.toLowerCase()

    return enrichedRows.filter((person) => {
      return (
        person.full_name.toLowerCase().includes(term) ||
        person.id.toLowerCase().includes(term) ||
        person.normalizedRiskLevel.includes(term)
      )
    })
  }, [enrichedRows, search])

  const sorted = useMemo(() => {
    const { key, direction } = sortConfig

    return [...filtered].sort((left, right) => {
      let leftValue: number | string
      let rightValue: number | string

      if (key === "full_name") {
        leftValue = left.full_name.toLowerCase()
        rightValue = right.full_name.toLowerCase()
      } else if (key === "risk_level") {
        leftValue = RISK_LEVEL_ORDER[left.normalizedRiskLevel]
        rightValue = RISK_LEVEL_ORDER[right.normalizedRiskLevel]
      } else if (key === "risk_score") {
        leftValue = left.risk_score ?? -1
        rightValue = right.risk_score ?? -1
      } else if (key === "card_swipe_count") {
        leftValue = left.cardSwipeCount
        rightValue = right.cardSwipeCount
      } else if (key === "last_room_purchase_timestamp") {
        leftValue = left.last_room_purchase_timestamp
          ? new Date(left.last_room_purchase_timestamp).getTime()
          : 0
        rightValue = right.last_room_purchase_timestamp
          ? new Date(right.last_room_purchase_timestamp).getTime()
          : 0
      } else {
        leftValue = left.last_updated ? new Date(left.last_updated).getTime() : 0
        rightValue = right.last_updated ? new Date(right.last_updated).getTime() : 0
      }

      if (leftValue < rightValue) return direction === "asc" ? -1 : 1
      if (leftValue > rightValue) return direction === "asc" ? 1 : -1
      return 0
    })
  }, [filtered, sortConfig])

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sorted.slice(start, start + pageSize)
  }, [currentPage, sorted])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))

  const requestSort = (key: SortableKey) => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }

    setSortConfig({ key, direction })
    setCurrentPage(1)
  }

  const getSortIndicator = (key: SortableKey) => {
    if (sortConfig.key !== key) return "⇅"
    return sortConfig.direction === "asc" ? "↑" : "↓"
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#0f1623] p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setCurrentPage(1)
          }}
          placeholder="Search by name, person id, or risk level..."
          className="w-full rounded-md border border-white/10 bg-[#0a101b] px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-80"
          aria-label="Search persons"
        />
        <div className="text-sm text-slate-400">
          Showing {paginated.length} of {filtered.length} persons
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/[0.03]">
            <tr>
              {[
                { key: "full_name", label: "Person" },
                { key: "risk_level", label: "Risk Level" },
                { key: "risk_score", label: "Risk Score" },
                { key: "card_swipe_count", label: "Card Swipes" },
                { key: "last_room_purchase_timestamp", label: "Last Stay" },
                { key: "last_updated", label: "Risk Updated" },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  scope="col"
                  onClick={() => requestSort(key as SortableKey)}
                  className="cursor-pointer select-none px-4 py-2 text-left text-sm font-medium text-slate-300"
                >
                  <span className="inline-flex items-center">
                    {label}
                    <span className="ml-1 text-xs">{getSortIndicator(key as SortableKey)}</span>
                  </span>
                </th>
              ))}
              <th className="px-4 py-2 text-left text-sm font-medium text-slate-300">Bookings (30d)</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-slate-300">Entries (30d)</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/10">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-slate-500">
                  No persons found.
                </td>
              </tr>
            ) : (
              paginated.map((person) => (
                <tr key={person.id} className="transition-colors hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-sm text-slate-200">
                    <div className="font-semibold">{person.full_name}</div>
                    <div className="text-xs text-slate-500">{person.id.slice(0, 8)}…</div>
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-sm font-semibold ${getRiskLevelClass(person.normalizedRiskLevel)}`}
                  >
                    {formatRiskLevel(person.normalizedRiskLevel)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-200">
                    {person.risk_score === null ? "—" : formatRiskScore(person.risk_score)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-400">
                    {person.cardSwipeCount} swipes ({person.uniqueCardCount} cards)
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-400">
                    {formatTimestamp(person.last_room_purchase_timestamp)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-400">
                    {formatTimestamp(person.last_updated)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-400">
                    {person.bookings30d ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-400">
                    {person.trafficEntries30d ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-center space-x-2">
        <button
          onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          disabled={currentPage === 1}
          className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
        >
          Prev
        </button>

        {Array.from({ length: totalPages }, (_, index) => (
          <button
            key={index + 1}
            onClick={() => setCurrentPage(index + 1)}
            className={`rounded px-3 py-1 ${
              currentPage === index + 1
                ? "bg-blue-600 text-white"
                : "border border-white/15 bg-[#0a101b] text-slate-300"
            }`}
          >
            {index + 1}
          </button>
        ))}

        <button
          onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
          disabled={currentPage === totalPages}
          className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}
