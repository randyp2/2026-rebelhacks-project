create extension if not exists pgcrypto;

create table if not exists public.cv_frame_analysis (
  id uuid primary key default gen_random_uuid(),
  video_id text not null,
  room_id text not null,
  "timestamp" timestamptz not null,
  camera_id text,
  event_id text,
  person_count integer not null default 0,
  entry_event boolean not null default false,
  confidence numeric not null default 0,
  suspicion_score numeric not null default 0,
  anomaly_signals jsonb not null default '[]'::jsonb,
  analysis_summary text not null default '',
  created_at timestamptz not null default now(),
  unique(video_id, room_id, "timestamp")
);

create index if not exists cv_frame_analysis_video_time_idx
  on public.cv_frame_analysis (video_id, "timestamp" asc);

create index if not exists cv_frame_analysis_room_time_idx
  on public.cv_frame_analysis (room_id, "timestamp" desc);

create table if not exists public.cv_video_summaries (
  video_id text primary key,
  overall_risk_level text not null check (overall_risk_level in ('low', 'medium', 'high')),
  overall_suspicion_score numeric not null default 0,
  video_summary text not null,
  key_patterns jsonb not null default '[]'::jsonb,
  recommended_action text not null,
  frame_count integer not null default 0,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cv_frame_analysis enable row level security;
alter table public.cv_video_summaries enable row level security;

drop policy if exists cv_video_summaries_authenticated_read on public.cv_video_summaries;
create policy cv_video_summaries_authenticated_read
on public.cv_video_summaries
for select
to authenticated
using (true);
