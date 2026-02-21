"use client"
/**
 * useCvIngestToast
 *
 * Subscribes to cv_frame_analysis INSERT events via Supabase Realtime.
 * Fires a branded HotelGuard toast exactly once per unique video_id —
 * the first frame triggers it; all subsequent frames for the same video are silent.
 */

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"

type FrameRow = {
  video_id: string
  room_id: string
  camera_id?: string | null
}

function GeminiToast({ shortId, roomLabel, cameraLabel }: {
  shortId: string
  roomLabel: string | null
  cameraLabel: string | null
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        background: "#0f1623",
        border: "1px solid rgba(37,99,235,0.35)",
        borderLeft: "3px solid #2563eb",
        borderRadius: "0.625rem",
        padding: "14px 16px",
        width: "340px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.55)",
      }}
    >
      {/* Scan icon with pulsing indicator */}
      <div style={{ position: "relative", flexShrink: 0, marginTop: "1px" }}>
        <span
          style={{
            position: "absolute",
            top: "-3px",
            right: "-3px",
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "#2563eb",
            boxShadow: "0 0 6px #2563eb",
          }}
        />
        {/* ScanEye icon (inline SVG from lucide) */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2563eb"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 7V5a2 2 0 0 1 2-2h2" />
          <path d="M17 3h2a2 2 0 0 1 2 2v2" />
          <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
          <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
          <circle cx="12" cy="12" r="1" />
          <path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0" />
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 600,
            color: "#f1f5f9",
            letterSpacing: "0.01em",
          }}
        >
          Gemini AI Analyzing
        </p>
        <p
          style={{
            margin: "3px 0 0",
            fontSize: "12px",
            color: "#94a3b8",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ fontFamily: "ui-monospace, monospace", color: "#64748b" }}>
            {shortId}
          </span>
          {roomLabel && (
            <>
              {" · "}
              <span style={{ color: "#60a5fa" }}>{roomLabel}</span>
            </>
          )}
          {cameraLabel && (
            <span style={{ color: "#475569" }}> · {cameraLabel}</span>
          )}
        </p>
      </div>
    </div>
  )
}

export function useCvIngestToast(): void {
  const seenVideoIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel("cv-ingest-toast")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cv_frame_analysis" },
        (payload) => {
          const row = payload.new as FrameRow
          if (!row.video_id || seenVideoIds.current.has(row.video_id)) return
          seenVideoIds.current.add(row.video_id)

          const shortId = row.video_id.slice(0, 16)
          const roomLabel = row.room_id ? `Room ${row.room_id}` : null
          const cameraLabel = row.camera_id ?? null

          toast.custom(() => (
            <GeminiToast
              shortId={shortId}
              roomLabel={roomLabel}
              cameraLabel={cameraLabel}
            />
          ), { duration: 7000 })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])
}
