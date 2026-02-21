"use client"

import { useMemo, useState } from "react"
import { formatRiskScore, getRiskColor, getRiskLevel } from "@/lib/risk/scoring"
import { parseAlertExplanation } from "@/lib/risk/explanations"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import type { AlertRow } from "@/types/database"

type SortableKey = "room_id" | "risk_score" | "timestamp"

type AlertTableRow = AlertRow & {
  tied_person_names?: string[]
}

type UltraQualityDataTableProps = {
  alerts: AlertTableRow[]
}

export function UltraQualityDataTable({ alerts }: UltraQualityDataTableProps) {
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

  const currentRoomAlerts = useMemo(() => {
    // Keep the latest alert per room to represent currently alerted rooms.
    const latestByRoom = new Map<string, AlertTableRow>()

    for (const alert of alerts) {
      const roomKey = alert.room_id ?? `unassigned:${alert.id}`
      const existing = latestByRoom.get(roomKey)
      if (!existing) {
        latestByRoom.set(roomKey, alert)
        continue
      }

      if (new Date(alert.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
        latestByRoom.set(roomKey, alert)
      }
    }

    return Array.from(latestByRoom.values())
  }, [alerts])

  const filtered = useMemo(() => {
    if (!search) return currentRoomAlerts
    const term = search.toLowerCase()

    return currentRoomAlerts.filter(
      (alert) =>
        (alert.room_id ?? "").toLowerCase().includes(term) ||
        (alert.tied_person_names ?? []).some((name) => name.toLowerCase().includes(term)) ||
        (alert.explanation ?? "").toLowerCase().includes(term)
    )
  }, [currentRoomAlerts, search])

  const sorted = useMemo(() => {
    const { key, direction } = sortConfig

    return [...filtered].sort((a, b) => {
      let left: number | string
      let right: number | string

      if (key === "timestamp") {
        left = new Date(a.timestamp).getTime()
        right = new Date(b.timestamp).getTime()
      } else if (key === "room_id") {
        left = a.room_id ?? ""
        right = b.room_id ?? ""
      } else {
        left = a.risk_score
        right = b.risk_score
      }

      if (left < right) return direction === "asc" ? -1 : 1
      if (left > right) return direction === "asc" ? 1 : -1
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
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setCurrentPage(1)
          }}
          placeholder="Search by room id, tied person, or explanation..."
          className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 sm:w-72"
          aria-label="Search alerted rooms"
        />
        <div className="text-sm text-muted-foreground">
          Showing {paginated.length} of {filtered.length} alerted rooms
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-accent/50">
            <tr>
              {[
                { key: "room_id", label: "Room" },
                { key: "risk_score", label: "Risk Score" },
                { key: "tied_persons", label: "Tied Persons" },
                { key: "timestamp", label: "Last Alert" },
              ].map(({ key, label }) => (
                <th
                  key={key}
                  scope="col"
                  onClick={key === "tied_persons" ? undefined : () => requestSort(key as SortableKey)}
                  className={`select-none px-4 py-2 text-left text-sm font-medium text-foreground/90 ${
                    key === "tied_persons" ? "" : "cursor-pointer"
                  }`}
                >
                  <span className="inline-flex items-center">
                    {label}
                    {key !== "tied_persons" && (
                      <span className="ml-1 text-xs">{getSortIndicator(key as SortableKey)}</span>
                    )}
                  </span>
                </th>
              ))}
              <th className="px-4 py-2 text-left text-sm font-medium text-foreground/90">
                Explanation
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No alerted rooms found.
                </td>
              </tr>
            ) : (
              paginated.map((alert) => {
                const riskLevel = getRiskLevel(alert.risk_score)
                const riskColor = getRiskColor(riskLevel)
                const parsedExplanation = parseAlertExplanation(alert.explanation)

                return (
                  <tr key={alert.id} className="transition-colors hover:bg-accent/50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-foreground">
                      {alert.room_id ?? "Unassigned"}
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 text-sm font-semibold ${riskColor}`}>
                      {formatRiskScore(alert.risk_score)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground/90">
                      {alert.tied_person_names && alert.tied_person_names.length > 0
                        ? alert.tied_person_names.join(", ")
                        : "No linked person"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                      {new Date(alert.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      <div className="space-y-1">
                        <p className="text-foreground/90">{parsedExplanation.summary}</p>
                        {parsedExplanation.details.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {parsedExplanation.details.map((line, index) => (
                              <div key={`${alert.id}-detail-${index}`}>{line}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
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
