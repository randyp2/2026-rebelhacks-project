alter table if exists public.cv_risk_evidence
  add column if not exists frame_mime_type text,
  add column if not exists frame_image_base64 text;
