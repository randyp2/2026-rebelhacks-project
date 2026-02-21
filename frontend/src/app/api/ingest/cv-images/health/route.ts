import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { timingSafeEqualString } from "@/lib/crypto/hmac";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function extractBearerToken(req: Request): string | null {
	const auth = req.headers.get("authorization") ?? "";
	const match = auth.match(/^Bearer\s+(.+)$/i);
	return match?.[1]?.trim() ?? null;
}

function isAuthorized(req: Request, expected: string): boolean {
	const headerToken = req.headers.get("x-cv-api-key");
	if (headerToken && timingSafeEqualString(headerToken, expected)) {
		return true;
	}

	const bearerToken = extractBearerToken(req);
	if (bearerToken && timingSafeEqualString(bearerToken, expected)) {
		return true;
	}

	return false;
}

function unauthorizedResponse() {
	return NextResponse.json(
		{
			ok: false,
			error: "Unauthorized",
			timestamp: new Date().toISOString(),
		},
		{ status: 401 },
	);
}

function misconfiguredResponse() {
	return NextResponse.json(
		{
			ok: false,
			error: "Server misconfigured: missing CV_API_KEY",
			timestamp: new Date().toISOString(),
		},
		{ status: 500 },
	);
}

export async function GET(req: Request) {
	const expected = process.env.CV_API_KEY;
	if (!expected) {
		return misconfiguredResponse();
	}

	if (!isAuthorized(req, expected)) {
		return unauthorizedResponse();
	}

	const checks = {
		gemini_key_configured: Boolean(process.env.GEMINI_API_KEY),
		database: false,
	};

	let dbError: string | null = null;
	const { error } = await supabaseAdmin
		.from("cv_events")
		.select("id", { count: "exact", head: true })
		.limit(1);

	if (error) {
		dbError = error.message;
	} else {
		checks.database = true;
	}

	const ok = checks.gemini_key_configured && checks.database;
	return NextResponse.json(
		{
			ok,
			service: "cv-images-ingest",
			timestamp: new Date().toISOString(),
			checks,
			db_error: dbError,
		},
		{ status: ok ? 200 : 503 },
	);
}

export async function POST(req: Request) {
	const expected = process.env.CV_API_KEY;
	if (!expected) {
		return misconfiguredResponse();
	}

	if (!isAuthorized(req, expected)) {
		return unauthorizedResponse();
	}

	const geminiApiKey = process.env.GEMINI_API_KEY;
	if (!geminiApiKey) {
		return NextResponse.json(
			{
				ok: false,
				error: "Server misconfigured: missing GEMINI_API_KEY",
				timestamp: new Date().toISOString(),
			},
			{ status: 500 },
		);
	}

	const body = (await req.json().catch(() => null)) as
		| {
				prompt?: unknown;
				image_base64?: unknown;
				mime_type?: unknown;
				model?: unknown;
		  }
		| null;

	const prompt =
		typeof body?.prompt === "string" && body.prompt.trim()
			? body.prompt.trim()
			: "Reply with JSON: {\"ok\":true,\"source\":\"gemini\"}";

	const model =
		typeof body?.model === "string" && body.model.trim()
			? body.model.trim()
			: process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

	const parts: Array<Record<string, unknown>> = [{ text: prompt }];
	if (
		typeof body?.image_base64 === "string" &&
		body.image_base64.trim().length > 0
	) {
		parts.push({
			inlineData: {
				mimeType:
					typeof body?.mime_type === "string" && body.mime_type.trim()
						? body.mime_type.trim()
						: "image/jpeg",
				data: body.image_base64.trim(),
			},
		});
	}

	const ai = new GoogleGenAI({ apiKey: geminiApiKey });
	let geminiResponse: { text?: string } & Record<string, unknown>;
	try {
		geminiResponse = (await ai.models.generateContent({
			model,
			contents: [{ role: "user", parts }],
			config: { temperature: 0 },
		})) as unknown as { text?: string } & Record<string, unknown>;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return NextResponse.json(
			{
				ok: false,
				model,
				error: "Gemini request failed",
				details: message.slice(0, 500),
				timestamp: new Date().toISOString(),
			},
			{ status: 502 },
		);
	}

	const payload = geminiResponse;
	const text = geminiResponse.text ?? "";

	return NextResponse.json({
		ok: true,
		service: "cv-images-ingest-health",
		model,
		gemini_connected: true,
		response_preview: text.slice(0, 500),
		raw: payload,
		timestamp: new Date().toISOString(),
	});
}
