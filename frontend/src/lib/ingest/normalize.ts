import { sha256Hex } from "@/lib/crypto/hmac";
import type { CanonicalEvent, ConnectorMapping, EntityType, SystemType } from "@/lib/ingest/types";

type NormalizeInput = {
  propertyId: string;
  connectorId: string;
  system: SystemType;
  vendor: string;
  payload: Record<string, unknown>;
  occurredAtFallbackIso: string;
  vendorEventId?: string | null;
  mapping?: ConnectorMapping | null;
};

export function getByPath(payload: unknown, path: string): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((curr, key) => {
    if (curr && typeof curr === "object" && key in (curr as Record<string, unknown>)) {
      return (curr as Record<string, unknown>)[key];
    }
    return undefined;
  }, payload);
}

export function firstPresent(payload: unknown, paths: string[] = []): unknown {
  for (const path of paths) {
    const value = getByPath(payload, path);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

export function sanitizePayloadForStorage(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map((v) => sanitizePayloadForStorage(v));
  }

  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const lower = k.toLowerCase();

      if (/guest.?name|first.?name|last.?name|full.?name/.test(lower)) {
        continue;
      }

      if (
        /device.*id|mac|client.*id|identifier|imei|imsi/.test(lower) &&
        typeof v === "string" &&
        v.length > 0
      ) {
        out[k] = `sha256:${sha256Hex(v)}`;
        continue;
      }

      out[k] = sanitizePayloadForStorage(v);
    }
    return out;
  }

  return input;
}

function toIsoDate(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return fallback;
  return new Date(parsed).toISOString();
}

function normalizeRoomId(value: unknown, options: ConnectorMapping["roomNormalization"]): string | null {
  if (value === undefined || value === null) return null;
  let room = String(value).trim();
  if (!room) return null;

  const prefixes = options?.strip_prefix ?? [];
  for (const prefix of prefixes) {
    if (room.startsWith(prefix)) {
      room = room.slice(prefix.length);
    }
  }

  if (options?.pad_to_4) {
    room = room.padStart(4, "0");
  }

  return room;
}

function mapValue(fieldName: string, value: unknown, valueMaps?: ConnectorMapping["valueMaps"]): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string") return value;
  const map = valueMaps?.[fieldName];
  if (!map) return value;
  return map[value] ?? map[value.toLowerCase()] ?? value;
}

function inferEntityType(system: SystemType): EntityType {
  if (system === "pms") return "stay";
  return "room";
}

function inferDefaultEventType(system: SystemType): string {
  if (system === "pms") return "STAY_CREATED";
  return "SUPPLY_REQUESTED";
}

function extractHousekeepingNotes(notes: string) {
  const normalized = notes.toLowerCase();
  const supplies: Array<{ item: string; quantity: number }> = [];

  const itemRegex = /(\d+)\s*(towels?|linens?|pillows?|blankets?|soap)/gi;
  for (const match of normalized.matchAll(itemRegex)) {
    const quantity = Number(match[1] ?? "1");
    const item = String(match[2] ?? "").replace(/s$/, "");
    if (item && Number.isFinite(quantity)) {
      supplies.push({ item, quantity });
    }
  }

  const hasRequest = /request|need|deliver|send/.test(normalized);
  const dndStart = /dnd\s*(on|start|started)|do not disturb.*(on|start)/.test(normalized);
  const dndEnd = /dnd\s*(off|end|ended)|do not disturb.*(off|end)/.test(normalized);
  const refused = /refus(e|ed)|declin(e|ed)/.test(normalized);

  return { supplies, hasRequest, dndStart, dndEnd, refused };
}

function normalizeEventType(
  rawType: unknown,
  mapping: ConnectorMapping | null | undefined,
  system: SystemType,
  notesValue?: string,
): string {
  const raw = String(rawType ?? "").trim();
  const mapped = raw ? mapping?.eventTypeMap?.[raw] ?? mapping?.eventTypeMap?.[raw.toLowerCase()] : undefined;
  if (mapped) return mapped;

  if (system === "housekeeping" && notesValue) {
    const extracted = extractHousekeepingNotes(notesValue);
    if (extracted.dndStart) return "DND_STARTED";
    if (extracted.dndEnd) return "DND_ENDED";
    if (extracted.refused) return "HOUSEKEEPING_REFUSED";
    if (extracted.hasRequest || extracted.supplies.length > 0) return "SUPPLY_REQUESTED";
  }

  if (raw) return raw.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  return inferDefaultEventType(system);
}

export function normalizePayloadToCanonical(input: NormalizeInput): CanonicalEvent[] {
  const fieldMap = input.mapping?.fieldMap ?? {};
  const notes = String(firstPresent(input.payload, fieldMap.notes ?? ["notes", "message", "description"]) ?? "");

  const rawType = firstPresent(input.payload, fieldMap.event_name ?? ["event", "type", "eventName"]);
  const eventType = normalizeEventType(rawType, input.mapping, input.system, notes);

  const occurredAtRaw = firstPresent(input.payload, fieldMap.occurred_at ?? ["occurred_at", "timestamp", "eventTime"]);
  const occurredAt = toIsoDate(occurredAtRaw, input.occurredAtFallbackIso);

  const entityTypeRaw = firstPresent(input.payload, fieldMap.entity_type ?? ["entity.type"]);
  const entityType = (entityTypeRaw && ["stay", "room", "zone"].includes(String(entityTypeRaw))
    ? String(entityTypeRaw)
    : inferEntityType(input.system)) as EntityType;

  const roomFromPayload = firstPresent(input.payload, fieldMap.room_id ?? ["room_id", "room.number", "room"]);
  const roomId = normalizeRoomId(roomFromPayload, input.mapping?.roomNormalization);

  const entityIdRaw =
    firstPresent(input.payload, fieldMap.entity_id ?? []) ??
    firstPresent(input.payload, fieldMap.stay_id ?? ["stay_id", "reservation.id", "bookingId"]) ??
    firstPresent(input.payload, fieldMap.zone_id ?? ["zone_id"]);

  let entityId = entityIdRaw ? String(entityIdRaw) : "";
  const data: Record<string, unknown> = {};

  if (input.system === "housekeeping" && notes) {
    const extracted = extractHousekeepingNotes(notes);
    if (extracted.supplies.length > 0) {
      data.supplies = extracted.supplies;
    }
  }

  for (const [canonicalField, paths] of Object.entries(fieldMap)) {
    const value = firstPresent(input.payload, paths);
    if (value !== undefined) {
      data[canonicalField] = mapValue(canonicalField, value, input.mapping?.valueMaps);
    }
  }

  if (!entityId && roomId) {
    entityId = roomId;
  }
  if (!entityId) {
    entityId = "unknown";
  }

  const event: CanonicalEvent = {
    property_id: input.propertyId,
    connector_id: input.connectorId,
    source: {
      system: input.system,
      vendor: input.vendor,
    },
    event_type: eventType,
    occurred_at: occurredAt,
    entity: {
      type: entityType,
      id: entityId,
    },
    room: {
      room_id: roomId,
    },
    data: sanitizePayloadForStorage(data) as Record<string, unknown>,
    raw_ref: {
      vendor_event_id: input.vendorEventId ?? null,
    },
    schema_version: "1.0",
  };

  return [event];
}
