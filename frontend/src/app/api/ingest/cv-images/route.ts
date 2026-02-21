import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { timingSafeEqualString } from "@/lib/crypto/hmac";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type BatchItem = {
	room_id: string;
	captured_at: string;
	camera_id: string | null;
	event_id: string | null;
	video_id: string | null;
	mime_type: string;
	image_base64: string;
};

type GeminiResult = {
	person_count: number;
	entry_event: boolean;
	confidence: number;
	anomaly_signals: string[];
	suspicion_score: number;
	analysis_summary: string;
};

type BatchAnalysisSummary = {
	overall_risk_level: "low" | "medium" | "high";
	overall_suspicion_score: number;
	video_summary: string;
	key_patterns: string[];
	recommended_action: string;
};

type AnalyzedFrame = {
	room_id: string;
	timestamp: string;
	video_id: string | null;
	mime_type: string;
	image_base64: string;
	entry_event: boolean;
	person_count: number;
	confidence: number;
	anomaly_signals: string[];
	suspicion_score: number;
	analysis_summary: string;
	camera_id: string | null;
	event_id: string | null;
};

type RiskEvidenceRow = {
	video_id: string;
	room_id: string;
	frame_timestamp: string;
	storage_path: string;
	frame_mime_type: string;
	frame_image_base64: string;
	suspicion_score: number;
	anomaly_signals: string[];
	analysis_summary: string;
	is_key_frame: boolean;
};

const jsonItemSchema = z.object({
	room_id: z.string().trim().min(1),
	captured_at: z.iso.datetime({ offset: true }),
	camera_id: z.string().trim().min(1).optional(),
	event_id: z.string().trim().min(1).optional(),
	video_id: z.string().trim().min(1).max(200).optional(),
	mime_type: z.string().trim().min(1).optional(),
	image_base64: z.string().trim().min(1),
});

const geminiOutputSchema = z.object({
	person_count: z.number().int().min(0).max(1000),
	entry_event: z.boolean(),
	confidence: z.number().min(0).max(1),
	anomaly_signals: z.array(z.string().trim().min(1)).max(20).default([]),
	suspicion_score: z.number().min(0).max(1).default(0),
	analysis_summary: z.string().trim().max(500).default(""),
});

const batchSummaryOutputSchema = z.object({
	overall_risk_level: z.enum(["low", "medium", "high"]),
	overall_suspicion_score: z.number().min(0).max(1),
	video_summary: z.string().trim().min(1).max(2000),
	key_patterns: z.array(z.string().trim().min(1)).max(12).default([]),
	recommended_action: z.string().trim().min(1).max(500),
});

function parseBooleanFlag(input: string | undefined, fallback: boolean): boolean {
	if (input === undefined) return fallback;
	const normalized = input.trim().toLowerCase();
	if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
	if (normalized === "false" || normalized === "0" || normalized === "no") return false;
	return fallback;
}

function parsePositiveNumber(input: string | undefined, fallback: number): number {
	if (input === undefined) return fallback;
	const parsed = Number(input);
	if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
	return parsed;
}

function sanitizePathSegment(value: string): string {
	return value.trim().replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "unknown";
}

function buildPendingEvidencePath(frame: AnalyzedFrame): string {
	const safeRoomId = sanitizePathSegment(frame.room_id);
	const safeVideoId = sanitizePathSegment(frame.video_id ?? "unknown-video");
	const ts = new Date(frame.timestamp).toISOString().replace(/[:.]/g, "-");
	return `pending/${safeRoomId}/${safeVideoId}/${ts}-${crypto.randomUUID()}.jpg`;
}

function unauthorized() {
	return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

function badRequest(error: string, details?: unknown) {
	return NextResponse.json({ error, details }, { status: 400 });
}

async function fileToBase64(file: File): Promise<string> {
	const bytes = Buffer.from(await file.arrayBuffer());
	return bytes.toString("base64");
}

function parseGeminiJsonText(input: string): unknown {
	const trimmed = input.trim();
	if (!trimmed) return null;

	try {
		return JSON.parse(trimmed);
	} catch {
		const match = trimmed.match(/\{[\s\S]*\}/);
		if (!match) return null;
		try {
			return JSON.parse(match[0]);
		} catch {
			return null;
		}
	}
}

async function analyzeWithGemini(item: BatchItem): Promise<GeminiResult> {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error("Missing GEMINI_API_KEY");
	}

	const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
	const ai = new GoogleGenAI({ apiKey });

	const prompt = [
		"You are a safety-monitoring vision analyst for hotel hallway and room-entrance footage.",
		"Analyze this screenshot for potential anomaly indicators associated with suspicious or potentially exploitative activity.",
		"Focus on observable behaviors only. Do not infer identity, age, gender, ethnicity, or protected traits.",
		"Examples of indicators: face covering used to avoid identification, visible aggression/intimidation, forced escorting/body control, distressed posture, repeated surveillance-like lingering near doors, unusual group escort patterns, rapid in/out cycling.",
		"Return strict JSON with keys:",
		"- person_count: integer >= 0",
		"- entry_event: boolean (true only if the frame suggests someone is entering a room/zone)",
		"- confidence: number between 0 and 1",
		"- anomaly_signals: array of short strings describing observed indicators (empty if none)",
		"- suspicion_score: number between 0 and 1 representing anomaly concern in this frame",
		"- analysis_summary: short plain-language summary of observed behavior",
		"No markdown, no prose, JSON only.",
	].join("\n");

	const response = await ai.models.generateContent({
		model,
		contents: [
			{
				role: "user",
				parts: [
					{ text: prompt },
					{
						inlineData: {
							mimeType: item.mime_type,
							data: item.image_base64,
						},
					},
				],
			},
		],
		config: {
			temperature: 0,
			responseMimeType: "application/json",
		},
	});
	const text = response.text ?? "";
	const parsed = parseGeminiJsonText(text);
	const validated = geminiOutputSchema.safeParse(parsed);
	if (!validated.success) {
		throw new Error("Gemini output schema validation failed");
	}

	return validated.data;
}

async function summarizeBatchWithGemini(frames: AnalyzedFrame[]): Promise<BatchAnalysisSummary> {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error("Missing GEMINI_API_KEY");
	}

	const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
	const ai = new GoogleGenAI({ apiKey });

	const orderedFrames = [...frames]
		.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
		.slice(0, 120)
		.map((frame) => ({
			timestamp: frame.timestamp,
			person_count: frame.person_count,
			entry_event: frame.entry_event,
			confidence: frame.confidence,
			suspicion_score: frame.suspicion_score,
			anomaly_signals: frame.anomaly_signals,
			analysis_summary: frame.analysis_summary,
		}));

	const prompt = [
		"You are summarizing a full CCTV segment represented by frame-level analysis metadata.",
		"Produce a single concise video-level risk summary based only on observable behavior patterns over time.",
		"Do not infer identity, age, gender, ethnicity, or protected traits.",
		"Return strict JSON with keys:",
		"- overall_risk_level: one of low | medium | high",
		"- overall_suspicion_score: number between 0 and 1 for the full sequence",
		"- video_summary: concise narrative of the sequence-level behavior",
		"- key_patterns: array of short sequence-level patterns observed over time",
		"- recommended_action: short operational recommendation",
		"No markdown, no prose outside JSON.",
		"",
		`Frame analysis data (${orderedFrames.length} frames):`,
		JSON.stringify(orderedFrames),
	].join("\n");

	const response = await ai.models.generateContent({
		model,
		contents: [{ role: "user", parts: [{ text: prompt }] }],
		config: {
			temperature: 0,
			responseMimeType: "application/json",
		},
	});

	const text = response.text ?? "";
	const parsed = parseGeminiJsonText(text);
	const validated = batchSummaryOutputSchema.safeParse(parsed);
	if (!validated.success) {
		throw new Error("Gemini video-summary schema validation failed");
	}

	return validated.data;
}

async function parseBatch(req: Request): Promise<BatchItem[]> {
	const contentType = req.headers.get("content-type") ?? "";

	if (contentType.includes("application/json")) {
		const body = await req.json().catch(() => null);
		const entries = Array.isArray(body) ? body : body?.items;
		if (!Array.isArray(entries) || entries.length === 0) {
			throw new Error("JSON body must be a non-empty array or an object with items[]");
		}

		const parsedItems: BatchItem[] = [];
		for (const [index, entry] of entries.entries()) {
			const parsed = jsonItemSchema.safeParse(entry);
			if (!parsed.success) {
				throw new Error(`Invalid item at index ${index}`);
			}
			parsedItems.push({
				room_id: parsed.data.room_id,
				captured_at: parsed.data.captured_at,
				camera_id: parsed.data.camera_id ?? null,
				event_id: parsed.data.event_id ?? null,
				video_id: parsed.data.video_id ?? null,
				mime_type: parsed.data.mime_type ?? "image/jpeg",
				image_base64: parsed.data.image_base64,
			});
		}
		return parsedItems;
	}

	if (contentType.includes("multipart/form-data")) {
		const form = await req.formData();
		const roomId = String(form.get("room_id") ?? "").trim();
		const cameraIdRaw = String(form.get("camera_id") ?? "").trim();
		const eventIdRaw = String(form.get("event_id") ?? "").trim();
		const videoIdRaw = String(form.get("video_id") ?? "").trim();
		const capturedAtRaw = String(form.get("captured_at") ?? "").trim();

		if (!roomId) {
			throw new Error("room_id is required for multipart requests");
		}

		const capturedAt = capturedAtRaw || new Date().toISOString();
		const parsedTimestamp = z.iso.datetime({ offset: true }).safeParse(capturedAt);
		if (!parsedTimestamp.success) {
			throw new Error("captured_at must be ISO-8601 with timezone offset");
		}

		const fileEntries = [
			...form.getAll("images"),
			...form.getAll("image"),
		].filter((value): value is File => value instanceof File);

		if (fileEntries.length === 0) {
			throw new Error("multipart request must include image or images files");
		}

		const mapped = await Promise.all(
			fileEntries.map(async (file) => ({
				room_id: roomId,
				captured_at: parsedTimestamp.data,
				camera_id: cameraIdRaw || null,
				event_id: eventIdRaw || null,
				video_id: videoIdRaw || null,
				mime_type: file.type || "image/jpeg",
				image_base64: await fileToBase64(file),
			})),
		);

		return mapped;
	}

	throw new Error("Unsupported content type; use application/json or multipart/form-data");
}

export async function POST(req: Request) {
	const expected = process.env.CV_API_KEY;
	if (!expected) {
		return NextResponse.json(
			{ error: "Server misconfigured: missing CV_API_KEY" },
			{ status: 500 },
		);
	}

	const supplied = req.headers.get("x-cv-api-key");
	if (!supplied || !timingSafeEqualString(supplied, expected)) {
		return unauthorized();
	}

	let batch: BatchItem[];
	try {
		batch = await parseBatch(req);
	} catch (error) {
		return badRequest(error instanceof Error ? error.message : "Invalid request payload");
	}

	const analysisResults: AnalyzedFrame[] = [];
	const errors: string[] = [];
	const videoId = batch[0]?.video_id ?? null;

	if (videoId) {
		void supabaseAdmin.from('cv_ingest_progress').upsert(
			{ video_id: videoId, room_id: batch[0]?.room_id ?? null, stage: 'uploading', updated_at: new Date().toISOString() },
			{ onConflict: 'video_id' }
		);
	}

	const evidenceEnabled = parseBooleanFlag(process.env.CV_EVIDENCE_ENABLED, true);
	const evidenceThreshold = Math.min(
		1,
		parsePositiveNumber(process.env.CV_EVIDENCE_SUSPICION_THRESHOLD, 0.15),
	);
	const evidenceMaxFramesPerRequest = Math.max(
		1,
		Math.floor(parsePositiveNumber(process.env.CV_EVIDENCE_MAX_FRAMES_PER_REQUEST, 5)),
	);

	for (const [index, item] of batch.entries()) {
		try {
			const analyzed = await analyzeWithGemini(item);
			analysisResults.push({
				room_id: item.room_id,
				timestamp: item.captured_at,
				video_id: item.video_id,
				mime_type: item.mime_type,
				image_base64: item.image_base64,
				entry_event: analyzed.entry_event,
				person_count: analyzed.person_count,
				confidence: analyzed.confidence,
				anomaly_signals: analyzed.anomaly_signals,
				suspicion_score: analyzed.suspicion_score,
				analysis_summary: analyzed.analysis_summary,
				camera_id: item.camera_id,
				event_id: item.event_id,
			});
		} catch (error) {
			errors.push(`item ${index}: ${error instanceof Error ? error.message : "analysis failed"}`);
		}
	}

	if (analysisResults.length === 0) {
		return NextResponse.json(
			{ ok: false, accepted: batch.length, inserted: 0, errors },
			{ status: 502 },
		);
	}

	if (videoId) {
		void supabaseAdmin.from('cv_ingest_progress').upsert(
			{ video_id: videoId, room_id: batch[0]?.room_id ?? null, stage: 'analyzing', updated_at: new Date().toISOString() },
			{ onConflict: 'video_id' }
		);
	}

	let batchSummary: BatchAnalysisSummary | null = null;
	const shouldComputeBatchSummary = !analysisResults.some((row) => row.video_id);
	if (shouldComputeBatchSummary) {
		try {
			batchSummary = await summarizeBatchWithGemini(analysisResults);
		} catch (error) {
			errors.push(`video summary failed: ${error instanceof Error ? error.message : "unknown error"}`);
		}
	}

	const frameRowsToUpsert = analysisResults
		.filter((row) => row.video_id)
		.map((row) => ({
			video_id: row.video_id as string,
			room_id: row.room_id,
			timestamp: new Date(row.timestamp).toISOString(),
			camera_id: row.camera_id,
			event_id: row.event_id,
			person_count: row.person_count,
			entry_event: row.entry_event,
			confidence: row.confidence,
			suspicion_score: row.suspicion_score,
			anomaly_signals: row.anomaly_signals,
			analysis_summary: row.analysis_summary,
		}));

	if (frameRowsToUpsert.length > 0) {
		const { error: upsertError } = await supabaseAdmin
			.from("cv_frame_analysis")
			.upsert(frameRowsToUpsert, { onConflict: "video_id,room_id,timestamp" });
		if (upsertError) {
			errors.push(`cv_frame_analysis upsert failed: ${upsertError.message}`);
		}
	}

	const evidenceCandidates = analysisResults
		.filter((row) => row.video_id)
		.filter((row) => row.suspicion_score >= evidenceThreshold)
		.sort((a, b) => {
			if (b.suspicion_score !== a.suspicion_score) {
				return b.suspicion_score - a.suspicion_score;
			}
			return Date.parse(a.timestamp) - Date.parse(b.timestamp);
		});

	const evidenceRowsToInsert: RiskEvidenceRow[] = evidenceEnabled
		? evidenceCandidates.slice(0, evidenceMaxFramesPerRequest).map((row) => ({
				video_id: row.video_id as string,
				room_id: row.room_id,
				frame_timestamp: new Date(row.timestamp).toISOString(),
				storage_path: buildPendingEvidencePath(row),
				frame_mime_type: row.mime_type,
				frame_image_base64: row.image_base64,
				suspicion_score: row.suspicion_score,
				anomaly_signals: row.anomaly_signals,
				analysis_summary: row.analysis_summary,
				is_key_frame: true,
			}))
		: [];

	let evidenceSaved = 0;
	let evidenceRows: Array<{
		id: string;
		video_id: string;
		storage_path: string;
		suspicion_score: number;
	}> = [];

	if (evidenceRowsToInsert.length > 0) {
		const { data: evidenceInsertData, error: evidenceInsertError } = await supabaseAdmin
			.from("cv_risk_evidence")
			.insert(evidenceRowsToInsert)
			.select("id,video_id,storage_path,suspicion_score");

		if (evidenceInsertError) {
			errors.push(`cv_risk_evidence insert failed: ${evidenceInsertError.message}`);
		} else {
			evidenceRows = evidenceInsertData ?? [];
			evidenceSaved = evidenceRows.length;
		}
	}

	const roomIds = [...new Set(analysisResults.map((row) => row.room_id))];
	const earliestTimestamp = analysisResults
		.map((row) => Date.parse(row.timestamp))
		.filter((ms) => Number.isFinite(ms))
		.reduce((min, value) => Math.min(min, value), Number.POSITIVE_INFINITY);
	const lookbackStart = Number.isFinite(earliestTimestamp)
		? new Date(earliestTimestamp - 60 * 60 * 1000).toISOString()
		: new Date(Date.now() - 60 * 60 * 1000).toISOString();

	const [{ data: existingRows, error: existingError }, { data: recentRows, error: recentError }] = await Promise.all([
		supabaseAdmin
			.from("cv_events")
			.select("room_id,timestamp")
			.in("room_id", roomIds)
			.gte("timestamp", lookbackStart),
		supabaseAdmin
			.from("cv_events")
			.select("room_id,timestamp,entry_count")
			.in("room_id", roomIds)
			.gte("timestamp", lookbackStart)
			.order("timestamp", { ascending: true }),
	]);

	if (existingError || recentError) {
		return NextResponse.json(
			{ error: "Failed to load existing CV events" },
			{ status: 500 },
		);
	}

	const existingEventKeys = new Set(
		(existingRows ?? []).map((row) => `${row.room_id}::${new Date(row.timestamp).toISOString()}`),
	);

	const roomBaseEntryCount = new Map<string, number>();
	for (const roomId of roomIds) {
		roomBaseEntryCount.set(roomId, 0);
	}

	const now = Date.now();
	for (const row of recentRows ?? []) {
		const ts = Date.parse(row.timestamp);
		if (!Number.isFinite(ts)) continue;
		if (ts >= now - 60 * 60 * 1000) {
			const current = roomBaseEntryCount.get(row.room_id) ?? 0;
			roomBaseEntryCount.set(row.room_id, Math.max(current, row.entry_count ?? current));
		}
	}

	const entryCounterByRoom = new Map(roomBaseEntryCount);
	const sortedAnalysis = [...analysisResults].sort((a, b) => {
		if (a.room_id !== b.room_id) {
			return a.room_id.localeCompare(b.room_id);
		}
		return Date.parse(a.timestamp) - Date.parse(b.timestamp);
	});
	const rowsToInsert: Array<{
		room_id: string;
		person_count: number;
		entry_count: number;
		timestamp: string;
	}> = [];

	for (const analyzed of sortedAnalysis) {
		const roomId = analyzed.room_id;
		const normalizedTimestamp = new Date(analyzed.timestamp).toISOString();
		const key = `${roomId}::${normalizedTimestamp}`;
		if (existingEventKeys.has(key)) {
			errors.push(`duplicate skipped for ${roomId} at ${analyzed.timestamp}`);
			continue;
		}

		let counter = entryCounterByRoom.get(roomId) ?? 0;
		if (analyzed.entry_event) {
			counter += 1;
		}
		entryCounterByRoom.set(roomId, counter);

		rowsToInsert.push({
			room_id: roomId,
			person_count: analyzed.person_count,
			entry_count: counter,
			timestamp: normalizedTimestamp,
		});

		existingEventKeys.add(key);
	}

	if (rowsToInsert.length > 0) {
		const { error: insertError } = await supabaseAdmin.from("cv_events").insert(rowsToInsert);
		if (insertError) {
			return NextResponse.json(
				{ error: "Failed to insert cv_events", details: insertError.message },
				{ status: 500 },
			);
		}
	}

	const affectedRoomIds = [...new Set(rowsToInsert.map((row) => row.room_id))];
	const videoIds = [...new Set(analysisResults.map((row) => row.video_id).filter((value): value is string => Boolean(value)))];
	let scoreRiskError: string | null = null;
	if (affectedRoomIds.length > 0) {
		const { error } = await supabaseAdmin.functions.invoke("score-risk", {
			body: { room_ids: affectedRoomIds },
		});
		if (error) {
			scoreRiskError = error.message;
			errors.push(`score-risk invoke failed: ${error.message}`);
		}
	}

	return NextResponse.json({
		ok: scoreRiskError === null,
		accepted: batch.length,
		analyzed: analysisResults.length,
		inserted: rowsToInsert.length,
		affected_rooms: affectedRoomIds,
		video_id: videoIds.length === 1 ? videoIds[0] : null,
		stored_frame_analysis: frameRowsToUpsert.length,
		evidence_enabled: evidenceEnabled,
		evidence_threshold: evidenceThreshold,
		evidence_candidates: evidenceCandidates.length,
		evidence_saved: evidenceSaved,
		evidence_rows: evidenceRows.slice(0, 5),
		anomaly_frames: analysisResults.filter((row) => row.suspicion_score >= 0.6 || row.anomaly_signals.length > 0).length,
		top_anomaly_signals: Array.from(
			new Set(analysisResults.flatMap((row) => row.anomaly_signals).map((s) => s.trim()).filter(Boolean)),
		).slice(0, 10),
		final_video_summary: batchSummary?.video_summary ?? null,
		overall_risk_level: batchSummary?.overall_risk_level ?? null,
		overall_suspicion_score: batchSummary?.overall_suspicion_score ?? null,
		video_key_patterns: batchSummary?.key_patterns ?? [],
		recommended_action: batchSummary?.recommended_action ?? null,
		errors,
	});
}
