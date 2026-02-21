import { NextResponse } from "next/server";

import { timingSafeEqualString } from "@/lib/crypto/hmac";
import { sanitizePayloadForStorage } from "@/lib/ingest/normalize";
import { canonicalEventArraySchema } from "@/lib/ingest/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
	const expected = process.env.HOTELGUARD_ADMIN_TOKEN;
	if (!expected) {
		return NextResponse.json(
			{ error: "Server misconfigured: missing HOTELGUARD_ADMIN_TOKEN" },
			{ status: 500 },
		);
	}

	const supplied = req.headers.get("x-hotelguard-admin-token");
	if (!supplied || !timingSafeEqualString(supplied, expected)) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	let parsedBody: unknown;
	try {
		parsedBody = await req.json();
	} catch {
		return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
	}

	const validated = canonicalEventArraySchema.safeParse(parsedBody);
	if (!validated.success) {
		return NextResponse.json(
			{
				error: "Invalid canonical event payload",
				issues: validated.error.issues,
			},
			{ status: 400 },
		);
	}

	const rows = validated.data.map((event) => ({
		property_id: event.property_id,
		connector_id: event.connector_id,
		source_system: event.source.system,
		source_vendor: event.source.vendor,
		event_type: event.event_type,
		occurred_at: event.occurred_at,
		entity_type: event.entity.type,
		entity_id: event.entity.id,
		room_id: event.room?.room_id ?? null,
		data: sanitizePayloadForStorage(event.data ?? {}) as Record<
			string,
			unknown
		>,
		raw_event_id: null,
	}));

	const { error } = await supabaseAdmin.from("events").insert(rows);
	if (error) {
		return NextResponse.json(
			{ error: "Failed to insert canonical events", details: error.message },
			{ status: 500 },
		);
	}

	return NextResponse.json({ ok: true, inserted: rows.length });
}
