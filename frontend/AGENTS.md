# Repository Guidelines

## Project Structure & Module Organization
- `frontend/` houses the Next.js App Router UI. Entry routes live in `frontend/src/app`, shared UI pieces in `frontend/src/components`, and Supabase helpers in `frontend/src/utils/supabase`.
- `cv/` contains the Python computer-vision pipeline. The entry point is `cv/main.py` with configuration in `cv/config.py`.
- `supabase/functions/` contains Edge Functions such as `ingest-cv`, `score-risk`, and `seed-demo`.
- `README.md` documents the product requirements and system overview.

## Build, Test, and Development Commands
Frontend (run from `frontend/`):
- `pnpm install` installs dependencies.
- `pnpm dev` starts the local dev server.
- `pnpm build` creates a production build.
- `pnpm start` serves the production build.
- `pnpm lint` runs ESLint.

CV pipeline (run from repo root):
- `pip install -r cv/requirements.txt` installs CV dependencies.
- `python cv/main.py` starts the detection loop.

Supabase utilities:
- Types: `npx supabase gen types typescript --project-id <id>` writes `frontend/src/types/database.ts`.

## Coding Style & Naming Conventions
- TypeScript/React uses strict TS settings and 2-space indentation.
- ESLint is configured in `frontend/eslint.config.mjs` (Next.js core-web-vitals + TypeScript).
- Python uses 4-space indentation; keep module names lowercase with underscores (e.g., `ingestor.py`).
- Use the `@/*` alias for imports under `frontend/src/*`.

## Testing Guidelines
- Automated tests are not wired up yet.
- Placeholder: when tests are added, run `pnpm test` from `frontend/`.

## Commit & Pull Request Guidelines
- Use Conventional Commits (e.g., `feat:`, `fix:`, `chore:`).
- PRs should include a concise summary, linked issue (if any), and screenshots for UI changes.
- Call out any required environment variables or migration steps.

## Security & Configuration Tips
- Do not commit secrets. Use local `.env` files.
- Frontend env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SECRET_KEY`.
- CV env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `CAMERA_SOURCE`, `ROOM_ZONE_MAP`, `YOLO_MODEL`.



