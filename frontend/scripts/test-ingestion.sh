#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
PROPERTY_ID="${PROPERTY_ID:-11111111-1111-4111-8111-111111111111}"
PMS_SECRET="${PMS_SECRET:-demo-pms-secret}"
HK_SECRET="${HK_SECRET:-demo-housekeeping-secret}"
ADMIN_TOKEN="${HOTELGUARD_ADMIN_TOKEN:-}"
RUN_ID="${RUN_ID:-$(date -u +%s)}"

RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
RESET=$'\033[0m'

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass_count=0
fail_count=0

log_pass() {
  echo "${GREEN}PASS${RESET} $1"
  pass_count=$((pass_count + 1))
}

log_fail() {
  echo "${RED}FAIL${RESET} $1"
  fail_count=$((fail_count + 1))
}

assert_json_field() {
  local file="$1"
  local expression="$2"
  node -e "const fs=require('fs'); const obj=JSON.parse(fs.readFileSync('$file','utf8')); if(!($expression)){process.exit(1)}"
}

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

run_request() {
  local method="$1"
  local path="$2"
  local body_file="${3:-}"
  shift 3 || true
  local -a headers=("$@")

  local out_body="$TMP_DIR/body.json"
  local out_status="$TMP_DIR/status.txt"

  local curl_cmd=(curl -sS -o "$out_body" -w "%{http_code}" -X "$method" "$BASE_URL$path")
  if (( ${#headers[@]} > 0 )); then
    for h in "${headers[@]}"; do
      curl_cmd+=(-H "$h")
    done
  fi
  if [[ -n "$body_file" ]]; then
    curl_cmd+=(--data-binary "@$body_file")
  fi

  "${curl_cmd[@]}" > "$out_status"
  printf "%s %s\n" "$(cat "$out_status")" "$out_body"
}

test_webhook_ok_then_dedupe() {
  local system="$1"
  local vendor="$2"
  local secret="$3"
  local body_file="$4"
  local event_id="$5"
  local label="$6"

  local ts sig status body_path
  ts="$(date -u +%s)"
  sig="$(sign_payload "$secret" "$ts" "$body_file")"
  read -r status body_path < <(run_request POST "/api/webhooks/$system/$PROPERTY_ID/$vendor" "$body_file" \
    "content-type: application/json" \
    "x-hotelguard-timestamp: $ts" \
    "x-hotelguard-signature: v1=$sig" \
    "x-vendor-event-id: $event_id")

  if [[ "$status" == "200" ]] && assert_json_field "$body_path" "obj.ok===true && obj.deduped===false && typeof obj.normalized_count==='number'"; then
    log_pass "$label first delivery accepted"
  else
    log_fail "$label first delivery expected 200 {ok:true,deduped:false}"
    [[ -n "$body_path" && -f "$body_path" ]] && cat "$body_path"
  fi

  read -r status body_path < <(run_request POST "/api/webhooks/$system/$PROPERTY_ID/$vendor" "$body_file" \
    "content-type: application/json" \
    "x-hotelguard-timestamp: $ts" \
    "x-hotelguard-signature: v1=$sig" \
    "x-vendor-event-id: $event_id")

  if [[ "$status" == "200" ]] && assert_json_field "$body_path" "obj.ok===true && obj.deduped===true"; then
    log_pass "$label duplicate delivery deduped"
  else
    log_fail "$label duplicate delivery expected dedupe"
    [[ -n "$body_path" && -f "$body_path" ]] && cat "$body_path"
  fi
}

test_bad_signature_rejected() {
  local ts status body_path
  ts="$(date -u +%s)"
  read -r status body_path < <(run_request POST "/api/webhooks/pms/$PROPERTY_ID/mews" "testdata/pms-mews.json" \
    "content-type: application/json" \
    "x-hotelguard-timestamp: $ts" \
    "x-hotelguard-signature: v1=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" \
    "x-vendor-event-id: bad-sig-1")

  if [[ "$status" == "401" ]]; then
    log_pass "invalid signature rejected with 401"
  else
    log_fail "invalid signature should return 401"
    [[ -n "$body_path" && -f "$body_path" ]] && cat "$body_path"
  fi
}

test_health() {
  local status body_path
  read -r status body_path < <(run_request GET "/api/webhooks/health?propertyId=$PROPERTY_ID" "")
  if [[ "$status" == "200" ]] && assert_json_field "$body_path" "obj.ok===true && Array.isArray(obj.connectors)"; then
    log_pass "health endpoint returns connector status"
  else
    log_fail "health endpoint should return 200 with connectors"
    [[ -n "$body_path" && -f "$body_path" ]] && cat "$body_path"
  fi
}

test_canonical_ingest() {
  local status body_path
  read -r status body_path < <(run_request POST "/api/ingest/canonical" "testdata/canonical-events.json" \
    "content-type: application/json" \
    "x-hotelguard-admin-token: wrong-token")
  if [[ "$status" == "401" ]]; then
    log_pass "canonical ingest rejects bad admin token"
  elif [[ "$status" == "500" ]] && assert_json_field "$body_path" "typeof obj.error==='string' && obj.error.includes('HOTELGUARD_ADMIN_TOKEN')"; then
    echo "${YELLOW}SKIP${RESET} canonical ingest auth checks (server missing HOTELGUARD_ADMIN_TOKEN)"
    return
  else
    log_fail "canonical ingest should reject bad token"
    [[ -n "$body_path" && -f "$body_path" ]] && cat "$body_path"
  fi

  if [[ -z "$ADMIN_TOKEN" ]]; then
    echo "${YELLOW}SKIP${RESET} canonical ingest success case (set HOTELGUARD_ADMIN_TOKEN in shell)"
    return
  fi

  read -r status body_path < <(run_request POST "/api/ingest/canonical" "testdata/canonical-events.json" \
    "content-type: application/json" \
    "x-hotelguard-admin-token: $ADMIN_TOKEN")
  if [[ "$status" == "200" ]] && assert_json_field "$body_path" "obj.ok===true && typeof obj.inserted==='number' && obj.inserted>0"; then
    log_pass "canonical ingest accepts valid admin token"
  else
    log_fail "canonical ingest should accept valid admin token"
    [[ -n "$body_path" && -f "$body_path" ]] && cat "$body_path"
  fi
}

echo "Running ingestion API integration checks against $BASE_URL"

test_webhook_ok_then_dedupe "pms" "mews" "$PMS_SECRET" "testdata/pms-mews.json" "itest-pms-$RUN_ID" "PMS"
test_webhook_ok_then_dedupe "housekeeping" "vendorA" "$HK_SECRET" "testdata/housekeeping-vendorA.json" "itest-hk-$RUN_ID" "Housekeeping"
test_bad_signature_rejected
test_health
test_canonical_ingest

echo
echo "Summary: $pass_count passed, $fail_count failed"
if [[ $fail_count -gt 0 ]]; then
  exit 1
fi
