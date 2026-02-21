"use client"

import { useVideoSummariesRealtime } from "@/lib/supabase/realtime"
import type { CvVideoSummaryRow } from "@/types/database"

export function useVideoAlerts(initialSummaries: CvVideoSummaryRow[]): CvVideoSummaryRow[] {
  return useVideoSummariesRealtime(initialSummaries)
}
