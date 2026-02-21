create extension if not exists pgcrypto;

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.connectors (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  system text not null check (system in ('pms','housekeeping')),
  vendor text not null,
  secret text not null,
  is_enabled boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique(property_id, system, vendor)
);

create table if not exists public.connector_mappings (
  id uuid primary key default gen_random_uuid(),
  connector_id uuid not null unique references public.connectors(id) on delete cascade,
  mapping jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.raw_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  connector_id uuid not null references public.connectors(id) on delete cascade,
  system text not null,
  vendor text not null,
  received_at timestamptz not null default now(),
  occurred_at timestamptz,
  vendor_event_id text,
  dedupe_key text not null,
  signature_valid boolean not null default true,
  payload jsonb not null,
  error text,
  unique(property_id, dedupe_key)
);

create index if not exists raw_events_connector_received_idx on public.raw_events (connector_id, received_at desc);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  connector_id uuid not null references public.connectors(id) on delete cascade,
  source_system text not null,
  source_vendor text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  entity_type text not null check (entity_type in ('stay','room','zone')),
  entity_id text not null,
  room_id text,
  data jsonb not null default '{}'::jsonb,
  raw_event_id uuid references public.raw_events(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists events_property_occurred_idx on public.events (property_id, occurred_at desc);
create index if not exists events_property_room_occurred_idx on public.events (property_id, room_id, occurred_at desc);

alter table public.raw_events enable row level security;
alter table public.events enable row level security;
alter table public.connectors enable row level security;
alter table public.connector_mappings enable row level security;

revoke all on public.raw_events from anon, authenticated;
revoke all on public.events from anon, authenticated;
revoke all on public.connectors from anon, authenticated;
revoke all on public.connector_mappings from anon, authenticated;

drop policy if exists events_authenticated_read on public.events;
create policy events_authenticated_read
on public.events
for select
to authenticated
using (true);

insert into public.properties (id, name)
values ('11111111-1111-4111-8111-111111111111', 'Demo Vegas Hotel')
on conflict (id) do update set name = excluded.name;

insert into public.connectors (id, property_id, system, vendor, secret, is_enabled)
values
  ('22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 'pms', 'mews', 'demo-pms-secret', true),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'housekeeping', 'vendorA', 'demo-housekeeping-secret', true)
on conflict (property_id, system, vendor) do update
set secret = excluded.secret,
    is_enabled = excluded.is_enabled;

insert into public.connector_mappings (connector_id, mapping)
values
(
  '22222222-2222-4222-8222-222222222221',
  '{
    "eventTypeMap": {
      "reservation.created": "STAY_CREATED",
      "room.assigned": "ROOM_ASSIGNED",
      "reservation.extended": "STAY_EXTENDED",
      "checkout": "CHECKOUT"
    },
    "fieldMap": {
      "event_name": ["event"],
      "occurred_at": ["occurredAt"],
      "entity_id": ["reservation.id"],
      "room_id": ["reservation.assignedRoomNumber"],
      "stay_id": ["reservation.id"]
    },
    "roomNormalization": {
      "strip_prefix": ["RM-"],
      "pad_to_4": true
    }
  }'::jsonb
),
(
  '22222222-2222-4222-8222-222222222222',
  '{
    "eventTypeMap": {
      "service.note": "SUPPLY_REQUESTED",
      "housekeeping.refused": "HOUSEKEEPING_REFUSED",
      "dnd.start": "DND_STARTED",
      "dnd.end": "DND_ENDED"
    },
    "fieldMap": {
      "event_name": ["type"],
      "occurred_at": ["created_at"],
      "room_id": ["room.number", "roomNumber"],
      "entity_id": ["room.number", "roomNumber"],
      "notes": ["note", "notes"]
    },
    "roomNormalization": {
      "strip_prefix": ["R-"],
      "pad_to_4": true
    },
    "valueMaps": {
      "supply_type": {
        "linens": "linen",
        "towels": "towel"
      }
    }
  }'::jsonb
)
on conflict (connector_id) do update
set mapping = excluded.mapping;
