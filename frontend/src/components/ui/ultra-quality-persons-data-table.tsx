"use client"

import { useMemo, useState } from "react"
import { formatRiskScore } from "@/lib/risk/scoring"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import type { PersonWithRiskRow } from "@/lib/supabase/queries"

type SortableKey =
  | "full_name"
  | "risk_level"
  | "risk_score"
  | "current_rooms"
  | "last_room_purchase_timestamp"
  | "last_updated"

type UltraQualityPersonsDataTableProps = {
  persons: PersonWithRiskRow[]
}

type EnrichedPerson = PersonWithRiskRow & {
  normalizedRiskLevel: "low" | "medium" | "high" | "unknown"
  currentRoomsCount: number
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
  return "text-muted-foreground"
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

function formatCurrentRooms(rooms: string[]) {
  if (rooms.length === 0) return "—"
  return rooms.join(", ")
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
      return {
        ...person,
        normalizedRiskLevel: normalizeRiskLevel(person.risk_level),
        currentRoomsCount: person.current_rooms.length,
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
        person.current_rooms.some((roomId) => roomId.toLowerCase().includes(term)) ||
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
      } else if (key === "current_rooms") {
        leftValue = left.currentRoomsCount
        rightValue = right.currentRoomsCount
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
  const paginationItems = useMemo<(number | "ellipsis-left" | "ellipsis-right")[]>(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1)
    }

    const items: (number | "ellipsis-left" | "ellipsis-right")[] = [1]
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)

    if (start > 2) items.push("ellipsis-left")
    for (let page = start; page <= end; page += 1) items.push(page)
    if (end < totalPages - 1) items.push("ellipsis-right")

    items.push(totalPages)
    return items
  }, [currentPage, totalPages])

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
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value)
            setCurrentPage(1)
          }}
          placeholder="Search by name, person id, room, or risk level..."
          className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-80"
          aria-label="Search persons"
        />
        <div className="text-sm text-muted-foreground">
          Showing {paginated.length} of {filtered.length} persons
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-accent/50">
            <tr>
              {[
                { key: "full_name", label: "Person" },
                { key: "risk_level", label: "Risk Level" },
                { key: "risk_score", label: "Risk Score" },
                { key: "current_rooms", label: "Current Rooms" },
                { key: "last_room_purchase_timestamp", label: "Last Stay" },
                { key: "last_updated", label: "Risk Updated" },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  scope="col"
                  onClick={() => requestSort(key as SortableKey)}
                  className="cursor-pointer select-none px-4 py-2 text-left text-sm font-medium text-foreground/90"
                >
                  <span className="inline-flex items-center">
                    {label}
                    <span className="ml-1 text-xs">{getSortIndicator(key as SortableKey)}</span>
                  </span>
                </th>
              ))}
              <th className="px-4 py-2 text-left text-sm font-medium text-foreground/90">Bookings (30d)</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-foreground/90">Entries (30d)</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No persons found.
                </td>
              </tr>
            ) : (
              paginated.map((person) => (
                <tr key={person.id} className="transition-colors hover:bg-accent/50">
                  <td className="px-4 py-3 text-sm text-foreground">
                    <div className="font-semibold">{person.full_name}</div>
                    <div className="text-xs text-muted-foreground">{person.id.slice(0, 8)}…</div>
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 text-sm font-semibold ${getRiskLevelClass(person.normalizedRiskLevel)}`}
                  >
                    {formatRiskLevel(person.normalizedRiskLevel)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-foreground">
                    {person.risk_score === null ? "—" : formatRiskScore(person.risk_score)}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-sm text-muted-foreground">
                    {formatCurrentRooms(person.current_rooms)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                    {formatTimestamp(person.last_room_purchase_timestamp)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                    {formatTimestamp(person.last_updated)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                    {person.bookings30d ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                    {person.trafficEntries30d ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={currentPage === 1}
              onClick={(event) => {
                event.preventDefault()
                if (currentPage === 1) return
                setCurrentPage((page) => Math.max(1, page - 1))
              }}
            />
          </PaginationItem>

          {paginationItems.map((item, index) => (
            <PaginationItem key={typeof item === "number" ? item : `${item}-${index}`}>
              {typeof item === "number" ? (
                <PaginationLink
                  href="#"
                  isActive={item === currentPage}
                  onClick={(event) => {
                    event.preventDefault()
                    setCurrentPage(item)
                  }}
                >
                  {item}
                </PaginationLink>
              ) : (
                <PaginationEllipsis />
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={currentPage === totalPages}
              onClick={(event) => {
                event.preventDefault()
                if (currentPage === totalPages) return
                setCurrentPage((page) => Math.min(totalPages, page + 1))
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
