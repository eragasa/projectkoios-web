#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
WEB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
REPOS_ROOT="$(cd "$WEB_ROOT/.." && pwd -P)"

# shellcheck source=managed-process.sh
. "$SCRIPT_DIR/managed-process.sh"
koios_load_local_env_preserving_caller "$WEB_ROOT/.env.local"

RUN_DIR="${KOIOS_RUN_DIR:-$WEB_ROOT/.run}"
API_REPO="${KOIOS_API_REPO:-$REPOS_ROOT/projectkoios-api}"
API_HOST="${KOIOS_API_HOST:-127.0.0.1}"
API_PORT="${KOIOS_API_PORT:-8000}"
WEB_HOST="${KOIOS_WEB_HOST:-127.0.0.1}"
WEB_PORT="${KOIOS_WEB_PORT:-5173}"
MANAGED_SERVICE="${KOIOS_MANAGED_SERVICE:-all}"
API_PID_FILE="$RUN_DIR/api.pid"
WEB_PID_FILE="$RUN_DIR/web.pid"
API_COMMAND_MARKER="projectkoios.api.main:app"
WEB_COMMAND_MARKER="node_modules/.bin/vite"

case "$MANAGED_SERVICE" in
  all | api | web) ;;
  *)
    echo "KOIOS_MANAGED_SERVICE must be one of: all, api, web." >&2
    exit 1
    ;;
esac

if [ ! -d "$API_REPO" ]; then
  echo "API repository not found: $API_REPO" >&2
  exit 1
fi
API_REPO="$(cd "$API_REPO" && pwd -P)"

release_lock_on_exit() {
  local status=$?
  trap - EXIT
  koios_release_lifecycle_lock || status=1
  exit "$status"
}

koios_acquire_lifecycle_lock "$RUN_DIR" "stop:$MANAGED_SERVICE"
trap release_lock_on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [ "$MANAGED_SERVICE" = all ] || [ "$MANAGED_SERVICE" = web ]; then
  koios_stop_recorded_process "Project Koios web" "$WEB_PID_FILE" web \
    "$WEB_ROOT" "$WEB_HOST" "$WEB_PORT" "$WEB_COMMAND_MARKER" 1
fi
if [ "$MANAGED_SERVICE" = all ] || [ "$MANAGED_SERVICE" = api ]; then
  koios_stop_recorded_process "Project Koios API" "$API_PID_FILE" api \
    "$API_REPO" "$API_HOST" "$API_PORT" "$API_COMMAND_MARKER" 1
fi
