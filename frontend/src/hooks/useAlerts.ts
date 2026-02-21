"use client"
/**
 * useAlerts
 *
 * Thin wrapper around useAlertsRealtime for use by DashboardClient.
 * Keeps the subscription inside a single place so AlertFeed can be
 * a pure presentational component.
 */

import { useAlertsRealtime } from "@/lib/supabase/realtime"
import type { AlertRow } from "@/types/database"

export function useAlerts(initialAlerts: AlertRow[]): AlertRow[] {
  return useAlertsRealtime(initialAlerts)
}
