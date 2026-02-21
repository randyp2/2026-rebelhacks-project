"use client"
/**
 * realtime.ts
 * Low-level Supabase Realtime subscription hooks.
 * Each hook subscribes exactly once per mount and cleans up on unmount.
 */

import { useState, useEffect } from "react"
import { createClient } from "@/utils/supabase/client"
import type { RoomRiskRow, AlertRow } from "@/types/database"
import type { DashboardRoom } from "@/types/dashboard"

/**
 * Keeps an array of room_risk rows live by merging INSERT/UPDATE events.
 * Rows are keyed by room_id — an incoming row replaces the existing one
 * or is appended if it's new.
 */
export function useRoomRiskRealtime(initialRooms: DashboardRoom[]): DashboardRoom[] {
  const [rooms, setRooms] = useState<DashboardRoom[]>(initialRooms)

  useEffect(() => {
    setRooms(initialRooms)
  }, [initialRooms])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("room-risk-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_risk" },
        (payload) => {
          const incoming = payload.new as RoomRiskRow
          setRooms((prev) => {
            const idx = prev.findIndex((r) => r.room_id === incoming.room_id)
            if (idx >= 0) {
              const next = [...prev]
              next[idx] = { ...incoming, floor: prev[idx].floor }
              return next
            }
            // Ignore risk rows for rooms that are not in canonical inventory.
            return prev
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, []) // intentionally empty — subscribe once per mount

  return rooms
}

/**
 * Keeps an alert list live by prepending INSERT events.
 * The list is capped at 50 entries to avoid unbounded memory growth.
 */
export function useAlertsRealtime(initialAlerts: AlertRow[]): AlertRow[] {
  const [alerts, setAlerts] = useState<AlertRow[]>(initialAlerts)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("alerts-live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts" },
        (payload) => {
          const incoming = payload.new as AlertRow
          setAlerts((prev) => [incoming, ...prev].slice(0, 50))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return alerts
}
