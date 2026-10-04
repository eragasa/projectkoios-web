#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
WEB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
REPOS_ROOT="$(cd "$WEB_ROOT/.." && pwd -P)"

# shellcheck source=managed-process.sh
. "$SCRIPT_DIR/managed-process.sh"
koios_load_local_env_preserving_caller "$WEB_ROOT/.env.local"

DEPLOYMENT_SURFACE="${KOIOS_DEPLOYMENT_SURFACE:-web}"
case "$DEPLOYMENT_SURFACE" in
  www)
    DEPLOYMENT_PROFILE=public
    DEFAULT_API_PORT=8100
    DEFAULT_WEB_PORT=4173
    ;;
  web)
    DEPLOYMENT_PROFILE=control
    DEFAULT_API_PORT=8000
    DEFAULT_WEB_PORT=5173
    ;;
  *)
    echo "KOIOS_DEPLOYMENT_SURFACE must be one of: www, web." >&2
    exit 1
    ;;
esac
if [ "${KOIOS_DEPLOYMENT_PROFILE:-$DEPLOYMENT_PROFILE}" != "$DEPLOYMENT_PROFILE" ]; then
  echo "KOIOS_DEPLOYMENT_PROFILE conflicts with $DEPLOYMENT_SURFACE surface profile $DEPLOYMENT_PROFILE." >&2
  exit 1
fi
if [ "${VITE_KOIOS_DEPLOYMENT_PROFILE:-$DEPLOYMENT_PROFILE}" != "$DEPLOYMENT_PROFILE" ]; then
  echo "VITE_KOIOS_DEPLOYMENT_PROFILE conflicts with $DEPLOYMENT_SURFACE surface profile $DEPLOYMENT_PROFILE." >&2
  exit 1
fi

koios_resolve_run_dir "$WEB_ROOT" "$DEPLOYMENT_SURFACE"
RUN_DIR="$KOIOS_RESOLVED_RUN_DIR"
API_REPO="${KOIOS_API_REPO:-$REPOS_ROOT/projectkoios-api}"
CORE_REPO="${KOIOS_CORE_REPO:-$REPOS_ROOT/projectkoios}"
SEARCH_REPO="${KOIOS_SEARCH_REPO:-$REPOS_ROOT/projectkoios-search}"
OBSIDIAN_REPO="${KOIOS_OBSIDIAN_REPO:-$REPOS_ROOT/projectkoios-obsidian}"
APPLICATIONS_REPO="${KOIOS_APPLICATIONS_REPO:-$REPOS_ROOT/projectkoios-applications}"
INGESTION_REPO="${KOIOS_INGESTION_REPO:-$REPOS_ROOT/projectkoios-ingestion}"
REFERENCES_REPO="${KOIOS_REFERENCES_REPO:-$REPOS_ROOT/projectkoios-references}"
EQUATION_REVIEW_OWNER_ENABLED=0
EQUATION_REVIEW_DOCUMENT_ROOT=""
API_HOST="${KOIOS_API_HOST:-127.0.0.1}"
API_PORT="${KOIOS_API_PORT:-$DEFAULT_API_PORT}"
WEB_HOST="${KOIOS_WEB_HOST:-127.0.0.1}"
WEB_PORT="${KOIOS_WEB_PORT:-$DEFAULT_WEB_PORT}"
API_PID_FILE="$RUN_DIR/api.pid"
WEB_PID_FILE="$RUN_DIR/web.pid"
API_LOG="$RUN_DIR/api.log"
WEB_LOG="$RUN_DIR/web.log"
API_HEALTH_URL="http://$API_HOST:$API_PORT/health"
API_OPENAPI_URL="http://$API_HOST:$API_PORT/openapi.json"
WEB_HEALTH_URL="http://$WEB_HOST:$WEB_PORT/"
API_COMMAND_MARKER="projectkoios.api.main:app"
WEB_COMMAND_MARKER="node_modules/.bin/vite"
API_SERVICE_ID="$DEPLOYMENT_SURFACE-api"
WEB_SERVICE_ID="$DEPLOYMENT_SURFACE-web"
STARTED_API=0
STARTED_WEB=0
API_SPAWNED_PID=""
WEB_SPAWNED_PID=""

verify_api_surface() {
  local openapi
  if ! openapi="$(curl --fail --silent --show-error --connect-timeout 1 --max-time 3 "$API_OPENAPI_URL")"; then
    echo "Could not verify $DEPLOYMENT_SURFACE API OpenAPI at $API_OPENAPI_URL." >&2
    return 1
  fi
  local intake_path='"/project-reference-intake/ksdft2effmass/missing-pdfs"'
  case "$DEPLOYMENT_SURFACE" in
    www)
      if [[ "$openapi" == *"$intake_path"* ]]; then
        echo "Refusing www API: PUBLIC OpenAPI exposes CONTROL project-reference intake." >&2
        return 1
      fi
      ;;
    web)
      if [[ "$openapi" != *"$intake_path"* ]]; then
        echo "Refusing web API: CONTROL OpenAPI omits project-reference intake." >&2
        return 1
      fi
      ;;
  esac
}

wait_for_url() {
  local name="$1"
  local url="$2"
  local record_file="$3"
  local service="$4"
  local cwd="$5"
  local host="$6"
  local port="$7"
  local marker="$8"
  local attempts="${KOIOS_STARTUP_READY_ATTEMPTS:-60}"
  local delay="${KOIOS_STARTUP_READY_DELAY:-0.25}"
  local attempt=1

  while [ "$attempt" -le "$attempts" ]; do
    if curl --fail --silent --show-error --connect-timeout 1 --max-time 3 \
      "$url" >/dev/null 2>&1; then
      if koios_verify_process_record "$record_file" "$service" "$cwd" \
        "$host" "$port" "$marker" 1; then
        return 0
      fi
      echo "$name reached its URL but failed managed identity verification: $KOIOS_VERIFY_REASON." >&2
      return 1
    fi
    if ! koios_verify_process_record "$record_file" "$service" "$cwd" \
      "$host" "$port" "$marker" 0; then
      echo "$name stopped or changed identity before becoming ready: $KOIOS_VERIFY_REASON." >&2
      return 1
    fi
    sleep "$delay"
    attempt=$((attempt + 1))
  done

  echo "Timed out waiting for $name at $url." >&2
  return 1
}

cleanup_on_exit() {
  local status=$?
  trap - EXIT
  if [ "$status" -ne 0 ]; then
    echo "Startup failed. See logs in $RUN_DIR." >&2
    if [ "$STARTED_WEB" -eq 1 ]; then
      if [ -e "$WEB_PID_FILE" ]; then
        koios_stop_recorded_process "Project Koios web" "$WEB_PID_FILE" "$WEB_SERVICE_ID" \
          "$WEB_ROOT" "$WEB_HOST" "$WEB_PORT" "$WEB_COMMAND_MARKER" 0 ||
          koios_stop_invocation_child "Project Koios web" "$WEB_SPAWNED_PID" || true
      else
        koios_stop_invocation_child "Project Koios web" "$WEB_SPAWNED_PID" || true
      fi
    fi
    if [ "$STARTED_API" -eq 1 ]; then
      if [ -e "$API_PID_FILE" ]; then
        koios_stop_recorded_process "Project Koios API" "$API_PID_FILE" "$API_SERVICE_ID" \
          "$API_REPO" "$API_HOST" "$API_PORT" "$API_COMMAND_MARKER" 0 ||
          koios_stop_invocation_child "Project Koios API" "$API_SPAWNED_PID" || true
      else
        koios_stop_invocation_child "Project Koios API" "$API_SPAWNED_PID" || true
      fi
    fi
  fi
  koios_release_lifecycle_lock || status=1
  exit "$status"
}

for command in curl lsof ps; do
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
if [ "$DEPLOYMENT_SURFACE" = web ] && [ ! -d "$REFERENCES_REPO/src/python" ]; then
  echo "Required Project Koios source tree not found: $REFERENCES_REPO" >&2
  exit 1
fi

if [ "$DEPLOYMENT_SURFACE" = web ]; then
  for variable_name in KOIOS_REFERENCE_CORPUS_ROOT KOIOS_REFERENCE_PAGE_RESOLUTION_ROOT KOIOS_REFERENCE_MULTIMODAL_ROOT; do
    if [ "${!variable_name+x}" = x ]; then
      configured_root="${!variable_name}"
      case "$configured_root" in
        /*) ;;
        *)
          echo "$variable_name must be an absolute existing directory." >&2
          exit 1
          ;;
      esac
      if [ ! -d "$configured_root" ]; then
        echo "$variable_name must be an absolute existing directory: $configured_root" >&2
        exit 1
      fi
    fi
  done

  for variable_name in PROJECTKOIOS_REFERENCE_CATALOG PROJECTKOIOS_SEARCH_INDEX; do
    if [ "${!variable_name+x}" = x ]; then
      configured_file="${!variable_name}"
      case "$configured_file" in
        /*) ;;
        *)
          echo "$variable_name must be an absolute existing file." >&2
          exit 1
          ;;
      esac
      if [ ! -f "$configured_file" ]; then
        echo "$variable_name must be an absolute existing file: $configured_file" >&2
        exit 1
      fi
    fi
  done
fi

if [ "$DEPLOYMENT_SURFACE" = web ] &&
  [ "${KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT+x}" = x ]; then
  EQUATION_REVIEW_DOCUMENT_ROOT="$KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT"
  case "$EQUATION_REVIEW_DOCUMENT_ROOT" in
    /*) ;;
    *)
      echo "KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT must be an absolute existing directory." >&2
      exit 1
      ;;
  esac
  if [ ! -d "$EQUATION_REVIEW_DOCUMENT_ROOT" ]; then
    echo "KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT must be an absolute existing directory: $EQUATION_REVIEW_DOCUMENT_ROOT" >&2
    exit 1
  fi
  for directory in "$APPLICATIONS_REPO" "$INGESTION_REPO" "$REFERENCES_REPO"; do
    if [ ! -d "$directory/src/python" ]; then
      echo "Equation-review owner source tree not found: $directory/src/python" >&2
      exit 1
    fi
  done
  EQUATION_REVIEW_OWNER_ENABLED=1
fi

# Canonical working directories are part of managed process identity.
API_REPO="$(cd "$API_REPO" && pwd -P)"
CORE_REPO="$(cd "$CORE_REPO" && pwd -P)"
SEARCH_REPO="$(cd "$SEARCH_REPO" && pwd -P)"
OBSIDIAN_REPO="$(cd "$OBSIDIAN_REPO" && pwd -P)"
if [ "$DEPLOYMENT_SURFACE" = web ]; then
  REFERENCES_REPO="$(cd "$REFERENCES_REPO" && pwd -P)"
fi
if [ "$EQUATION_REVIEW_OWNER_ENABLED" -eq 1 ]; then
  APPLICATIONS_REPO="$(cd "$APPLICATIONS_REPO" && pwd -P)"
  INGESTION_REPO="$(cd "$INGESTION_REPO" && pwd -P)"
fi
API_PYTHON="$API_REPO/.venv/bin/python"

koios_acquire_lifecycle_lock "$RUN_DIR" "start:$DEPLOYMENT_SURFACE"
trap cleanup_on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [ "${KOIOS_COURSE_CATALOG+x}" = x ]; then
  COURSE_CATALOG="$KOIOS_COURSE_CATALOG"
else
  COURSE_CATALOG="$CORE_REPO/public/course-catalog.json"
  if [ ! -e "$COURSE_CATALOG" ]; then
    COURSE_CATALOG="$RUN_DIR/empty-courses.json"
    if [ ! -e "$COURSE_CATALOG" ]; then
      printf '%s\n' '{"schema_version":"1"}' >"$COURSE_CATALOG"
    fi
    echo "Optional course catalog not found; using empty runtime catalog: $COURSE_CATALOG"
  fi
fi

if [ "${KOIOS_PROJECT_CATALOG+x}" = x ]; then
  PROJECT_CATALOG="$KOIOS_PROJECT_CATALOG"
else
  PROJECT_CATALOG="$CORE_REPO/public/project-catalog.json"
  if [ ! -e "$PROJECT_CATALOG" ]; then
    PROJECT_CATALOG="$RUN_DIR/empty-projects.json"
    if [ ! -e "$PROJECT_CATALOG" ]; then
      printf '%s\n' '{"schema_version":"1","projects":[]}' >"$PROJECT_CATALOG"
    fi
    echo "Optional project catalog not found; using empty runtime catalog: $PROJECT_CATALOG"
  fi
fi

api_record_state=0
if koios_prepare_process_record "$API_PID_FILE" "$API_SERVICE_ID" "$API_REPO" "$API_HOST" \
  "$API_PORT" "$API_COMMAND_MARKER" "$API_HEALTH_URL"; then
  api_record_state=0
else
  api_record_state=$?
fi
case "$api_record_state" in
  0)
    if ! curl --fail --silent --show-error --connect-timeout 1 --max-time 3 \
      "$API_HEALTH_URL" >/dev/null 2>&1; then
      echo "Refusing to reuse managed Project Koios API: health check failed at $API_HEALTH_URL." >&2
      exit 1
    fi
    verify_api_surface
    echo "Project Koios $DEPLOYMENT_SURFACE API already running and healthy (PID $KOIOS_VERIFIED_PID)."
    ;;
  1)
    if lsof -n -P -iTCP:"$API_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "API port $API_PORT is already in use by an unmanaged process." >&2
      exit 1
    fi
    API_PYTHONPATH="$API_REPO/src/python:$CORE_REPO/src/python:$SEARCH_REPO/src/python:$OBSIDIAN_REPO/src/python"
    API_ENV_UNSET=()
    API_ENV=(
      "PYTHONPATH=$API_PYTHONPATH"
      "KOIOS_DEPLOYMENT_PROFILE=$DEPLOYMENT_PROFILE"
      "KOIOS_COURSE_CATALOG=$COURSE_CATALOG"
      "KOIOS_PROJECT_CATALOG=$PROJECT_CATALOG"
      "KOIOS_GITHUB_REPOSITORIES=${KOIOS_GITHUB_REPOSITORIES:-eragasa/projectkoios-api,eragasa/projectkoios-web}"
    )
    if [ "$DEPLOYMENT_SURFACE" = web ]; then
      API_PYTHONPATH="$API_PYTHONPATH:$REFERENCES_REPO/src/python"
      API_ENV[0]="PYTHONPATH=$API_PYTHONPATH"
      if [ "${KOIOS_REFERENCE_CORPUS_ROOT+x}" = x ]; then
        API_ENV+=("KOIOS_REFERENCE_CORPUS_ROOT=$KOIOS_REFERENCE_CORPUS_ROOT")
      fi
      if [ "${KOIOS_REFERENCE_PAGE_RESOLUTION_ROOT+x}" = x ]; then
        API_ENV+=("KOIOS_REFERENCE_PAGE_RESOLUTION_ROOT=$KOIOS_REFERENCE_PAGE_RESOLUTION_ROOT")
      fi
      if [ "${KOIOS_REFERENCE_MULTIMODAL_ROOT+x}" = x ]; then
        API_ENV+=("KOIOS_REFERENCE_MULTIMODAL_ROOT=$KOIOS_REFERENCE_MULTIMODAL_ROOT")
      fi
      if [ "${PROJECTKOIOS_REFERENCE_CATALOG+x}" = x ]; then
        API_ENV+=("PROJECTKOIOS_REFERENCE_CATALOG=$PROJECTKOIOS_REFERENCE_CATALOG")
      fi
      if [ "${PROJECTKOIOS_SEARCH_INDEX+x}" = x ]; then
        API_ENV+=("PROJECTKOIOS_SEARCH_INDEX=$PROJECTKOIOS_SEARCH_INDEX")
      fi
      if [ "$EQUATION_REVIEW_OWNER_ENABLED" -eq 1 ]; then
        API_PYTHONPATH="$API_PYTHONPATH:$APPLICATIONS_REPO/src/python:$INGESTION_REPO/src/python"
        API_ENV[0]="PYTHONPATH=$API_PYTHONPATH"
        API_ENV+=(
          "KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT=$EQUATION_REVIEW_DOCUMENT_ROOT"
        )
      fi
    else
      for variable_name in \
        KOIOS_PROJECT_REFERENCE_DATABASE_ROOT \
        KOIOS_PROJECT_REFERENCE_OBJECT_ROOT \
        KOIOS_PROJECT_REFERENCE_DATABASE_NAME \
        KOIOS_PROJECT_REFERENCE_MAX_PDF_BYTES \
        KOIOS_REFERENCE_CORPUS_ROOT \
        KOIOS_REFERENCE_PAGE_RESOLUTION_ROOT \
        KOIOS_REFERENCE_MULTIMODAL_ROOT \
        PROJECTKOIOS_REFERENCE_CATALOG \
        PROJECTKOIOS_REFERENCE_DOCUMENT_REGISTRY \
        PROJECTKOIOS_SEARCH_INDEX \
        KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT; do
        API_ENV_UNSET+=(-u "$variable_name")
      done
    fi
    cd "$API_REPO"
    if [ "$DEPLOYMENT_SURFACE" = www ]; then
      nohup env "${API_ENV_UNSET[@]}" "${API_ENV[@]}" \
        "$API_PYTHON" -m uvicorn projectkoios.api.main:app \
        --host "$API_HOST" --port "$API_PORT" \
        >>"$API_LOG" 2>&1 </dev/null &
    else
      nohup env "${API_ENV[@]}" \
        "$API_PYTHON" -m uvicorn projectkoios.api.main:app \
        --host "$API_HOST" --port "$API_PORT" \
        >>"$API_LOG" 2>&1 </dev/null &
    fi
    api_pid=$!
    API_SPAWNED_PID="$api_pid"
    STARTED_API=1
    cd "$WEB_ROOT"
    koios_publish_process_record "$API_PID_FILE" "$API_SERVICE_ID" "$api_pid" "$API_REPO" \
      "$API_HOST" "$API_PORT" "$API_COMMAND_MARKER" "$API_HEALTH_URL"
    wait_for_url "Project Koios API" "$API_HEALTH_URL" "$API_PID_FILE" "$API_SERVICE_ID" \
      "$API_REPO" "$API_HOST" "$API_PORT" "$API_COMMAND_MARKER"
    verify_api_surface
    echo "Project Koios $DEPLOYMENT_SURFACE API started (PID $api_pid)."
    ;;
  *) exit 1 ;;
esac

web_record_state=0
if koios_prepare_process_record "$WEB_PID_FILE" "$WEB_SERVICE_ID" "$WEB_ROOT" "$WEB_HOST" \
  "$WEB_PORT" "$WEB_COMMAND_MARKER" "$WEB_HEALTH_URL"; then
  web_record_state=0
else
  web_record_state=$?
fi
case "$web_record_state" in
  0)
    if ! curl --fail --silent --show-error --connect-timeout 1 --max-time 3 \
      "$WEB_HEALTH_URL" >/dev/null 2>&1; then
      echo "Refusing to reuse managed Project Koios web: health check failed at $WEB_HEALTH_URL." >&2
      exit 1
    fi
    echo "Project Koios web already running and healthy (PID $KOIOS_VERIFIED_PID)."
    ;;
  1)
    if lsof -n -P -iTCP:"$WEB_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "Web port $WEB_PORT is already in use by an unmanaged process." >&2
      exit 1
    fi
    cd "$WEB_ROOT"
    nohup env \
      KOIOS_API_HOST="$API_HOST" \
      KOIOS_API_PORT="$API_PORT" \
      VITE_KOIOS_DEPLOYMENT_PROFILE="$DEPLOYMENT_PROFILE" \
      "$VITE" --mode "$DEPLOYMENT_PROFILE" --host "$WEB_HOST" --port "$WEB_PORT" \
      >>"$WEB_LOG" 2>&1 </dev/null &
    web_pid=$!
    WEB_SPAWNED_PID="$web_pid"
    STARTED_WEB=1
    koios_publish_process_record "$WEB_PID_FILE" "$WEB_SERVICE_ID" "$web_pid" "$WEB_ROOT" \
      "$WEB_HOST" "$WEB_PORT" "$WEB_COMMAND_MARKER" "$WEB_HEALTH_URL"
    wait_for_url "Project Koios web" "$WEB_HEALTH_URL" "$WEB_PID_FILE" "$WEB_SERVICE_ID" \
      "$WEB_ROOT" "$WEB_HOST" "$WEB_PORT" "$WEB_COMMAND_MARKER"
    echo "Project Koios $DEPLOYMENT_SURFACE web started (PID $web_pid)."
    ;;
  *) exit 1 ;;
esac

echo
echo "Project Koios $DEPLOYMENT_SURFACE ($DEPLOYMENT_PROFILE) is ready:"
echo "  Web:  $WEB_HEALTH_URL"
echo "  API:  http://$API_HOST:$API_PORT"
echo "  Docs: http://$API_HOST:$API_PORT/docs"
echo "  Logs: $RUN_DIR"

if [ "${KOIOS_OPEN_BROWSER:-0}" = "1" ] && command -v open >/dev/null 2>&1; then
  open "$WEB_HEALTH_URL"
fi
