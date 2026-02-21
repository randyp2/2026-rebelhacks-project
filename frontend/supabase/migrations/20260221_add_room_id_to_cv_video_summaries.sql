alter table if exists public.cv_video_summaries
  add column if not exists room_id text;

create index if not exists cv_video_summaries_room_updated_idx
  on public.cv_video_summaries (room_id, updated_at desc);

update public.cv_video_summaries summaries
set room_id = source.room_id
from (
  select distinct on (video_id) video_id, room_id
  from public.cv_frame_analysis
  where room_id is not null
  order by video_id, "timestamp" asc
) source
where summaries.video_id = source.video_id
  and summaries.room_id is null;
