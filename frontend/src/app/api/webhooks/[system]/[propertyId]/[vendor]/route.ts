import { NextResponse } from "next/server";

import {
	hmacSha256Hex,
	parseSignatureHeader,
	parseTimestampToMs,
	sha256Hex,
	timingSafeEqualHex,
} from "@/lib/crypto/hmac";
import {
	normalizePayloadToCanonical,
	sanitizePayloadForStorage,
} from "@/lib/ingest/normalize";
import {
	type ConnectorMapping,
	systemSchema,
	uuidSchema,
} from "@/lib/ingest/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const MAX_BODY_BYTES = 1024 * 1024;
const DEFAULT_SKEW_SECONDS = 300;

type RouteParams = {
	system: string;
	propertyId: string;
	vendor: string;
};

type ConnectorRow = {
	id: string;
	property_id: string;
	system: string;
	vendor: string;
	secret: string;
	is_enabled: boolean;
};

export async function POST(
	req: Request,
	context: { params: Promise<RouteParams> },
) {
	const params = await context.params;
	const parsedSystem = systemSchema.safeParse(params.system);
	if (!parsedSystem.success) {
		return NextResponse.json({ error: "Invalid system" }, { status: 400 });
	}

	const parsedPropertyId = uuidSchema.safeParse(params.propertyId);
	if (!parsedPropertyId.success) {
		return NextResponse.json({ error: "Invalid propertyId" }, { status: 400 });
	}

	const system = parsedSystem.data;
	const propertyId = parsedPropertyId.data;
	const vendor = params.vendor;

	const timestampHeader = req.headers.get("x-hotelguard-timestamp");
	const signatureHeader = req.headers.get("x-hotelguard-signature");
	const vendorEventId = req.headers.get("x-vendor-event-id");

	if (!timestampHeader || !signatureHeader) {
		return NextResponse.json(
			{ error: "Missing required signature headers" },
			{ status: 400 },
		);
	}

	const timestampMs = parseTimestampToMs(timestampHeader);
	if (!timestampMs) {
		return NextResponse.json(
			{ error: "Invalid timestamp header" },
			{ status: 400 },
		);
	}

	const skewLimitSeconds = Number(
		process.env.HOTELGUARD_WEBHOOK_MAX_SKEW_SECONDS ?? DEFAULT_SKEW_SECONDS,
	);
	const skewLimitMs =
		(Number.isFinite(skewLimitSeconds)
			? skewLimitSeconds
			: DEFAULT_SKEW_SECONDS) * 1000;
	if (Math.abs(Date.now() - timestampMs) > skewLimitMs) {
		return NextResponse.json(
			{ error: "Timestamp outside replay window" },
			{ status: 401 },
		);
	}

	const rawBody = await req.text();
	if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
		return NextResponse.json({ error: "Payload too large" }, { status: 413 });
	}

	const signatureHex = parseSignatureHeader(signatureHeader);
	if (!signatureHex) {
		return NextResponse.json(
			{ error: "Invalid signature format" },
			{ status: 400 },
		);
	}

	const { data: connector, error: connectorError } = await supabaseAdmin
		.from("connectors")
		.select("id, property_id, system, vendor, secret, is_enabled")
		.eq("property_id", propertyId)
		.eq("system", system)
		.eq("vendor", vendor)
		.eq("is_enabled", true)
		.maybeSingle<ConnectorRow>();

	if (connectorError) {
		return NextResponse.json(
			{ error: "Connector lookup failed" },
			{ status: 500 },
		);
	}
	if (!connector) {
		return NextResponse.json(
			{ error: "Connector not found or disabled" },
			{ status: 404 },
		);
	}

	const signedPayload = `${timestampHeader}.${rawBody}`;
	const expectedHex = hmacSha256Hex(connector.secret, signedPayload);
	const signatureValid = timingSafeEqualHex(signatureHex, expectedHex);
	if (!signatureValid) {
		return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
	}

	let payloadJson: Record<string, unknown>;
	try {
		payloadJson = JSON.parse(rawBody) as Record<string, unknown>;
	} catch {
		return NextResponse.json(
			{ error: "Body must be valid JSON" },
			{ status: 400 },
		);
	}

	const occurredAtIso = new Date(timestampMs).toISOString();
	const dedupeKey = vendorEventId
		? `${system}:${vendor}:${vendorEventId}`
		: sha256Hex(`${system}:${vendor}:${timestampHeader}:${rawBody}`);

	const safePayload = sanitizePayloadForStorage(payloadJson) as Record<
		string,
		unknown
	>;

	const { data: rawEventInsert, error: rawInsertError } = await supabaseAdmin
		.from("raw_events")
		.insert({
			property_id: propertyId,
			connector_id: connector.id,
			system,
			vendor,
			occurred_at: occurredAtIso,
			vendor_event_id: vendorEventId,
			dedupe_key: dedupeKey,
			signature_valid: true,
			payload: safePayload,
		})
		.select("id")
		.single<{ id: string }>();

	if (rawInsertError) {
		if (rawInsertError.code === "23505") {
			await supabaseAdmin
				.from("connectors")
				.update({ last_seen_at: new Date().toISOString() })
				.eq("id", connector.id);
			return NextResponse.json({ ok: true, deduped: true });
		}
		return NextResponse.json(
			{ error: "Failed to store raw event", details: rawInsertError.message },
			{ status: 500 },
		);
	}

	const rawEventId = rawEventInsert.id;

	const { data: mappingRow } = await supabaseAdmin
		.from("connector_mappings")
		.select("mapping")
		.eq("connector_id", connector.id)
		.maybeSingle<{ mapping: ConnectorMapping }>();

	const canonicalEvents = normalizePayloadToCanonical({
		propertyId,
		connectorId: connector.id,
		system,
		vendor,
		payload: payloadJson,
		occurredAtFallbackIso: occurredAtIso,
		vendorEventId,
		mapping: mappingRow?.mapping ?? null,
	});

	if (canonicalEvents.length > 0) {
		const eventRows = canonicalEvents.map((event) => ({
			property_id: event.property_id,
			connector_id: event.connector_id,
			source_system: event.source.system,
			source_vendor: event.source.vendor,
			event_type: event.event_type,
			occurred_at: event.occurred_at,
			entity_type: event.entity.type,
			entity_id: event.entity.id,
			room_id: event.room?.room_id ?? null,
			data: event.data ?? {},
			raw_event_id: rawEventId,
		}));

		const { error: eventsInsertError } = await supabaseAdmin
			.from("events")
			.insert(eventRows);
		if (eventsInsertError) {
			await supabaseAdmin
				.from("raw_events")
				.update({ error: eventsInsertError.message })
				.eq("id", rawEventId);
			return NextResponse.json(
				{ error: "Failed to store canonical events" },
				{ status: 500 },
			);
		}
	}

	await supabaseAdmin
		.from("connectors")
		.update({ last_seen_at: new Date().toISOString() })
		.eq("id", connector.id);

	return NextResponse.json({
		ok: true,
		deduped: false,
		raw_event_id: rawEventId,
		normalized_count: canonicalEvents.length,
	});
}
