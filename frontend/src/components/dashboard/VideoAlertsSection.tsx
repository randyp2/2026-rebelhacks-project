"use client"

import { useEffect, useRef, useState } from "react"
import { Activity, Clock3, Film, ScanSearch, ShieldAlert, X } from "lucide-react"

import { useRiskEvidence } from "@/hooks/useRiskEvidence"
import { useVideoAlerts } from "@/hooks/useVideoAlerts"
import { createClient } from "@/utils/supabase/client"
import type { CvRiskEvidenceRow, CvVideoSummaryRow } from "@/types/database"

type IngestProgress = { stage: 'uploading' | 'analyzing' | 'finalizing' }

type VideoAlertsSectionProps = {
	initialSummaries: CvVideoSummaryRow[]
	initialEvidence: CvRiskEvidenceRow[]
}

type RiskStyle = {
	leftBorder: string
	cardBg: string
	badge: string
	dot: string
	pulse: boolean
}

function getRiskStyle(level: string): RiskStyle {
	const l = level.toLowerCase()
	if (l === "high")
		return {
			leftBorder: "border-l-red-500",
			cardBg: "bg-red-950/10",
			badge: "border-red-500/30 bg-red-500/10 text-red-400",
			dot: "bg-red-500",
			pulse: true,
		}
	if (l === "medium")
		return {
			leftBorder: "border-l-amber-500",
			cardBg: "bg-amber-950/10",
			badge: "border-amber-500/30 bg-amber-500/10 text-amber-400",
			dot: "bg-amber-500",
			pulse: false,
		}
	return {
		leftBorder: "border-l-emerald-500",
		cardBg: "",
		badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
		dot: "bg-emerald-500",
		pulse: false,
	}
}

function formatPercent(score: number): string {
	return `${Math.round(score * 100)}%`
}

function extractPatterns(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value.filter(
		(item): item is string => typeof item === "string" && item.trim().length > 0,
	)
}

function extractSignals(value: unknown): string[] {
	if (!Array.isArray(value)) return []
	return value.filter(
		(item): item is string => typeof item === "string" && item.trim().length > 0,
	)
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

function splitSentences(value: string): string[] {
	return value
		.split(/(?<=[.!?])\s+/)
		.map((item) => item.trim())
		.filter((item) => item.length > 0)
}

function resolveAssociatedRoomId(
	summary: CvVideoSummaryRow,
	evidenceRows: CvRiskEvidenceRow[],
): string | null {
	if (summary.room_id) return summary.room_id
	const fallback = evidenceRows.find((row) => row.video_id === summary.video_id && row.room_id)
	return fallback?.room_id ?? null
}

const STAGE_LABEL: Record<string, string> = {
	uploading:  'Receiving frame batch…',
	analyzing:  'Gemini AI analyzing frames…',
	finalizing: 'Generating video summary…',
}

/** Skeleton card shown while uploader frames are arriving but summary isn't ready yet */
function VideoSkeletonCard({ stage = 'uploading' }: { stage?: string }) {
	return (
		<article className="rounded-lg border border-l-2 border-border border-l-blue-500/50 bg-card p-4">
			{/* Header row */}
			<div className="mb-3 flex items-start justify-between gap-3">
				<div className="flex min-w-0 flex-1 items-center gap-2">
					{/* Pulsing blue dot — signals active ingestion */}
					<span className="relative flex h-2 w-2 shrink-0">
						<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
						<span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
					</span>
					<div className="h-3 w-36 animate-pulse rounded bg-muted/60" />
				</div>
				<div className="h-5 w-20 animate-pulse rounded border border-border bg-muted/40" />
			</div>

			{/* Stage label */}
			<div className="mb-3 flex items-center gap-1.5">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="animate-spin text-blue-500"
				>
					<path d="M21 12a9 9 0 1 1-6.219-8.56" />
				</svg>
				<span className="text-[11px] font-medium text-blue-400">
					{STAGE_LABEL[stage] ?? 'Processing…'}
				</span>
			</div>

			{/* Summary placeholder */}
			<div className="mb-3 space-y-1.5">
				<div className="h-3 w-full animate-pulse rounded bg-muted/50" />
				<div className="h-3 w-5/6 animate-pulse rounded bg-muted/50" />
				<div className="h-3 w-4/6 animate-pulse rounded bg-muted/40" />
			</div>

			{/* Metadata chips placeholder */}
			<div className="mb-3 flex flex-wrap gap-1.5">
				<div className="h-5 w-24 animate-pulse rounded border border-border bg-muted/40" />
				<div className="h-5 w-20 animate-pulse rounded border border-border bg-muted/40" />
				<div className="h-5 w-16 animate-pulse rounded border border-border bg-muted/40" />
			</div>

			{/* Pattern tags placeholder */}
			<div className="mb-3 flex flex-wrap gap-1.5">
				<div className="h-5 w-28 animate-pulse rounded border border-border bg-muted/50" />
				<div className="h-5 w-20 animate-pulse rounded border border-border bg-muted/50" />
			</div>

			{/* Recommended action placeholder */}
			<div className="rounded border border-border bg-muted/30 px-3 py-2">
				<div className="mb-1.5 h-2 w-28 animate-pulse rounded bg-muted/60" />
				<div className="h-3 w-full animate-pulse rounded bg-muted/40" />
			</div>

			{/* Key frames placeholder */}
			<div className="mt-3 rounded border border-border bg-muted/20 px-3 py-2">
				<div className="mb-1.5 h-2 w-20 animate-pulse rounded bg-muted/60" />
				<div className="h-28 w-full animate-pulse rounded border border-border bg-muted/30" />
			</div>
		</article>
	)
}

export default function VideoAlertsSection({
	initialSummaries,
	initialEvidence,
}: VideoAlertsSectionProps) {
	const summaries = useVideoAlerts(initialSummaries)
	const evidenceRows = useRiskEvidence(initialEvidence)
	const [zoomedImage, setZoomedImage] = useState<{
		src: string
		alt: string
	} | null>(null)

	// Track video_ids that have frames arriving but no summary yet.
	// Drives the skeleton card display.
	const [processingVideoIds, setProcessingVideoIds] = useState<Set<string>>(new Set())
	const seenProcessingIds = useRef<Set<string>>(new Set())

	const [progressMap, setProgressMap] = useState<Map<string, IngestProgress>>(new Map())

	// Remove from processingVideoIds when the summary for that video arrives.
	useEffect(() => {
		if (processingVideoIds.size === 0) return
		const summaryIds = new Set(summaries.map((s) => s.video_id))
		setProcessingVideoIds((prev) => {
			const next = new Set([...prev].filter((id) => !summaryIds.has(id)))
			return next.size !== prev.size ? next : prev
		})
	}, [summaries, processingVideoIds.size])

	// Initial fetch: catch first-batch frames that arrived before Realtime was ready.
	useEffect(() => {
		const supabase = createClient()
		const cutoff = new Date(Date.now() - 120_000).toISOString()
		const summaryIds = new Set(summaries.map((s) => s.video_id));
		(async () => {
			try {
				const { data } = await supabase
					.from("cv_frame_analysis")
					.select("video_id")
					.gte("created_at", cutoff)
					.order("created_at", { ascending: true })
					.limit(20)
				if (!data) return
				const newIds: string[] = []
				for (const row of data) {
					if (
						!row.video_id ||
						summaryIds.has(row.video_id) ||
						seenProcessingIds.current.has(row.video_id)
					)
						continue
					seenProcessingIds.current.add(row.video_id)
					newIds.push(row.video_id)
				}
				if (newIds.length > 0) {
					setProcessingVideoIds((prev) => {
						const next = new Set(prev)
						for (const id of newIds) next.add(id)
						return next
					})
				}
			} catch {
				// best-effort
			}
		})()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// Ongoing Realtime subscription: detect new frame ingestion for skeleton display.
	useEffect(() => {
		const supabase = createClient()
		const channel = supabase
			.channel("video-section-processing")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "cv_frame_analysis" },
				(payload) => {
					const row = payload.new as { video_id?: string }
					if (!row.video_id || seenProcessingIds.current.has(row.video_id)) return
					seenProcessingIds.current.add(row.video_id)
					setProcessingVideoIds((prev) => {
						const next = new Set(prev)
						next.add(row.video_id!)
						return next
					})
				},
			)
			.subscribe()

		return () => {
			supabase.removeChannel(channel)
		}
	}, [])

	useEffect(() => {
		const supabase = createClient()
		const channel = supabase
			.channel("cv-ingest-progress")
			.on("postgres_changes",
				{ event: "*", schema: "public", table: "cv_ingest_progress" },
				(payload) => {
					if (payload.eventType === 'DELETE') {
						const old = payload.old as { video_id?: string }
						if (old.video_id) setProgressMap(prev => { const m = new Map(prev); m.delete(old.video_id!); return m })
					} else {
						const row = payload.new as { video_id?: string; stage?: string }
						if (row.video_id && row.stage) {
							setProgressMap(prev => new Map(prev).set(row.video_id!, { stage: row.stage as IngestProgress['stage'] }))
						}
					}
				})
			.subscribe()
		return () => { supabase.removeChannel(channel) }
	}, [])

	useEffect(() => {
		if (!zoomedImage) return
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setZoomedImage(null)
			}
		}
		window.addEventListener("keydown", onKeyDown)
		return () => window.removeEventListener("keydown", onKeyDown)
	}, [zoomedImage])

	// video_ids actively processing but not yet summarized
	const summaryIds = new Set(summaries.map((s) => s.video_id))
	const pendingIds = [...processingVideoIds].filter((id) => !summaryIds.has(id))

	const totalCount = summaries.length + pendingIds.length

	return (
		<section id="video-alerts" className="flex flex-col gap-3">
			{/* Section header — matches AlertFeed / dashboard style */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Film className="h-3.5 w-3.5 text-muted-foreground" />
					<span className="text-sm font-semibold text-foreground">Video Analysis</span>
				</div>
				<span className="text-[10px] uppercase tracking-wider text-muted-foreground">
					{summaries.length} {summaries.length === 1 ? "summary" : "summaries"}
					{pendingIds.length > 0 && (
						<span className="ml-1 text-blue-400">
							· {pendingIds.length} analyzing
						</span>
					)}
				</span>
			</div>

			{totalCount === 0 ? (
				<div className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-8 text-center">
					<Film className="mx-auto mb-2 h-5 w-5 text-muted-foreground/40" />
					<p className="text-xs text-muted-foreground">No video alerts yet</p>
					<p className="mt-0.5 text-[11px] text-muted-foreground/60">
						Summaries appear here once a video run is finalized
					</p>
				</div>
			) : (
				<div className="grid gap-3 md:grid-cols-2">
					{/* Skeleton cards for videos being analyzed */}
					{pendingIds.map((id) => (
						<VideoSkeletonCard key={id} stage={progressMap.get(id)?.stage ?? 'uploading'} />
					))}

						{/* Completed summary cards */}
						{summaries.map((summary) => {
							const risk = getRiskStyle(summary.overall_risk_level)
							const patterns = extractPatterns(summary.key_patterns)
							const label = summary.overall_risk_level.toUpperCase()
							const associatedRoomId = resolveAssociatedRoomId(summary, evidenceRows)
							const actionItems = splitSentences(summary.recommended_action)
							const summarySentences = splitSentences(summary.video_summary)
							const keyFrames = evidenceRows
								.filter((row) => row.video_id === summary.video_id)
								.filter((row) => (associatedRoomId ? row.room_id === associatedRoomId : true))
								.sort((a, b) => Number(b.suspicion_score) - Number(a.suspicion_score))
								.slice(0, 3)

						return (
								<article
									key={summary.video_id}
									className={[
										"rounded-lg border border-l-2 border-border bg-card p-4 shadow-sm transition-colors",
										risk.leftBorder,
										risk.cardBg,
									].join(" ")}
								>
								{/* Header row */}
									<div className="mb-3 flex items-start justify-between gap-3">
										<div className="flex min-w-0 flex-1 items-center gap-2">
										{/* Severity dot — pulses for high risk */}
										<span className="relative flex h-2 w-2 shrink-0">
											{risk.pulse && (
												<span
													className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${risk.dot}`}
												/>
											)}
											<span
												className={`relative inline-flex h-2 w-2 rounded-full ${risk.dot}`}
											/>
										</span>
											<p className="truncate font-mono text-[11px] text-muted-foreground">
												{summary.video_id}
											</p>
										</div>
									<span
										className={`inline-flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${risk.badge}`}
									>
										<ShieldAlert className="h-3 w-3" />
										{label}
									</span>
									</div>

										{/* Summary narrative */}
										<div className="mb-2">
											{associatedRoomId ? (
												<span className="inline-flex items-center rounded border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300">
													Room {associatedRoomId}
												</span>
											) : (
												<span className="inline-flex items-center rounded border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
													Room unassigned
											</span>
										)}
									</div>

									{/* Summary narrative */}
										<div className="mb-3 rounded border border-border/70 bg-background/40 px-2.5 py-2">
											{summarySentences.length > 0 ? (
												<p className="text-sm leading-relaxed text-foreground/90">
													<span className="font-semibold text-foreground">{summarySentences[0]}</span>
													{summarySentences.slice(1).map((part, idx) => (
														<span key={`${summary.video_id}-summary-${idx}`} className="text-foreground/80">
															{" "}{part}
														</span>
													))}
												</p>
											) : (
												<p className="text-sm leading-relaxed text-foreground/80">{summary.video_summary}</p>
											)}
										</div>

								{/* Metadata chips */}
								<div className="mb-3 flex flex-wrap items-center gap-1.5">
										<span className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] text-cyan-200">
											<Activity className="h-3 w-3" />
											{formatPercent(summary.overall_suspicion_score)} risk score
										</span>
										<span className="inline-flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] text-indigo-200">
											<ScanSearch className="h-3 w-3" />
											{summary.frame_count} frames
										</span>
											<span className="inline-flex items-center gap-1 rounded border border-border/80 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
												<Clock3 className="h-3 w-3" />
												{timeAgo(summary.updated_at)}
										</span>
								</div>

								{/* Pattern tags */}
									{patterns.length > 0 && (
										<div className="mb-3 flex flex-wrap gap-1.5">
											{patterns.slice(0, 4).map((pattern) => (
												<span
													key={`${summary.video_id}-${pattern}`}
													className="rounded border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground"
												>
													{pattern}
												</span>
											))}
										</div>
								)}

									{/* Recommended action */}
									<div className="rounded border border-border bg-muted/30 px-3 py-2">
										<p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
											Recommended Action
										</p>
										<ul className="list-disc space-y-1 pl-4 text-xs text-foreground">
											{actionItems.map((item, idx) => (
												<li key={`${summary.video_id}-action-${idx}`}>{item}</li>
											))}
										</ul>
									</div>

									<div className="mt-3">
										<details open className="rounded border border-border bg-muted/20 px-3 py-2">
											<summary className="cursor-pointer select-none text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
												Key Frames ({keyFrames.length})
											</summary>
											<div className="mt-2">
												{keyFrames.length === 0 ? (
													<p className="text-xs text-muted-foreground">
														No key frames for this video yet.
													</p>
												) : (
													<div className="space-y-2">
														{keyFrames.map((frame) => {
															const signals = extractSignals(frame.anomaly_signals)
															return (
																<div
																	key={frame.id}
																	className="rounded border border-border bg-background/40 px-2 py-1.5"
																>
																	<p className="mb-1 text-sm font-semibold text-foreground">
																		Key Frame
																	</p>
																	{frame.frame_image_base64 && (
																		<button
																			type="button"
																			onClick={() =>
																				setZoomedImage({
																					src: `data:${frame.frame_mime_type ?? "image/jpeg"};base64,${frame.frame_image_base64}`,
																					alt: `Key frame for ${summary.video_id}`,
																				})
																			}
																			className="mb-2 block w-full cursor-zoom-in overflow-hidden rounded border border-border"
																		>
																			<img
																				src={`data:${frame.frame_mime_type ?? "image/jpeg"};base64,${frame.frame_image_base64}`}
																				alt={`Key frame for ${summary.video_id}`}
																				className="h-28 w-full cursor-zoom-in object-cover transition-transform duration-150 hover:scale-[1.02]"
																			/>
																		</button>
																	)}
																	<p className="text-[11px] text-muted-foreground">
																		{new Date(frame.frame_timestamp).toLocaleString()} • score{" "}
																		{formatPercent(Number(frame.suspicion_score))}
																	</p>
																	{signals.length > 0 && (
																		<p className="text-[11px] text-foreground/80">
																			{signals.slice(0, 3).join(", ")}
																		</p>
																	)}
																	{frame.analysis_summary && (
																		<p className="line-clamp-2 text-[11px] text-muted-foreground">
																			{frame.analysis_summary}
																		</p>
																	)}
																</div>
															)
														})}
													</div>
												)}
											</div>
										</details>
									</div>
								</article>
							)
					})}
				</div>
			)}
			{zoomedImage && (
				<div
					role="button"
					tabIndex={0}
					onClick={() => setZoomedImage(null)}
					onKeyDown={(event) => {
						if (event.key === "Escape") setZoomedImage(null)
					}}
					className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
				>
					<div className="relative" onClick={(event) => event.stopPropagation()}>
						<button
							type="button"
							onClick={() => setZoomedImage(null)}
							aria-label="Close zoomed image"
							className="absolute -right-2 -top-2 z-10 rounded-full border border-border bg-background p-1.5 text-foreground shadow"
						>
							<X className="h-4 w-4" />
						</button>
						<img
							src={zoomedImage.src}
							alt={zoomedImage.alt}
							className="max-h-[92vh] max-w-[92vw] rounded border border-border object-contain"
						/>
					</div>
				</div>
			)}
		</section>
	)
}
