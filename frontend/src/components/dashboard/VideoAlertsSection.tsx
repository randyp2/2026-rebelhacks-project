"use client"

import { Activity, Clock3, Film, ScanSearch, ShieldAlert } from "lucide-react"

import { useRiskEvidence } from "@/hooks/useRiskEvidence"
import { useVideoAlerts } from "@/hooks/useVideoAlerts"
import type { CvRiskEvidenceRow, CvVideoSummaryRow } from "@/types/database"

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

export default function VideoAlertsSection({
	initialSummaries,
	initialEvidence,
}: VideoAlertsSectionProps) {
	const summaries = useVideoAlerts(initialSummaries)
	const evidenceRows = useRiskEvidence(initialEvidence)

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
				</span>
			</div>

			{summaries.length === 0 ? (
				<div className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-8 text-center">
					<Film className="mx-auto mb-2 h-5 w-5 text-muted-foreground/40" />
					<p className="text-xs text-muted-foreground">No video alerts yet</p>
					<p className="mt-0.5 text-[11px] text-muted-foreground/60">
						Summaries appear here once a video run is finalized
					</p>
				</div>
			) : (
				<div className="grid gap-3 md:grid-cols-2">
					{summaries.map((summary) => {
						const risk = getRiskStyle(summary.overall_risk_level)
						const patterns = extractPatterns(summary.key_patterns)
						const label = summary.overall_risk_level.toUpperCase()
						const keyFrames = evidenceRows
							.filter((row) => row.video_id === summary.video_id)
							.sort((a, b) => Number(b.suspicion_score) - Number(a.suspicion_score))
							.slice(0, 3)

						return (
							<article
								key={summary.video_id}
								className={[
									"rounded-lg border border-l-2 border-border bg-card p-4 transition-colors",
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
								<p className="mb-3 text-xs leading-relaxed text-foreground/80">
									{summary.video_summary}
								</p>

								{/* Metadata chips */}
								<div className="mb-3 flex flex-wrap items-center gap-1.5">
									<span className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
										<Activity className="h-3 w-3" />
										{formatPercent(summary.overall_suspicion_score)} risk score
									</span>
									<span className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
										<ScanSearch className="h-3 w-3" />
										{summary.frame_count} frames
									</span>
									{summary.room_id && (
										<span className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
											Room {summary.room_id}
										</span>
									)}
									<span className="inline-flex items-center gap-1 rounded border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
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
									<p className="text-xs text-foreground">{summary.recommended_action}</p>
								</div>

								<div className="mt-3 rounded border border-border bg-muted/20 px-3 py-2">
									<p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
										Key Frames ({keyFrames.length})
									</p>
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
														{frame.frame_image_base64 && (
															<img
																src={`data:${frame.frame_mime_type ?? "image/jpeg"};base64,${frame.frame_image_base64}`}
																alt={`Key frame for ${summary.video_id}`}
																className="mb-2 h-28 w-full rounded border border-border object-cover"
															/>
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
														<p className="truncate text-[10px] text-muted-foreground/70">
															{frame.storage_path}
														</p>
													</div>
												)
											})}
										</div>
									)}
								</div>
							</article>
						)
					})}
				</div>
			)}
		</section>
	)
}
