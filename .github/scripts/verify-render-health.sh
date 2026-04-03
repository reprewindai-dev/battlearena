#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-}"

if [[ -z "$BASE_URL" ]]; then
  echo "usage: verify-render-health.sh <base-url>" >&2
  exit 1
fi

EXPECTED_COMMIT="$(git rev-parse HEAD)"
HEALTH_URL="${BASE_URL%/}/api/health"
HEALTH_JSON="$(curl --fail --silent --show-error "$HEALTH_URL")"

echo "$HEALTH_JSON"

LIVE_VERSION="$(printf '%s' "$HEALTH_JSON" | python -c 'import json,sys; print(json.load(sys.stdin).get("version",""))')"

if [[ -z "$LIVE_VERSION" ]]; then
  echo "::error::Health payload did not include a version field." >&2
  exit 1
fi

if [[ "$LIVE_VERSION" != "$EXPECTED_COMMIT" ]]; then
  echo "::error::Deployment version mismatch. Expected $EXPECTED_COMMIT but health reported $LIVE_VERSION" >&2
  exit 1
fi

echo "Verified deployment version $LIVE_VERSION at $HEALTH_URL"