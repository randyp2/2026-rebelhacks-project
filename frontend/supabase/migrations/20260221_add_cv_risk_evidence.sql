create extension if not exists pgcrypto;

create table if not exists public.cv_risk_evidence (
  id uuid primary key default gen_random_uuid(),
  video_id text not null,
  room_id text not null,
  frame_timestamp timestamptz not null,
  storage_bucket text not null default 'cv-risk-evidence',
  storage_path text not null unique,
  suspicion_score numeric not null default 0 check (suspicion_score >= 0 and suspicion_score <= 1),
  anomaly_signals jsonb not null default '[]'::jsonb,
  analysis_summary text not null default '',
  is_key_frame boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists cv_risk_evidence_video_created_idx
  on public.cv_risk_evidence (video_id, created_at desc);

create index if not exists cv_risk_evidence_room_created_idx
  on public.cv_risk_evidence (room_id, created_at desc);

create index if not exists cv_risk_evidence_score_idx
  on public.cv_risk_evidence (suspicion_score desc, created_at desc);

alter table public.cv_risk_evidence enable row level security;

drop policy if exists cv_risk_evidence_authenticated_read on public.cv_risk_evidence;
create policy cv_risk_evidence_authenticated_read
on public.cv_risk_evidence
for select
to authenticated
using (true);

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'cv-risk-evidence',
      'cv-risk-evidence',
      false,
      10485760,
      array['image/jpeg', 'image/png', 'image/webp']
    )
    on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

    if to_regclass('storage.objects') is not null then
      drop policy if exists cv_risk_evidence_storage_authenticated_read on storage.objects;
      create policy cv_risk_evidence_storage_authenticated_read
      on storage.objects
      for select
      to authenticated
      using (bucket_id = 'cv-risk-evidence');
    end if;
  end if;
end $$;
