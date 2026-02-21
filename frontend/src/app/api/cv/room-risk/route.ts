import { NextResponse } from "next/server";

import { timingSafeEqualString } from "@/lib/crypto/hmac";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const DEFAULT_HIGH_RISK_THRESHOLD = 10;

type RequestBody = {
	room_id?: unknown;
};

function unauthorized() {
	return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

function badRequest(error: string) {
	return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function POST(req: Request) {
	const expected = process.env.CV_API_KEY;
	if (!expected) {
		return NextResponse.json(
			{ ok: false, error: "Server misconfigured: missing CV_API_KEY" },
			{ status: 500 },
		);
	}

	const supplied = req.headers.get("x-cv-api-key");
	if (!supplied || !timingSafeEqualString(supplied, expected)) {
		return unauthorized();
	}

	const parsedThreshold = Number(process.env.CV_HIGH_RISK_THRESHOLD);
	const threshold =
		Number.isFinite(parsedThreshold) && parsedThreshold > 0
			? parsedThreshold
			: DEFAULT_HIGH_RISK_THRESHOLD;

	const body = (await req.json().catch(() => null)) as RequestBody | null;
	const roomId = typeof body?.room_id === "string" ? body.room_id.trim() : "";
	if (!roomId) {
		return badRequest("Missing room_id");
	}

	const { data, error } = await supabaseAdmin
		.from("room_risk")
		.select("room_id,risk_score,last_updated")
		.eq("room_id", roomId)
		.maybeSingle();

	if (error) {
		return NextResponse.json(
			{ ok: false, error: "Failed to query room_risk", details: error.message },
			{ status: 500 },
		);
	}

	if (!data) {
		return NextResponse.json({
			ok: true,
			found: false,
			room_id: roomId,
			risk_score: null,
			risk_threshold: threshold,
			is_high_risk: false,
			last_updated: null,
		});
	}

	return NextResponse.json({
		ok: true,
		found: true,
		room_id: data.room_id,
		risk_score: data.risk_score,
		risk_threshold: threshold,
		is_high_risk: data.risk_score >= threshold,
		last_updated: data.last_updated,
	});
}
