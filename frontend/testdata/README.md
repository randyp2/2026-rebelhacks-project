Local webhook test flow:

1. Start Next.js:
`pnpm dev`

2. Run signed webhook requests:
`bash scripts/test-webhooks.sh`

3. Run full integration checks (assertions + dedupe + canonical ingest):
`bash scripts/test-ingestion.sh`

4. Optional env overrides:
- `BASE_URL` (default `http://localhost:3000`)
- `PROPERTY_ID` (default demo property UUID from seed SQL)
- `PMS_SECRET`, `HK_SECRET` (defaults match seed SQL)
- `HOTELGUARD_ADMIN_TOKEN` (required to run successful `/api/ingest/canonical` assertion)
