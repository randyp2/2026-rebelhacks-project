"use client"

import { useRiskEvidenceRealtime } from "@/lib/supabase/realtime"
import type { CvRiskEvidenceRow } from "@/types/database"

export function useRiskEvidence(initialEvidence: CvRiskEvidenceRow[]): CvRiskEvidenceRow[] {
  return useRiskEvidenceRealtime(initialEvidence)
}
