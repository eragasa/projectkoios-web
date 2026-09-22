#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPOS_ROOT="$(cd "$WEB_ROOT/.." && pwd)"
RUN_DIR="${KOIOS_RUN_DIR:-$WEB_ROOT/.run}"
API_REPO="${KOIOS_API_REPO:-$REPOS_ROOT/projectkoios-api}"
CORE_REPO="${KOIOS_CORE_REPO:-$REPOS_ROOT/projectkoios}"
SEARCH_REPO="${KOIOS_SEARCH_REPO:-$REPOS_ROOT/projectkoios-search}"
OBSIDIAN_REPO="${KOIOS_OBSIDIAN_REPO:-$REPOS_ROOT/projectkoios-obsidian}"
API_HOST="${KOIOS_API_HOST:-127.0.0.1}"
API_PORT="${KOIOS_API_PORT:-8000}"
WEB_HOST="${KOIOS_WEB_HOST:-127.0.0.1}"
WEB_PORT="${KOIOS_WEB_PORT:-5173}"
API_PID_FILE="$RUN_DIR/api.pid"
WEB_PID_FILE="$RUN_DIR/web.pid"
API_LOG="$RUN_DIR/api.log"
WEB_LOG="$RUN_DIR/web.log"
STARTED_API=0
STARTED_WEB=0

is_running() {
  local pid_file="$1"
  [ -f "$pid_file" ] || return 1
  local pid
  pid="$(cat "$pid_file")"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

port_is_listening() {
  local port="$1"
  lsof -n -P -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

wait_for_url() {
  local name="$1"
  local url="$2"
  local pid_file="$3"
  local attempts=60
  local attempt=1

  while [ "$attempt" -le "$attempts" ]; do
    if curl --fail --silent --show-error "$url" >/dev/null 2>&1; then
      return 0
    fi
    if ! is_running "$pid_file"; then
      echo "$name stopped before becoming ready." >&2
      return 1
    fi
    sleep 0.25
    attempt=$((attempt + 1))
  done

  echo "Timed out waiting for $name at $url." >&2
  return 1
}

cleanup_on_error() {
  local status=$?
  if [ "$status" -eq 0 ]; then
    return
  fi

  echo "Startup failed. See logs in $RUN_DIR." >&2
  if [ "$STARTED_WEB" -eq 1 ] && is_running "$WEB_PID_FILE"; then
    kill "$(cat "$WEB_PID_FILE")" 2>/dev/null || true
    rm -f "$WEB_PID_FILE"
  fi
  if [ "$STARTED_API" -eq 1 ] && is_running "$API_PID_FILE"; then
    kill "$(cat "$API_PID_FILE")" 2>/dev/null || true
    rm -f "$API_PID_FILE"
  fi
  exit "$status"
}

trap cleanup_on_error EXIT

for command in curl lsof; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

API_PYTHON="$API_REPO/.venv/bin/python"
VITE="$WEB_ROOT/node_modules/.bin/vite"

if [ ! -x "$API_PYTHON" ]; then
  echo "API environment not found: $API_PYTHON" >&2
  echo "Create the projectkoios-api virtual environment first." >&2
  exit 1
fi

if [ ! -x "$VITE" ]; then
  echo "Web dependencies are missing. Run 'npm install' in $WEB_ROOT." >&2
  exit 1
fi

for directory in "$CORE_REPO" "$SEARCH_REPO" "$OBSIDIAN_REPO"; do
  if [ ! -d "$directory/src/python" ]; then
    echo "Required Project Koios source tree not found: $directory" >&2
    exit 1
  fi
done

mkdir -p "$RUN_DIR"

if is_running "$API_PID_FILE"; then
  echo "Project Koios API already running (PID $(cat "$API_PID_FILE"))."
else
  rm -f "$API_PID_FILE"
  if port_is_listening "$API_PORT"; then
    echo "API port $API_PORT is already in use by an unmanaged process." >&2
    exit 1
  fi

  API_PYTHONPATH="$API_REPO/src/python:$CORE_REPO/src/python:$SEARCH_REPO/src/python:$OBSIDIAN_REPO/src/python"
  (
    cd "$API_REPO"
    nohup env PYTHONPATH="$API_PYTHONPATH" \
      KOIOS_DEPLOYMENT_PROFILE=control \
      KOIOS_PROJECT_CATALOG="${KOIOS_PROJECT_CATALOG:-$CORE_REPO/public/project-catalog.json}" \
      KOIOS_GITHUB_REPOSITORIES="${KOIOS_GITHUB_REPOSITORIES:-eragasa/projectkoios-api,eragasa/projectkoios-web}" \
      "$API_PYTHON" -m uvicorn projectkoios.api.main:app \
      --host "$API_HOST" --port "$API_PORT" \
      >>"$API_LOG" 2>&1 </dev/null &
    echo $! >"$API_PID_FILE"
  )
  STARTED_API=1
  wait_for_url "Project Koios API" \
    "http://$API_HOST:$API_PORT/health" "$API_PID_FILE"
  echo "Project Koios API started (PID $(cat "$API_PID_FILE"))."
fi

if is_running "$WEB_PID_FILE"; then
  echo "Project Koios web already running (PID $(cat "$WEB_PID_FILE"))."
else
  rm -f "$WEB_PID_FILE"
  if port_is_listening "$WEB_PORT"; then
    echo "Web port $WEB_PORT is already in use by an unmanaged process." >&2
    exit 1
  fi

  (
    cd "$WEB_ROOT"
    nohup env VITE_KOIOS_DEPLOYMENT_PROFILE=control \
      "$VITE" --host "$WEB_HOST" --port "$WEB_PORT" \
      >>"$WEB_LOG" 2>&1 </dev/null &
    echo $! >"$WEB_PID_FILE"
  )
  STARTED_WEB=1
  wait_for_url "Project Koios web" \
    "http://$WEB_HOST:$WEB_PORT/" "$WEB_PID_FILE"
  echo "Project Koios web started (PID $(cat "$WEB_PID_FILE"))."
fi

trap - EXIT

echo
echo "Project Koios is ready:"
echo "  Web:  http://$WEB_HOST:$WEB_PORT"
echo "  API:  http://$API_HOST:$API_PORT"
echo "  Docs: http://$API_HOST:$API_PORT/docs"
echo "  Logs: $RUN_DIR"

if [ "${KOIOS_OPEN_BROWSER:-0}" = "1" ] && command -v open >/dev/null 2>&1; then
  open "http://$WEB_HOST:$WEB_PORT"
fi
