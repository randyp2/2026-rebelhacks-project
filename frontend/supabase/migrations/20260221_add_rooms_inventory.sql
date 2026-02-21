create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  room_id text not null unique,
  floor integer not null check (floor between 1 and 10),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists rooms_floor_idx on public.rooms (floor);
create index if not exists rooms_active_floor_idx on public.rooms (is_active, floor);

insert into public.rooms (room_id, floor)
select
  concat(floor_num::text, lpad(room_seq::text, 3, '0')) as room_id,
  floor_num as floor
from generate_series(1, 10) as floor_num
cross join generate_series(1, 105) as room_seq
on conflict (room_id) do update
set
  floor = excluded.floor,
  is_active = true;
