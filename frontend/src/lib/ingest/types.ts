import { z } from "zod";

export const SYSTEMS = ["pms", "housekeeping"] as const;
export const ENTITY_TYPES = ["stay", "room", "zone"] as const;

export const systemSchema = z.enum(SYSTEMS);
export const entityTypeSchema = z.enum(ENTITY_TYPES);
export const uuidSchema = z.string().uuid();

export const canonicalEventSchema = z.object({
	property_id: uuidSchema,
	connector_id: uuidSchema,
	source: z.object({
		system: systemSchema,
		vendor: z.string().min(1),
	}),
	event_type: z.string().min(1),
	occurred_at: z.iso.datetime({ offset: true }),
	entity: z.object({
		type: entityTypeSchema,
		id: z.string().min(1),
	}),
	room: z.object({ room_id: z.string().nullable().optional() }).optional(),
	data: z.record(z.string(), z.unknown()).optional(),
	raw_ref: z
		.object({ vendor_event_id: z.string().nullable().optional() })
		.optional(),
	schema_version: z.literal("1.0"),
});

export const canonicalEventArraySchema = z.array(canonicalEventSchema).min(1);

export type SystemType = z.infer<typeof systemSchema>;
export type EntityType = z.infer<typeof entityTypeSchema>;
export type CanonicalEvent = z.infer<typeof canonicalEventSchema>;

export type ConnectorMapping = {
	eventTypeMap?: Record<string, string>;
	fieldMap?: Record<string, string[]>;
	roomNormalization?: {
		pad_to_4?: boolean;
		strip_prefix?: string[];
	};
	valueMaps?: Record<string, Record<string, string>>;
};
