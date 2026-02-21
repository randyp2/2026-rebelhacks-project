#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
PROPERTY_ID="${PROPERTY_ID:-11111111-1111-4111-8111-111111111111}"
PMS_SECRET="${PMS_SECRET:-demo-pms-secret}"
HK_SECRET="${HK_SECRET:-demo-housekeeping-secret}"

sign_payload() {
  local secret="$1"
  local timestamp="$2"
  local body_file="$3"
  {
    printf "%s." "$timestamp"
    cat "$body_file"
  } \
    | openssl dgst -sha256 -hmac "$secret" -binary \
    | xxd -p -c 256
}

post_webhook() {
  local system="$1"
  local vendor="$2"
  local secret="$3"
  local body_file="$4"
  local vendor_event_id="$5"
  local ts
  ts="$(date -u +%s)"
  local sig
  sig="$(sign_payload "$secret" "$ts" "$body_file")"

  echo "POST /api/webhooks/$system/$PROPERTY_ID/$vendor"
  curl -sS -X POST "$BASE_URL/api/webhooks/$system/$PROPERTY_ID/$vendor" \
    -H "content-type: application/json" \
    -H "x-hotelguard-timestamp: $ts" \
    -H "x-hotelguard-signature: v1=$sig" \
    -H "x-vendor-event-id: $vendor_event_id" \
    --data-binary "@$body_file"
  echo
  echo
}

post_webhook "pms" "mews" "$PMS_SECRET" "testdata/pms-mews.json" "pms-evt-1001"
post_webhook "housekeeping" "vendorA" "$HK_SECRET" "testdata/housekeeping-vendorA.json" "hk-evt-2001"

echo "GET /api/webhooks/health?propertyId=$PROPERTY_ID"
curl -sS "$BASE_URL/api/webhooks/health?propertyId=$PROPERTY_ID"
echo
