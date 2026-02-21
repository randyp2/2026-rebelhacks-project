create table if not exists public.property_memberships (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (property_id, user_id)
);

create index if not exists property_memberships_user_idx on public.property_memberships (user_id);

create table if not exists public.hotel_signup_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  hotel_name text not null,
  contact_email text,
  contact_name text,
  requested_connectors jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  approved_property_id uuid references public.properties(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hotel_signup_requests_status_idx on public.hotel_signup_requests (status, created_at desc);
create index if not exists hotel_signup_requests_requester_idx on public.hotel_signup_requests (requester_user_id, created_at desc);

alter table public.property_memberships enable row level security;
alter table public.hotel_signup_requests enable row level security;

drop policy if exists property_memberships_self_read on public.property_memberships;
create policy property_memberships_self_read
on public.property_memberships
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists hotel_signup_requests_self_read on public.hotel_signup_requests;
create policy hotel_signup_requests_self_read
on public.hotel_signup_requests
for select
to authenticated
using (auth.uid() = requester_user_id);

drop policy if exists hotel_signup_requests_self_insert on public.hotel_signup_requests;
create policy hotel_signup_requests_self_insert
on public.hotel_signup_requests
for insert
to authenticated
with check (auth.uid() = requester_user_id and status = 'pending');

