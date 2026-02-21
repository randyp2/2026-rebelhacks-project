import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { timingSafeEqualString } from "@/lib/crypto/hmac";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type FrameAnalysis = {
	video_id: string;
	room_id: string;
	timestamp: string;
	camera_id: string | null;
	event_id: string | null;
	person_count: number;
	entry_event: boolean;
	confidence: number;
	suspicion_score: number;
	anomaly_signals: string[];
	analysis_summary: string;
};

type FinalSummary = {
	overall_risk_level: "low" | "medium" | "high";
	overall_suspicion_score: number;
	video_summary: string;
	key_patterns: string[];
	recommended_action: string;
};

function pickPrimaryRoomId(frames: FrameAnalysis[]): string | null {
	if (frames.length === 0) return null;
	const counts = new Map<string, number>();
	for (const frame of frames) {
		const roomId = frame.room_id?.trim();
		if (!roomId) continue;
		counts.set(roomId, (counts.get(roomId) ?? 0) + 1);
	}
	if (counts.size === 0) return null;
	return [...counts.entries()]
		.sort((a, b) => {
			if (b[1] !== a[1]) return b[1] - a[1];
			return a[0].localeCompare(b[0]);
		})[0][0];
}

const requestSchema = z.object({
	video_id: z.string().trim().min(1).max(200),
	model: z.string().trim().min(1).optional(),
});

const finalSummarySchema = z.object({
	overall_risk_level: z.enum(["low", "medium", "high"]),
	overall_suspicion_score: z.number().min(0).max(1),
	video_summary: z.string().trim().min(1).max(2000),
	key_patterns: z.array(z.string().trim().min(1)).max(20).default([]),
	recommended_action: z.string().trim().min(1).max(500),
});

function unauthorized() {
	return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

async function fetchAllFrames(videoId: string): Promise<FrameAnalysis[]> {
	const pageSize = 1000;
	let from = 0;
	const rows: FrameAnalysis[] = [];

	while (true) {
		const to = from + pageSize - 1;
		const { data, error } = await supabaseAdmin
			.from("cv_frame_analysis")
			.select(
				"video_id,room_id,timestamp,camera_id,event_id,person_count,entry_event,confidence,suspicion_score,anomaly_signals,analysis_summary",
			)
			.eq("video_id", videoId)
			.order("timestamp", { ascending: true })
			.range(from, to);

		if (error) {
			throw new Error(`Failed to load frame analysis: ${error.message}`);
		}

		const batch = (data ?? []) as FrameAnalysis[];
		rows.push(...batch);
		if (batch.length < pageSize) break;
		from += pageSize;
	}

	return rows;
}

async function summarizeVideo(frames: FrameAnalysis[], modelOverride?: string): Promise<FinalSummary> {
	const apiKey = process.env.GEMINI_API_KEY;
	if (!apiKey) {
		throw new Error("Missing GEMINI_API_KEY");
	}

	const model = modelOverride || process.env.GEMINI_MODEL || "gemini-2.5-flash";
	const ai = new GoogleGenAI({ apiKey });

	const compressedFrames = [...frames].slice(0, 1500).map((frame) => ({
		timestamp: frame.timestamp,
		room_id: frame.room_id,
		camera_id: frame.camera_id,
		person_count: frame.person_count,
		entry_event: frame.entry_event,
		confidence: frame.confidence,
		suspicion_score: frame.suspicion_score,
		anomaly_signals: frame.anomaly_signals,
		analysis_summary: frame.analysis_summary,
	}));

	const prompt = [
		"You are summarizing a full CCTV video represented by ordered frame-analysis metadata.",
		"Your job is sequence-level anomaly assessment over the full video, not per-frame restatement.",
		"Use only observable behavior patterns. Do not infer identity, age, gender, ethnicity, or protected traits.",
		"Return strict JSON with keys:",
		"- overall_risk_level: one of low | medium | high",
		"- overall_suspicion_score: number between 0 and 1 for the entire video",
		"- video_summary: concise full-video narrative across beginning/middle/end",
		"- key_patterns: short list of repeated or meaningful temporal patterns",
		"- recommended_action: short operational recommendation",
		"No markdown, no prose outside JSON.",
		"",
		`Total frames included: ${compressedFrames.length}`,
		JSON.stringify(compressedFrames),
	].join("\n");

	const response = await ai.models.generateContent({
		model,
		contents: [{ role: "user", parts: [{ text: prompt }] }],
		config: {
			temperature: 0,
			responseMimeType: "application/json",
		},
	});

	const parsed = parseGeminiJsonText(response.text ?? "");
	const validated = finalSummarySchema.safeParse(parsed);
	if (!validated.success) {
		throw new Error("Gemini final summary schema validation failed");
	}

	return validated.data;
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

	const body = await req.json().catch(() => null);
	const parsed = requestSchema.safeParse(body);
	if (!parsed.success) {
		return NextResponse.json({ error: "Invalid request body; expected video_id" }, { status: 400 });
	}

	const { video_id: videoId, model } = parsed.data;

	let frames: FrameAnalysis[];
	try {
		frames = await fetchAllFrames(videoId);
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		return NextResponse.json({ error: message }, { status: 500 });
	}

	if (frames.length === 0) {
		return NextResponse.json({ error: `No frame analysis found for video_id=${videoId}` }, { status: 404 });
	}

	let summary: FinalSummary;
	try {
		summary = await summarizeVideo(frames, model);
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		return NextResponse.json({ error: message }, { status: 502 });
	}

	const summaryRow = {
		video_id: videoId,
		room_id: pickPrimaryRoomId(frames),
		overall_risk_level: summary.overall_risk_level,
		overall_suspicion_score: summary.overall_suspicion_score,
		video_summary: summary.video_summary,
		key_patterns: summary.key_patterns,
		recommended_action: summary.recommended_action,
		frame_count: frames.length,
		started_at: frames[0]?.timestamp ?? null,
		ended_at: frames[frames.length - 1]?.timestamp ?? null,
	};

	const { error: upsertError } = await supabaseAdmin
		.from("cv_video_summaries")
		.upsert(summaryRow, { onConflict: "video_id" });

	if (upsertError) {
		return NextResponse.json(
			{ error: "Failed to store cv_video_summaries", details: upsertError.message },
			{ status: 500 },
		);
	}

	return NextResponse.json({
		ok: true,
		video_id: videoId,
		room_id: summaryRow.room_id,
		frame_count: frames.length,
		overall_risk_level: summary.overall_risk_level,
		overall_suspicion_score: summary.overall_suspicion_score,
		final_video_summary: summary.video_summary,
		video_key_patterns: summary.key_patterns,
		recommended_action: summary.recommended_action,
	});
}
