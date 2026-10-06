#!/usr/bin/env bash
# Smoke test: pokes a RUNNING server with curl and checks status codes and bodies.
# usage: scripts/smoke.sh [base-url]        (default http://127.0.0.1:3000)
# Exit code: 0 if every check passed, 1 otherwise.

set -u
BASE="${1:-http://127.0.0.1:3000}"
failures=0

# check <name> <expected-status> <text the body must contain> <curl arguments...>
check() {
  local name=$1 want_status=$2 want_body=$3
  shift 3
  local out status body
  out=$(curl -s --max-time 5 -w '\n%{http_code}' "$@") || {
    echo "FAIL  $name  (curl could not get an answer; is the server running?)"
    failures=$((failures + 1))
    return
  }
  status=${out##*$'\n'}
  body=${out%$'\n'*}
  if [[ $status == "$want_status" && $body == *"$want_body"* ]]; then
    echo "PASS  $name"
  else
    echo "FAIL  $name  (wanted $want_status containing '$want_body', got $status: $body)"
    failures=$((failures + 1))
  fi
}

check "GET /health"                200 '"status":"ok"'              "$BASE/health"
check "GET /"                      200 'hello from fastify'         "$BASE/"
check "GET /jobs/42"               200 '"id":"42"'                  "$BASE/jobs/42"
check "GET /jobs/recent"           200 '"recent":true'              "$BASE/jobs/recent"
check "GET /jobs?status=done"      200 '"status":"done"'            "$BASE/jobs?status=done"
check "GET /nope"                  404 '"requestId"'                "$BASE/nope"
check "x-request-id is honoured"   404 '"requestId":"smoke-123"'    -H 'x-request-id: smoke-123' "$BASE/nope"

if ((failures > 0)); then
  echo "$failures check(s) failed"
  exit 1
fi
echo "all checks passed"
