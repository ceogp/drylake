#!/usr/bin/env bash

# Required production env vars:
# AUTH_MODE=cognito
# AWS_COGNITO_REGION, AWS_COGNITO_USER_POOL_ID, AWS_COGNITO_CLIENT_ID, AWS_COGNITO_CLIENT_SECRET
# AWS_COGNITO_DOMAIN, AWS_COGNITO_ISSUER, AWS_COGNITO_CALLBACK_URL, AWS_COGNITO_LOGOUT_REDIRECT_URL
# STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
# KIMI_API_KEY or OPENAI_API_KEY
# APP_ENCRYPTION_KEY
# ADMIN_INTERNAL_HOST, ADMIN_INTERNAL_BASIC_AUTH_USERNAME, ADMIN_INTERNAL_BASIC_AUTH_PASSWORD
# BILLING_ENFORCEMENT_MODE=strict
# DATABASE_URL (postgresql://...)
# DATABASE_PROVIDER=postgresql

if [ -z "${APP_BASE_URL:-}" ]; then
  echo "APP_BASE_URL is required." >&2
  exit 1
fi

failures=0
app_base_url="${APP_BASE_URL%/}"

check() {
  local label="$1"
  local expected_code="$2"
  local actual_code=""
  local curl_status=0

  shift 2

  actual_code="$(curl --max-time 15 -s -o /dev/null -w "%{http_code}" "$@")"
  curl_status=$?

  if [ "$curl_status" -eq 0 ] && [ "$actual_code" = "$expected_code" ]; then
    echo "PASS $label: HTTP $actual_code"
  else
    echo "FAIL $label: expected HTTP $expected_code, got HTTP ${actual_code:-000} (curl exit $curl_status)"
    failures=$((failures + 1))
  fi
}

check "health" "200" "$app_base_url/api/v1/health"

health_payload="$(curl --max-time 15 -fsS "$app_base_url/api/v1/health" || true)"
if [ -n "$health_payload" ]; then
  printf '%s' "$health_payload" | node -e '
    const input = require("node:fs").readFileSync(0, "utf8");
    const payload = JSON.parse(input);
    const release = payload.release || {};
    console.log(`Verified release: ${release.shortSha || "unknown"} ref=${release.ref || "unknown"} pipeline=${release.pipelineId || "unknown"} deployedAt=${release.deployedAt || "unknown"}`);
  ' || true
fi

check "extension install" "200" "$app_base_url/extensions/install"
check "extension connect" "200" "$app_base_url/extensions/connect"
check "agent control GIF" "200" "$app_base_url/marketplace/extension/media/agent-control.gif"

if [ -f "public/marketplace/extension/media/guard-security.gif" ] || [ "${VERIFY_GUARD_SECURITY_GIF:-false}" = "true" ]; then
  check "guard security GIF" "200" "$app_base_url/marketplace/extension/media/guard-security.gif"
else
  echo "SKIP guard security GIF: public/marketplace/extension/media/guard-security.gif is not present locally"
fi

check "stripe webhook empty body" "400" -X POST -d '' "$app_base_url/api/stripe/webhook"

if [ -n "${ADMIN_INTERNAL_HOST:-}" ]; then
  check "admin internal auth challenge" "401" "https://$ADMIN_INTERNAL_HOST/admin"
else
  echo "SKIP admin internal auth challenge: ADMIN_INTERNAL_HOST is not set"
fi

if [ "$failures" -gt 0 ]; then
  echo "Deployment verification failed with $failures failure(s)."
  exit 1
fi

echo "Deployment verification succeeded."
exit 0
