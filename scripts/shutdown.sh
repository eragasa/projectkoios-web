#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_DIR="${KOIOS_RUN_DIR:-$WEB_ROOT/.run}"
API_PID_FILE="$RUN_DIR/api.pid"
WEB_PID_FILE="$RUN_DIR/web.pid"
ORGANIZER_PID_FILE="$RUN_DIR/organizer.pid"

stop_process() {
  local name="$1"
  local pid_file="$2"
  local expected_command="$3"

  if [ ! -f "$pid_file" ]; then
    echo "$name is not managed by this workspace."
    return
  fi

  local pid
  pid="$(cat "$pid_file")"
  if [[ ! "$pid" =~ ^[0-9]+$ ]]; then
    echo "$name has an invalid PID file; removing it." >&2
    rm -f "$pid_file"
    return
  fi

  if ! kill -0 "$pid" 2>/dev/null; then
    echo "$name is already stopped."
    rm -f "$pid_file"
    return
  fi

  local command
  command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  if [[ "$command" != *"$expected_command"* ]]; then
    echo "Refusing to stop PID $pid: it is not the managed $name process." >&2
    echo "Observed command: $command" >&2
    return 1
  fi

  kill "$pid"

  local attempts=40
  local attempt=1
  while kill -0 "$pid" 2>/dev/null && [ "$attempt" -le "$attempts" ]; do
    sleep 0.25
    attempt=$((attempt + 1))
  done

  if kill -0 "$pid" 2>/dev/null; then
    echo "$name did not stop after 10 seconds; sending SIGKILL." >&2
    kill -9 "$pid"
  fi

  rm -f "$pid_file"
  echo "$name stopped."
}

stop_process "Project Koios web" "$WEB_PID_FILE" "vite"
stop_process "Project Koios organizer" "$ORGANIZER_PID_FILE" "daemon_main"
stop_process "Project Koios API" "$API_PID_FILE" "uvicorn"

if [ -d "$RUN_DIR" ] && ! find "$RUN_DIR" -mindepth 1 -print -quit | grep -q .; then
  rmdir "$RUN_DIR"
fi
