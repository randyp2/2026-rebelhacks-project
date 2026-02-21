import { NextResponse } from "next/server";

import { uuidSchema } from "@/lib/ingest/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type ConnectorHealth = {
	id: string;
	system: string;
	vendor: string;
	last_seen_at: string | null;
	is_enabled: boolean;
};

export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const propertyId = searchParams.get("propertyId");
	const parsedPropertyId = uuidSchema.safeParse(propertyId);

	if (!parsedPropertyId.success) {
		return NextResponse.json(
			{ error: "propertyId query param must be a UUID" },
			{ status: 400 },
		);
	}

	const { data, error } = await supabaseAdmin
		.from("connectors")
		.select("id, system, vendor, last_seen_at, is_enabled")
		.eq("property_id", parsedPropertyId.data)
		.order("system", { ascending: true })
		.order("vendor", { ascending: true })
		.overrideTypes<ConnectorHealth[], { merge: false }>();

	if (error) {
		return NextResponse.json(
			{ error: "Failed to load webhook health" },
			{ status: 500 },
		);
	}

	return NextResponse.json({
		ok: true,
		property_id: parsedPropertyId.data,
		connectors: data ?? [],
	});
}
