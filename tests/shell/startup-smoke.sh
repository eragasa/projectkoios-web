#!/usr/bin/env bash

set -euo pipefail

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STARTUP_SOURCE="$REPOSITORY_ROOT/scripts/startup.sh"
SHUTDOWN_SOURCE="$REPOSITORY_ROOT/scripts/shutdown.sh"
LIFECYCLE_SOURCE="$REPOSITORY_ROOT/scripts/managed-process.sh"
SMOKE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/projectkoios-web-startup-smoke.XXXXXX")"
SMOKE_ROOT="$(cd "$SMOKE_ROOT" && pwd -P)"

fail() {
  echo "startup smoke failure: $*" >&2
  exit 1
}

file_mode() {
  case "$(uname -s)" in
    Darwin) stat -f '%Lp' "$1" ;;
    *) stat -c '%a' "$1" ;;
  esac
}

record_value() {
  local key="$1"
  local file="$2"
  awk -v prefix="$key=" 'index($0, prefix) == 1 { print substr($0, length(prefix) + 1); exit }' "$file"
}

state_root_for_case() {
  printf '%s/lsof-state' "$1"
}

stop_case_processes() {
  local case_root="$1"
  local state_root
  state_root="$(state_root_for_case "$case_root")"
  local state_dir pid attempt
  for state_dir in "$state_root"/*; do
    [ -d "$state_dir" ] || continue
    pid="$(basename "$state_dir")"
    if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      for attempt in $(seq 1 100); do
        if ! kill -0 "$pid" 2>/dev/null; then
          break
        fi
        sleep 0.01
      done
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    fi
  done
}

cleanup() {
  local case_root
  for case_root in "$SMOKE_ROOT"/*; do
    [ -d "$case_root" ] || continue
    stop_case_processes "$case_root"
  done
  if [ "${KOIOS_KEEP_SMOKE:-0}" = "1" ]; then
    echo "retained startup smoke root: $SMOKE_ROOT" >&2
  else
    rm -rf "$SMOKE_ROOT"
  fi
}
trap cleanup EXIT

create_fixture() {
  local case_root="$1"
  mkdir -p \
    "$case_root/web/scripts" \
    "$case_root/web/node_modules/.bin" \
    "$case_root/api repo/.venv/bin" \
    "$case_root/api repo/src/python" \
    "$case_root/core repo/src/python" \
    "$case_root/search repo/src/python" \
    "$case_root/obsidian repo/src/python" \
    "$case_root/projectkoios-references/src/python" \
    "$case_root/fake-bin" \
    "$(state_root_for_case "$case_root")"
  cp "$STARTUP_SOURCE" "$case_root/web/scripts/startup.sh"
  cp "$SHUTDOWN_SOURCE" "$case_root/web/scripts/shutdown.sh"
  cp "$LIFECYCLE_SOURCE" "$case_root/web/scripts/managed-process.sh"
  chmod +x "$case_root/web/scripts/startup.sh" "$case_root/web/scripts/shutdown.sh"

  cat >"$case_root/fake-bin/curl" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
state_root="${KOIOS_SMOKE_LSOF_STATE:-$(dirname "${KOIOS_SMOKE_API_CAPTURE:?}")/lsof-state}"
url="${!#}"
port=""
if [[ "$url" =~ :([0-9]+)/ ]]; then
  port="${BASH_REMATCH[1]}"
fi
if [ -n "${KOIOS_SMOKE_CURL_DELAY:-}" ]; then
  sleep "$KOIOS_SMOKE_CURL_DELAY"
fi
if [ "${KOIOS_SMOKE_CURL_FAIL_PORT:-}" = "$port" ] ||
  [ "${KOIOS_SMOKE_NO_LISTEN_PORT:-}" = "$port" ]; then
  exit 1
fi
for state_dir in "$state_root"/*; do
  [ -d "$state_dir" ] || continue
  pid="$(basename "$state_dir")"
  if kill -0 "$pid" 2>/dev/null && [ "$(cat "$state_dir/port")" = "$port" ]; then
    if [[ "$url" == */openapi.json ]]; then
      profile="${KOIOS_SMOKE_OPENAPI_PROFILE:-$(cat "$state_dir/profile")}"
      case "$profile" in
        public) printf '%s\n' '{"paths":{}}' ;;
        control)
          printf '%s\n' '{"paths":{"/project-reference-intake/ksdft2effmass/missing-pdfs":{}}}'
          ;;
        *) exit 1 ;;
      esac
    fi
    exit 0
  fi
done
exit 1
EOF
  cat >"$case_root/fake-bin/lsof" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
state_root="${KOIOS_SMOKE_LSOF_STATE:-$(dirname "${KOIOS_SMOKE_API_CAPTURE:?}")/lsof-state}"
pid=""
port=""
descriptor=""
args=("$@")
index=0
while [ "$index" -lt "${#args[@]}" ]; do
  argument="${args[$index]}"
  case "$argument" in
    -p)
      index=$((index + 1))
      pid="${args[$index]}"
      ;;
    -d)
      index=$((index + 1))
      descriptor="${args[$index]}"
      ;;
    -iTCP:*) port="${argument#-iTCP:}" ;;
  esac
  index=$((index + 1))
done
if [ -n "$pid" ] && [ -d "$state_root/$pid" ] && kill -0 "$pid" 2>/dev/null; then
  if [ -n "$descriptor" ] &&
    [ "$(cat "$state_root/$pid/port")" = "${KOIOS_SMOKE_PUBLISH_FAIL_PORT:-<unset>}" ]; then
    exit 1
  fi
  case "$descriptor" in
    cwd)
      printf 'p%s\nfcwd\nn%s\n' "$pid" "$(cat "$state_root/$pid/cwd")"
      exit 0
      ;;
    txt)
      printf 'p%s\nftxt\nn/bin/bash\n' "$pid"
      exit 0
      ;;
  esac
  if [ -n "$port" ] && [ "${KOIOS_SMOKE_NO_LISTEN_PORT:-}" != "$port" ] &&
    [ "$(cat "$state_root/$pid/port")" = "$port" ]; then
    printf '%s\n' "$pid"
    exit 0
  fi
fi
if [ -z "$pid" ] && [ -n "$port" ]; then
  for state_dir in "$state_root"/*; do
    [ -d "$state_dir" ] || continue
    candidate="$(basename "$state_dir")"
    if kill -0 "$candidate" 2>/dev/null &&
      [ "${KOIOS_SMOKE_NO_LISTEN_PORT:-}" != "$port" ] &&
      [ "$(cat "$state_dir/port")" = "$port" ]; then
      printf '%s\n' "$candidate"
      exit 0
    fi
  done
fi
exit 1
EOF
  chmod +x "$case_root/fake-bin/curl" "$case_root/fake-bin/lsof"

  cat >"$case_root/api repo/.venv/bin/python" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
state_root="${KOIOS_SMOKE_LSOF_STATE:-$(dirname "${KOIOS_SMOKE_API_CAPTURE:?}")/lsof-state}"
port=""
args=("$@")
index=0
while [ "$index" -lt "${#args[@]}" ]; do
  if [ "${args[$index]}" = "--port" ]; then
    index=$((index + 1))
    port="${args[$index]}"
  fi
  index=$((index + 1))
done
state_dir="$state_root/$$"
mkdir -p "$state_dir"
printf '%s\n' "$(pwd -P)" >"$state_dir/cwd"
printf '%s\n' "$port" >"$state_dir/port"
printf '%s\n' "${KOIOS_DEPLOYMENT_PROFILE:-<unset>}" >"$state_dir/profile"
cleanup_state() {
  rm -rf "$state_dir"
  if [ -n "${child:-}" ]; then
    kill "$child" 2>/dev/null || true
  fi
}
trap cleanup_state EXIT TERM INT
{
  printf 'PYTHONPATH=%s\n' "${PYTHONPATH:-}"
  printf 'DEPLOYMENT_PROFILE=%s\n' "${KOIOS_DEPLOYMENT_PROFILE:-<unset>}"
  printf 'COURSE_CATALOG=%s\n' "${KOIOS_COURSE_CATALOG:-<unset>}"
  printf 'PROJECT_CATALOG=%s\n' "${KOIOS_PROJECT_CATALOG:-<unset>}"
  printf 'REFERENCE_CORPUS_ROOT=%s\n' "${KOIOS_REFERENCE_CORPUS_ROOT:-<unset>}"
  printf 'REFERENCE_PAGE_RESOLUTION_ROOT=%s\n' "${KOIOS_REFERENCE_PAGE_RESOLUTION_ROOT:-<unset>}"
  printf 'REFERENCE_MULTIMODAL_ROOT=%s\n' "${KOIOS_REFERENCE_MULTIMODAL_ROOT:-<unset>}"
  printf 'REFERENCE_CATALOG=%s\n' "${PROJECTKOIOS_REFERENCE_CATALOG:-<unset>}"
  printf 'REFERENCE_DOCUMENT_REGISTRY=%s\n' "${PROJECTKOIOS_REFERENCE_DOCUMENT_REGISTRY:-<unset>}"
  printf 'SEARCH_INDEX=%s\n' "${PROJECTKOIOS_SEARCH_INDEX:-<unset>}"
  printf 'PROJECT_REFERENCE_DATABASE_ROOT=%s\n' "${KOIOS_PROJECT_REFERENCE_DATABASE_ROOT:-<unset>}"
  printf 'PROJECT_REFERENCE_OBJECT_ROOT=%s\n' "${KOIOS_PROJECT_REFERENCE_OBJECT_ROOT:-<unset>}"
  printf 'PROJECT_REFERENCE_DATABASE_NAME=%s\n' "${KOIOS_PROJECT_REFERENCE_DATABASE_NAME:-<unset>}"
  printf 'PROJECT_REFERENCE_MAX_PDF_BYTES=%s\n' "${KOIOS_PROJECT_REFERENCE_MAX_PDF_BYTES:-<unset>}"
  if [ "${KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT+x}" = x ]; then
    printf 'EQUATION_ROOT=%s\n' "$KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT"
  else
    printf 'EQUATION_ROOT=<unset>\n'
  fi
  printf 'ARGS='
  printf '%q ' "$@"
  printf '\n'
} >"$KOIOS_SMOKE_API_CAPTURE"
sleep 300 &
child=$!
wait "$child"
EOF
  chmod +x "$case_root/api repo/.venv/bin/python"

  cat >"$case_root/web/node_modules/.bin/vite" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
state_root="${KOIOS_SMOKE_LSOF_STATE:-$(dirname "${KOIOS_SMOKE_API_CAPTURE:?}")/lsof-state}"
port=""
args=("$@")
index=0
while [ "$index" -lt "${#args[@]}" ]; do
  if [ "${args[$index]}" = "--port" ]; then
    index=$((index + 1))
    port="${args[$index]}"
  fi
  index=$((index + 1))
done
state_dir="$state_root/$$"
mkdir -p "$state_dir"
printf '%s\n' "$(pwd -P)" >"$state_dir/cwd"
printf '%s\n' "$port" >"$state_dir/port"
printf '%s\n' "${VITE_KOIOS_DEPLOYMENT_PROFILE:-<unset>}" >"$state_dir/profile"
cleanup_state() {
  rm -rf "$state_dir"
  if [ -n "${child:-}" ]; then
    kill "$child" 2>/dev/null || true
  fi
}
trap cleanup_state EXIT TERM INT
{
  printf 'DEPLOYMENT_PROFILE=%s\n' "${VITE_KOIOS_DEPLOYMENT_PROFILE:-<unset>}"
  printf 'API_HOST=%s\n' "${KOIOS_API_HOST:-<unset>}"
  printf 'API_PORT=%s\n' "${KOIOS_API_PORT:-<unset>}"
  printf 'ARGS='
  printf '%q ' "$@"
  printf '\n'
} >"$KOIOS_SMOKE_WEB_CAPTURE"
sleep 300 &
child=$!
wait "$child"
EOF
  chmod +x "$case_root/web/node_modules/.bin/vite"
}

wait_for_capture() {
  local api_capture="$1"
  local web_capture="$2"
  local attempt
  for attempt in $(seq 1 100); do
    if [ -s "$api_capture" ] && [ -s "$web_capture" ]; then
      return 0
    fi
    sleep 0.02
  done
  fail "managed commands did not capture their environments"
}

start_fixture() {
  local case_root="$1"
  local stdout_file="$2"
  local stderr_file="$3"
  shift 3
  env -u KOIOS_DEPLOYMENT_SURFACE -u KOIOS_DEPLOYMENT_PROFILE \
    -u VITE_KOIOS_DEPLOYMENT_PROFILE \
    -u KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT \
    PATH="$case_root/fake-bin:$PATH" \
    KOIOS_RUN_DIR="$case_root/run" \
    KOIOS_API_REPO="$case_root/api repo" \
    KOIOS_CORE_REPO="$case_root/core repo" \
    KOIOS_SEARCH_REPO="$case_root/search repo" \
    KOIOS_OBSIDIAN_REPO="$case_root/obsidian repo" \
    KOIOS_API_PORT="${KOIOS_TEST_API_PORT:-18080}" \
    KOIOS_WEB_PORT="${KOIOS_TEST_WEB_PORT:-15173}" \
    KOIOS_SMOKE_API_CAPTURE="$case_root/api.capture" \
    KOIOS_SMOKE_WEB_CAPTURE="$case_root/web.capture" \
    "$@" \
    "$case_root/web/scripts/startup.sh" \
    >"$stdout_file" 2>"$stderr_file"
}

stop_fixture_service() {
  local case_root="$1"
  local service="$2"
  env \
    PATH="$case_root/fake-bin:$PATH" \
    KOIOS_RUN_DIR="$case_root/run" \
    KOIOS_API_REPO="$case_root/api repo" \
    KOIOS_API_PORT="${KOIOS_TEST_API_PORT:-18080}" \
    KOIOS_WEB_PORT="${KOIOS_TEST_WEB_PORT:-15173}" \
    KOIOS_SMOKE_API_CAPTURE="$case_root/api.capture" \
    KOIOS_SMOKE_WEB_CAPTURE="$case_root/web.capture" \
    KOIOS_MANAGED_SERVICE="$service" \
    "$case_root/web/scripts/shutdown.sh"
}

start_surface_fixture() {
  local case_root="$1"
  local surface="$2"
  case "$surface" in
    www | web) ;;
    *) fail "invalid smoke surface: $surface" ;;
  esac
  shift 2
  env -u KOIOS_DEPLOYMENT_PROFILE -u VITE_KOIOS_DEPLOYMENT_PROFILE \
    -u KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT \
    PATH="$case_root/fake-bin:$PATH" \
    KOIOS_DEPLOYMENT_SURFACE="$surface" \
    KOIOS_API_REPO="$case_root/api repo" \
    KOIOS_CORE_REPO="$case_root/core repo" \
    KOIOS_SEARCH_REPO="$case_root/search repo" \
    KOIOS_OBSIDIAN_REPO="$case_root/obsidian repo" \
    KOIOS_REFERENCES_REPO="$case_root/projectkoios-references" \
    KOIOS_SMOKE_API_CAPTURE="$case_root/$surface-api.capture" \
    KOIOS_SMOKE_WEB_CAPTURE="$case_root/$surface-web.capture" \
    "$@" \
    "$case_root/web/scripts/startup.sh" \
    >"$case_root/$surface.stdout" 2>"$case_root/$surface.stderr"
}

stop_surface_fixture() {
  local case_root="$1"
  local surface="$2"
  case "$surface" in
    www | web) ;;
    *) fail "invalid smoke surface: $surface" ;;
  esac
  shift 2
  env -u KOIOS_DEPLOYMENT_PROFILE -u VITE_KOIOS_DEPLOYMENT_PROFILE \
    PATH="$case_root/fake-bin:$PATH" \
    KOIOS_DEPLOYMENT_SURFACE="$surface" \
    KOIOS_API_REPO="$case_root/api repo" \
    KOIOS_SMOKE_API_CAPTURE="$case_root/$surface-api.capture" \
    KOIOS_SMOKE_WEB_CAPTURE="$case_root/$surface-web.capture" \
    "$@" \
    "$case_root/web/scripts/shutdown.sh"
}

run_surface_profile_refusal() {
  local case_root="$SMOKE_ROOT/surface-profile-refusal"
  create_fixture "$case_root"
  local status

  set +e
  env KOIOS_DEPLOYMENT_SURFACE=unknown \
    "$case_root/web/scripts/startup.sh" \
    >"$case_root/unknown.stdout" 2>"$case_root/unknown.stderr"
  status=$?
  set -e
  [ "$status" -ne 0 ] || fail "unknown deployment surface unexpectedly started"
  grep -Fq "KOIOS_DEPLOYMENT_SURFACE must be one of" "$case_root/unknown.stderr" ||
    fail "unknown deployment surface did not fail explicitly"

  set +e
  env KOIOS_DEPLOYMENT_SURFACE=www KOIOS_DEPLOYMENT_PROFILE=control \
    "$case_root/web/scripts/startup.sh" \
    >"$case_root/api-mismatch.stdout" 2>"$case_root/api-mismatch.stderr"
  status=$?
  set -e
  [ "$status" -ne 0 ] || fail "www/control API profile mismatch unexpectedly started"
  grep -Fq "conflicts with www surface profile public" "$case_root/api-mismatch.stderr" ||
    fail "API profile mismatch did not fail explicitly"

  set +e
  env KOIOS_DEPLOYMENT_SURFACE=web VITE_KOIOS_DEPLOYMENT_PROFILE=public \
    "$case_root/web/scripts/startup.sh" \
    >"$case_root/vite-mismatch.stdout" 2>"$case_root/vite-mismatch.stderr"
  status=$?
  set -e
  [ "$status" -ne 0 ] || fail "web/public Vite profile mismatch unexpectedly started"
  grep -Fq "conflicts with web surface profile control" "$case_root/vite-mismatch.stderr" ||
    fail "Vite profile mismatch did not fail explicitly"
  test ! -e "$case_root/api.capture" || fail "surface refusal started API"
  test ! -e "$case_root/web.capture" || fail "surface refusal started Web"
}

run_runtime_root_isolation() {
  local case_root="$SMOKE_ROOT/runtime-root-surfaces"
  create_fixture "$case_root"
  local runtime_root="$case_root/managed runtime"

  start_surface_fixture "$case_root" www "KOIOS_RUNTIME_ROOT=$runtime_root"
  start_surface_fixture "$case_root" web "KOIOS_RUNTIME_ROOT=$runtime_root"
  wait_for_capture "$case_root/www-api.capture" "$case_root/www-web.capture"
  wait_for_capture "$case_root/web-api.capture" "$case_root/web-web.capture"

  for record in \
    "$runtime_root/www/api.pid" \
    "$runtime_root/www/web.pid" \
    "$runtime_root/web/api.pid" \
    "$runtime_root/web/web.pid"; do
    test -f "$record" || fail "runtime root omitted surface record: $record"
  done
  [ "$(file_mode "$runtime_root/www")" = "700" ] ||
    fail "www derived runtime directory was not mode 0700"
  [ "$(file_mode "$runtime_root/web")" = "700" ] ||
    fail "web derived runtime directory was not mode 0700"
  local web_api_pid web_web_pid
  web_api_pid="$(record_value pid "$runtime_root/web/api.pid")"
  web_web_pid="$(record_value pid "$runtime_root/web/web.pid")"

  stop_surface_fixture "$case_root" www "KOIOS_RUNTIME_ROOT=$runtime_root" \
    >"$case_root/www-runtime-stop.stdout" 2>"$case_root/www-runtime-stop.stderr"
  test ! -e "$runtime_root/www/api.pid" ||
    fail "www runtime-root stop retained API record"
  test ! -e "$runtime_root/www/web.pid" ||
    fail "www runtime-root stop retained Web record"
  kill -0 "$web_api_pid" 2>/dev/null || fail "www runtime-root stop killed web API"
  kill -0 "$web_web_pid" 2>/dev/null || fail "www runtime-root stop killed web Web"

  stop_surface_fixture "$case_root" web "KOIOS_RUNTIME_ROOT=$runtime_root" \
    >"$case_root/web-runtime-stop.stdout" 2>"$case_root/web-runtime-stop.stderr"
  local state_count
  state_count="$(find "$(state_root_for_case "$case_root")" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  [ "$state_count" = "0" ] || fail "runtime-root stops orphaned managed processes"

  case_root="$SMOKE_ROOT/run-dir-priority"
  create_fixture "$case_root"
  runtime_root="$case_root/ignored runtime"
  local explicit_run_dir="$case_root/explicit run"
  start_surface_fixture "$case_root" web \
    "KOIOS_RUNTIME_ROOT=$runtime_root" \
    "KOIOS_RUN_DIR=$explicit_run_dir"
  test -f "$explicit_run_dir/api.pid" || fail "explicit KOIOS_RUN_DIR lost API record"
  test -f "$explicit_run_dir/web.pid" || fail "explicit KOIOS_RUN_DIR lost Web record"
  test ! -e "$runtime_root/web" ||
    fail "KOIOS_RUNTIME_ROOT overrode explicit KOIOS_RUN_DIR"
  stop_surface_fixture "$case_root" web \
    "KOIOS_RUNTIME_ROOT=$runtime_root" \
    "KOIOS_RUN_DIR=$explicit_run_dir" \
    >"$case_root/explicit-stop.stdout" 2>"$case_root/explicit-stop.stderr"
  test ! -e "$explicit_run_dir/api.pid" || fail "explicit-run stop retained API record"
  test ! -e "$explicit_run_dir/web.pid" || fail "explicit-run stop retained Web record"

  case_root="$SMOKE_ROOT/invalid-runtime-root"
  create_fixture "$case_root"
  local status
  set +e
  start_surface_fixture "$case_root" www "KOIOS_RUNTIME_ROOT="
  status=$?
  set -e
  [ "$status" -ne 0 ] || fail "empty KOIOS_RUNTIME_ROOT unexpectedly started"
  grep -Fq "KOIOS_RUNTIME_ROOT must be a non-empty single-line path" \
    "$case_root/www.stderr" || fail "empty runtime root did not fail explicitly"
  state_count="$(find "$(state_root_for_case "$case_root")" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  [ "$state_count" = "0" ] || fail "invalid runtime root started a process"
}

run_surface_openapi_refusal() {
  local case_root="$SMOKE_ROOT/www-control-openapi"
  create_fixture "$case_root"
  local status state_count

  set +e
  start_surface_fixture "$case_root" www "KOIOS_SMOKE_OPENAPI_PROFILE=control"
  status=$?
  set -e
  [ "$status" -ne 0 ] || fail "www accepted CONTROL project-reference OpenAPI"
  grep -Fq "PUBLIC OpenAPI exposes CONTROL project-reference intake" \
    "$case_root/www.stderr" || fail "www OpenAPI mismatch was not reported"
  state_count="$(find "$(state_root_for_case "$case_root")" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  [ "$state_count" = "0" ] || fail "www OpenAPI refusal orphaned a process"

  case_root="$SMOKE_ROOT/web-public-openapi"
  create_fixture "$case_root"
  set +e
  start_surface_fixture "$case_root" web "KOIOS_SMOKE_OPENAPI_PROFILE=public"
  status=$?
  set -e
  [ "$status" -ne 0 ] || fail "web accepted PUBLIC OpenAPI without project-reference intake"
  grep -Fq "CONTROL OpenAPI omits project-reference intake" \
    "$case_root/web.stderr" || fail "web OpenAPI mismatch was not reported"
  state_count="$(find "$(state_root_for_case "$case_root")" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  [ "$state_count" = "0" ] || fail "web OpenAPI refusal orphaned a process"
}

run_concurrent_deployment_surfaces() {
  local case_root="$SMOKE_ROOT/concurrent-surfaces"
  create_fixture "$case_root"
  local database_root="$case_root/private database"
  local object_root="$case_root/private objects"
  mkdir -p "$database_root" "$object_root"

  start_surface_fixture "$case_root" www \
    "KOIOS_PROJECT_REFERENCE_DATABASE_ROOT=$database_root" \
    "KOIOS_PROJECT_REFERENCE_OBJECT_ROOT=$object_root" \
    "KOIOS_PROJECT_REFERENCE_DATABASE_NAME=private.sqlite3" \
    "KOIOS_PROJECT_REFERENCE_MAX_PDF_BYTES=12345" \
    "KOIOS_REFERENCE_CORPUS_ROOT=$case_root/private corpus" \
    "KOIOS_REFERENCE_PAGE_RESOLUTION_ROOT=$case_root/private resolution" \
    "KOIOS_REFERENCE_MULTIMODAL_ROOT=$case_root/private multimodal" \
    "PROJECTKOIOS_REFERENCE_CATALOG=$case_root/private catalog.sqlite3" \
    "PROJECTKOIOS_REFERENCE_DOCUMENT_REGISTRY=$case_root/private registry.sqlite3" \
    "PROJECTKOIOS_SEARCH_INDEX=$case_root/private search.sqlite3" \
    "KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT=$case_root/private equation"
  start_surface_fixture "$case_root" web \
    "KOIOS_PROJECT_REFERENCE_DATABASE_ROOT=$database_root" \
    "KOIOS_PROJECT_REFERENCE_OBJECT_ROOT=$object_root" \
    "KOIOS_PROJECT_REFERENCE_DATABASE_NAME=private.sqlite3" \
    "KOIOS_PROJECT_REFERENCE_MAX_PDF_BYTES=12345"
  wait_for_capture "$case_root/www-api.capture" "$case_root/www-web.capture"
  wait_for_capture "$case_root/web-api.capture" "$case_root/web-web.capture"

  grep -Fqx "DEPLOYMENT_PROFILE=public" "$case_root/www-api.capture" ||
    fail "www API did not use PUBLIC profile"
  grep -Fqx "DEPLOYMENT_PROFILE=public" "$case_root/www-web.capture" ||
    fail "www Web did not use PUBLIC profile"
  grep -Fqx "DEPLOYMENT_PROFILE=control" "$case_root/web-api.capture" ||
    fail "web API did not use CONTROL profile"
  grep -Fqx "DEPLOYMENT_PROFILE=control" "$case_root/web-web.capture" ||
    fail "web Web did not use CONTROL profile"
  grep -Fq -- "--mode public" "$case_root/www-web.capture" ||
    fail "www Vite did not use public mode"
  grep -Fq -- "--mode control" "$case_root/web-web.capture" ||
    fail "web Vite did not use control mode"
  grep -Fqx "API_HOST=127.0.0.1" "$case_root/www-web.capture" ||
    fail "www Web proxy lost API host"
  grep -Fqx "API_PORT=8100" "$case_root/www-web.capture" ||
    fail "www Web proxy lost surface API port"
  grep -Fqx "API_HOST=127.0.0.1" "$case_root/web-web.capture" ||
    fail "web Web proxy lost API host"
  grep -Fqx "API_PORT=8000" "$case_root/web-web.capture" ||
    fail "web Web proxy lost surface API port"

  local resolved_case_root
  resolved_case_root="$(cd "$case_root" && pwd -P)"
  local public_pythonpath="$case_root/api repo/src/python:$case_root/core repo/src/python:$case_root/search repo/src/python:$case_root/obsidian repo/src/python"
  local control_pythonpath="$public_pythonpath:$resolved_case_root/projectkoios-references/src/python"
  grep -Fqx "PYTHONPATH=$public_pythonpath" "$case_root/www-api.capture" ||
    fail "www API inherited CONTROL owner sources"
  grep -Fqx "PYTHONPATH=$control_pythonpath" "$case_root/web-api.capture" ||
    fail "web API omitted References owner source"
  for variable_name in \
    PROJECT_REFERENCE_DATABASE_ROOT \
    PROJECT_REFERENCE_OBJECT_ROOT \
    PROJECT_REFERENCE_DATABASE_NAME \
    PROJECT_REFERENCE_MAX_PDF_BYTES \
    REFERENCE_CORPUS_ROOT \
    REFERENCE_PAGE_RESOLUTION_ROOT \
    REFERENCE_MULTIMODAL_ROOT \
    REFERENCE_CATALOG \
    REFERENCE_DOCUMENT_REGISTRY \
    SEARCH_INDEX \
    EQUATION_ROOT; do
    grep -Fqx "$variable_name=<unset>" "$case_root/www-api.capture" ||
      fail "www API inherited $variable_name"
  done
  grep -Fqx "PROJECT_REFERENCE_DATABASE_ROOT=$database_root" "$case_root/web-api.capture" ||
    fail "web API lost project-reference database root"
  grep -Fqx "PROJECT_REFERENCE_OBJECT_ROOT=$object_root" "$case_root/web-api.capture" ||
    fail "web API lost project-reference object root"
  grep -Fqx "PROJECT_REFERENCE_DATABASE_NAME=private.sqlite3" "$case_root/web-api.capture" ||
    fail "web API lost project-reference database name"
  grep -Fqx "PROJECT_REFERENCE_MAX_PDF_BYTES=12345" "$case_root/web-api.capture" ||
    fail "web API lost project-reference upload bound"

  grep -Fqx "service=www-api" "$case_root/web/.run/www/api.pid" ||
    fail "www API record identity is not surface-specific"
  grep -Fqx "service=www-web" "$case_root/web/.run/www/web.pid" ||
    fail "www Web record identity is not surface-specific"
  grep -Fqx "port=8100" "$case_root/web/.run/www/api.pid" ||
    fail "www API record has wrong default port"
  grep -Fqx "port=4173" "$case_root/web/.run/www/web.pid" ||
    fail "www Web record has wrong default port"
  grep -Fqx "service=web-api" "$case_root/web/.run/web/api.pid" ||
    fail "web API record identity is not surface-specific"
  grep -Fqx "service=web-web" "$case_root/web/.run/web/web.pid" ||
    fail "web Web record identity is not surface-specific"
  grep -Fqx "port=8000" "$case_root/web/.run/web/api.pid" ||
    fail "web API record has wrong default port"
  grep -Fqx "port=5173" "$case_root/web/.run/web/web.pid" ||
    fail "web Web record has wrong default port"

  local www_api_pid www_web_pid web_api_pid web_web_pid status
  www_api_pid="$(record_value pid "$case_root/web/.run/www/api.pid")"
  www_web_pid="$(record_value pid "$case_root/web/.run/www/web.pid")"
  web_api_pid="$(record_value pid "$case_root/web/.run/web/api.pid")"
  web_web_pid="$(record_value pid "$case_root/web/.run/web/web.pid")"

  set +e
  env -u KOIOS_DEPLOYMENT_PROFILE -u VITE_KOIOS_DEPLOYMENT_PROFILE \
    PATH="$case_root/fake-bin:$PATH" \
    KOIOS_DEPLOYMENT_SURFACE=www \
    KOIOS_RUN_DIR="$case_root/web/.run/web" \
    KOIOS_API_REPO="$case_root/api repo" \
    KOIOS_API_PORT=8000 \
    KOIOS_WEB_PORT=5173 \
    KOIOS_SMOKE_API_CAPTURE="$case_root/web-api.capture" \
    KOIOS_SMOKE_WEB_CAPTURE="$case_root/web-web.capture" \
    "$case_root/web/scripts/shutdown.sh" \
    >"$case_root/wrong-stop.stdout" 2>"$case_root/wrong-stop.stderr"
  status=$?
  set -e
  [ "$status" -ne 0 ] || fail "wrong-surface stop unexpectedly succeeded"
  grep -Fq "metadata does not match the requested service configuration" \
    "$case_root/wrong-stop.stderr" || fail "wrong-surface stop did not fail closed"
  for pid in "$www_api_pid" "$www_web_pid" "$web_api_pid" "$web_web_pid"; do
    kill -0 "$pid" 2>/dev/null || fail "wrong-surface stop killed PID $pid"
  done

  stop_surface_fixture "$case_root" www \
    >"$case_root/www-stop.stdout" 2>"$case_root/www-stop.stderr"
  kill -0 "$web_api_pid" 2>/dev/null || fail "www stop killed web API"
  kill -0 "$web_web_pid" 2>/dev/null || fail "www stop killed web Web"
  test ! -e "$case_root/web/.run/www/api.pid" || fail "www stop retained API record"
  test ! -e "$case_root/web/.run/www/web.pid" || fail "www stop retained Web record"

  stop_surface_fixture "$case_root" web \
    >"$case_root/web-stop.stdout" 2>"$case_root/web-stop.stderr"
  local state_count
  state_count="$(find "$(state_root_for_case "$case_root")" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  [ "$state_count" = "0" ] || fail "surface shutdown orphaned managed processes"
}

run_without_owner_sources() {
  local case_root="$SMOKE_ROOT/no-owner"
  create_fixture "$case_root"
  test ! -e "$case_root/web/.env.local" || fail "absent .env.local fixture changed"
  local api_capture="$case_root/api.capture"
  local web_capture="$case_root/web.capture"

  env -u KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT \
    PATH="$case_root/fake-bin:$PATH" \
    KOIOS_RUN_DIR="$case_root/run" \
    KOIOS_API_REPO="$case_root/api repo" \
    KOIOS_CORE_REPO="$case_root/core repo" \
    KOIOS_SEARCH_REPO="$case_root/search repo" \
    KOIOS_OBSIDIAN_REPO="$case_root/obsidian repo" \
    KOIOS_SMOKE_API_CAPTURE="$api_capture" \
    KOIOS_SMOKE_WEB_CAPTURE="$web_capture" \
    "$case_root/web/scripts/startup.sh" \
    >"$case_root/stdout" 2>"$case_root/stderr"

  wait_for_capture "$api_capture" "$web_capture"
  local resolved_case_root
  resolved_case_root="$(cd "$case_root" && pwd)"
  local expected_pythonpath="$case_root/api repo/src/python:$case_root/core repo/src/python:$case_root/search repo/src/python:$case_root/obsidian repo/src/python:$resolved_case_root/projectkoios-references/src/python"
  if ! grep -Fqx "PYTHONPATH=$expected_pythonpath" "$api_capture"; then
    cat "$api_capture" >&2
    printf 'expected PYTHONPATH=%s\n' "$expected_pythonpath" >&2
    fail "default PYTHONPATH omitted the API-required References owner"
  fi
  grep -Fqx "EQUATION_ROOT=<unset>" "$api_capture" ||
    fail "equation root was passed without explicit opt-in"
  grep -Fqx "DEPLOYMENT_PROFILE=control" "$api_capture" ||
    fail "managed API did not retain the control profile"
  grep -Fqx "DEPLOYMENT_PROFILE=control" "$web_capture" ||
    fail "managed Web did not retain the control profile"
  test -f "$case_root/run/empty-courses.json" ||
    fail "missing course catalog fallback"
  test -f "$case_root/run/empty-projects.json" ||
    fail "missing project catalog fallback"
  grep -Fqx '{"schema_version":"1"}' "$case_root/run/empty-courses.json" ||
    fail "course catalog fallback changed"
  grep -Fqx '{"schema_version":"1","projects":[]}' "$case_root/run/empty-projects.json" ||
    fail "project catalog fallback changed"
  [ "$(file_mode "$case_root/run")" = "700" ] ||
    fail "managed run directory was not mode 0700"
  for record in "$case_root/run/api.pid" "$case_root/run/web.pid"; do
    grep -Fqx "version=1" "$record" || fail "managed PID metadata version missing"
    [ -n "$(record_value start_token "$record")" ] || fail "start token missing"
    [ -n "$(record_value executable "$record")" ] || fail "executable missing"
    [ -n "$(record_value cwd "$record")" ] || fail "cwd missing"
    [ -n "$(record_value port "$record")" ] || fail "port missing"
    [ "$(file_mode "$record")" = "600" ] || fail "PID metadata was not mode 0600"
  done
  stop_case_processes "$case_root"
}

run_with_default_owner_sources() {
  local case_root="$SMOKE_ROOT/default-owner"
  create_fixture "$case_root"
  local resolved_case_root
  resolved_case_root="$(cd "$case_root" && pwd)"
  local applications_repo="$resolved_case_root/projectkoios-applications"
  local ingestion_repo="$resolved_case_root/projectkoios-ingestion"
  local references_repo="$resolved_case_root/projectkoios-references"
  local document_root="$case_root/pizzi-document-root"
  mkdir -p \
    "$applications_repo/src/python" \
    "$ingestion_repo/src/python" \
    "$references_repo/src/python" \
    "$document_root"
  local api_capture="$case_root/api.capture"
  local web_capture="$case_root/web.capture"

  env -u KOIOS_APPLICATIONS_REPO -u KOIOS_INGESTION_REPO -u KOIOS_REFERENCES_REPO \
    PATH="$case_root/fake-bin:$PATH" \
    KOIOS_RUN_DIR="$case_root/run" \
    KOIOS_API_REPO="$case_root/api repo" \
    KOIOS_CORE_REPO="$case_root/core repo" \
    KOIOS_SEARCH_REPO="$case_root/search repo" \
    KOIOS_OBSIDIAN_REPO="$case_root/obsidian repo" \
    KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT="$document_root" \
    KOIOS_SMOKE_API_CAPTURE="$api_capture" \
    KOIOS_SMOKE_WEB_CAPTURE="$web_capture" \
    "$case_root/web/scripts/startup.sh" \
    >"$case_root/stdout" 2>"$case_root/stderr"

  wait_for_capture "$api_capture" "$web_capture"
  local expected_pythonpath="$case_root/api repo/src/python:$case_root/core repo/src/python:$case_root/search repo/src/python:$case_root/obsidian repo/src/python:$references_repo/src/python:$applications_repo/src/python:$ingestion_repo/src/python"
  if ! grep -Fqx "PYTHONPATH=$expected_pythonpath" "$api_capture"; then
    cat "$api_capture" >&2
    printf 'expected PYTHONPATH=%s\n' "$expected_pythonpath" >&2
    fail "default sibling owner sources were not resolved exactly"
  fi
  grep -Fqx "EQUATION_ROOT=$document_root" "$api_capture" ||
    fail "equation root was not passed with default owner sources"
  stop_case_processes "$case_root"
}

run_with_explicit_owner_sources() {
  local case_root="$SMOKE_ROOT/explicit owner"
  create_fixture "$case_root"
  local applications_repo="$case_root/applications repo"
  local ingestion_repo="$case_root/ingestion repo"
  local references_repo="$case_root/references repo"
  local document_root="$case_root/pizzi document root"
  local reference_corpus_root="$case_root/reference corpus"
  local resolution_root="$case_root/resolution artifacts"
  local multimodal_root="$case_root/multimodal artifacts"
  local catalogs="$case_root/explicit catalogs"
  mkdir -p \
    "$applications_repo/src/python" \
    "$ingestion_repo/src/python" \
    "$references_repo/src/python" \
    "$document_root" \
    "$reference_corpus_root" \
    "$resolution_root" \
    "$multimodal_root" \
    "$catalogs"
  printf 'KOIOS_REFERENCE_CORPUS_ROOT=%q\n' "$reference_corpus_root" \
    >"$case_root/web/.env.local"
  printf 'KOIOS_REFERENCE_PAGE_RESOLUTION_ROOT=%q\n' "$resolution_root" \
    >>"$case_root/web/.env.local"
  printf 'KOIOS_REFERENCE_MULTIMODAL_ROOT=%q\n' "$multimodal_root" \
    >>"$case_root/web/.env.local"
  local course_catalog="$catalogs/course catalog.json"
  local project_catalog="$catalogs/project catalog.json"
  printf '%s\n' '{"owner":"course"}' >"$course_catalog"
  printf '%s\n' '{"owner":"project"}' >"$project_catalog"
  local api_capture="$case_root/api.capture"
  local web_capture="$case_root/web.capture"

  env \
    PATH="$case_root/fake-bin:$PATH" \
    KOIOS_RUN_DIR="$case_root/run" \
    KOIOS_API_REPO="$case_root/api repo" \
    KOIOS_CORE_REPO="$case_root/core repo" \
    KOIOS_SEARCH_REPO="$case_root/search repo" \
    KOIOS_OBSIDIAN_REPO="$case_root/obsidian repo" \
    KOIOS_APPLICATIONS_REPO="$applications_repo" \
    KOIOS_INGESTION_REPO="$ingestion_repo" \
    KOIOS_REFERENCES_REPO="$references_repo" \
    KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT="$document_root" \
    KOIOS_COURSE_CATALOG="$course_catalog" \
    KOIOS_PROJECT_CATALOG="$project_catalog" \
    KOIOS_SMOKE_API_CAPTURE="$api_capture" \
    KOIOS_SMOKE_WEB_CAPTURE="$web_capture" \
    "$case_root/web/scripts/startup.sh" \
    >"$case_root/stdout" 2>"$case_root/stderr"

  wait_for_capture "$api_capture" "$web_capture"
  local expected_pythonpath="$case_root/api repo/src/python:$case_root/core repo/src/python:$case_root/search repo/src/python:$case_root/obsidian repo/src/python:$references_repo/src/python:$applications_repo/src/python:$ingestion_repo/src/python"
  grep -Fqx "PYTHONPATH=$expected_pythonpath" "$api_capture" ||
    fail "owner PYTHONPATH composition or ordering changed"
  grep -Fqx "EQUATION_ROOT=$document_root" "$api_capture" ||
    fail "explicit equation root was not passed exactly"
  grep -Fqx "COURSE_CATALOG=$course_catalog" "$api_capture" ||
    fail "explicit course catalog was replaced"
  grep -Fqx "PROJECT_CATALOG=$project_catalog" "$api_capture" ||
    fail "explicit project catalog was replaced"
  grep -Fqx "REFERENCE_CORPUS_ROOT=$reference_corpus_root" "$api_capture" ||
    fail "local reference corpus root was not passed to the API"
  grep -Fqx "REFERENCE_PAGE_RESOLUTION_ROOT=$resolution_root" "$api_capture" ||
    fail "local resolution root was not passed to the API"
  grep -Fqx "REFERENCE_MULTIMODAL_ROOT=$multimodal_root" "$api_capture" ||
    fail "local multimodal root was not passed to the API"
  grep -Fqx '{"owner":"course"}' "$course_catalog" ||
    fail "explicit course catalog was overwritten"
  grep -Fqx '{"owner":"project"}' "$project_catalog" ||
    fail "explicit project catalog was overwritten"
  test ! -e "$case_root/run/empty-courses.json" ||
    fail "course fallback was created over an explicit catalog"
  test ! -e "$case_root/run/empty-projects.json" ||
    fail "project fallback was created over an explicit catalog"
  stop_case_processes "$case_root"
}

run_with_reference_library_owner() {
  local case_root="$SMOKE_ROOT/reference library owner"
  create_fixture "$case_root"
  local references_repo="$case_root/reference feature worktree"
  local catalog="$case_root/private catalog/references.sqlite3"
  local search_index="$case_root/private index/search.sqlite3"
  mkdir -p \
    "$references_repo/src/python" \
    "$(dirname "$catalog")" \
    "$(dirname "$search_index")"
  : >"$catalog"
  : >"$search_index"
  local api_capture="$case_root/api.capture"
  local web_capture="$case_root/web.capture"

  env -u KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT \
    PATH="$case_root/fake-bin:$PATH" \
    KOIOS_RUN_DIR="$case_root/run" \
    KOIOS_API_REPO="$case_root/api repo" \
    KOIOS_CORE_REPO="$case_root/core repo" \
    KOIOS_SEARCH_REPO="$case_root/search repo" \
    KOIOS_OBSIDIAN_REPO="$case_root/obsidian repo" \
    KOIOS_REFERENCES_REPO="$references_repo" \
    PROJECTKOIOS_REFERENCE_CATALOG="$catalog" \
    PROJECTKOIOS_SEARCH_INDEX="$search_index" \
    KOIOS_SMOKE_API_CAPTURE="$api_capture" \
    KOIOS_SMOKE_WEB_CAPTURE="$web_capture" \
    "$case_root/web/scripts/startup.sh" \
    >"$case_root/stdout" 2>"$case_root/stderr"

  wait_for_capture "$api_capture" "$web_capture"
  local expected_pythonpath="$case_root/api repo/src/python:$case_root/core repo/src/python:$case_root/search repo/src/python:$case_root/obsidian repo/src/python:$references_repo/src/python"
  grep -Fqx "PYTHONPATH=$expected_pythonpath" "$api_capture" ||
    fail "reference feature worktree was not added to API PYTHONPATH"
  grep -Fqx "REFERENCE_CATALOG=$catalog" "$api_capture" ||
    fail "reference catalog was not passed exactly"
  grep -Fqx "SEARCH_INDEX=$search_index" "$api_capture" ||
    fail "search index was not passed exactly"
  grep -Fqx "EQUATION_ROOT=<unset>" "$api_capture" ||
    fail "reference library incorrectly enabled equation review"
  stop_case_processes "$case_root"
}

assert_invalid_root_fails() {
  local label="$1"
  local root_value="$2"
  local case_root="$SMOKE_ROOT/$label"
  create_fixture "$case_root"
  local api_capture="$case_root/api.capture"
  local web_capture="$case_root/web.capture"
  local status

  set +e
  env \
    PATH="$case_root/fake-bin:$PATH" \
    KOIOS_RUN_DIR="$case_root/run" \
    KOIOS_API_REPO="$case_root/api repo" \
    KOIOS_CORE_REPO="$case_root/core repo" \
    KOIOS_SEARCH_REPO="$case_root/search repo" \
    KOIOS_OBSIDIAN_REPO="$case_root/obsidian repo" \
    KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT="$root_value" \
    KOIOS_SMOKE_API_CAPTURE="$api_capture" \
    KOIOS_SMOKE_WEB_CAPTURE="$web_capture" \
    "$case_root/web/scripts/startup.sh" \
    >"$case_root/stdout" 2>"$case_root/stderr"
  status=$?
  set -e

  [ "$status" -ne 0 ] || fail "$label root unexpectedly succeeded"
  grep -Fq "must be an absolute existing directory" "$case_root/stderr" ||
    fail "$label root did not produce the bounded validation error"
  test ! -e "$api_capture" || fail "$label root started the API"
  test ! -e "$web_capture" || fail "$label root started the Web process"
  test ! -e "$case_root/run/api.pid" || fail "$label root wrote an API PID"
  test ! -e "$case_root/run/web.pid" || fail "$label root wrote a Web PID"
}

assert_missing_owner_source_fails() {
  local case_root="$SMOKE_ROOT/missing-owner-source"
  create_fixture "$case_root"
  local document_root="$case_root/pizzi document root"
  mkdir -p "$document_root"
  local status

  set +e
  env \
    PATH="$case_root/fake-bin:$PATH" \
    KOIOS_RUN_DIR="$case_root/run" \
    KOIOS_API_REPO="$case_root/api repo" \
    KOIOS_CORE_REPO="$case_root/core repo" \
    KOIOS_SEARCH_REPO="$case_root/search repo" \
    KOIOS_OBSIDIAN_REPO="$case_root/obsidian repo" \
    KOIOS_APPLICATIONS_REPO="$case_root/missing applications repo" \
    KOIOS_INGESTION_REPO="$case_root/missing ingestion repo" \
    KOIOS_REFERENCES_REPO="$case_root/missing references repo" \
    KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT="$document_root" \
    KOIOS_SMOKE_API_CAPTURE="$case_root/api.capture" \
    KOIOS_SMOKE_WEB_CAPTURE="$case_root/web.capture" \
    "$case_root/web/scripts/startup.sh" \
    >"$case_root/stdout" 2>"$case_root/stderr"
  status=$?
  set -e

  [ "$status" -ne 0 ] || fail "missing owner source unexpectedly succeeded"
  grep -Fq "Required Project Koios source tree not found" "$case_root/stderr" ||
    fail "missing owner source did not produce the bounded validation error"
  test ! -e "$case_root/api.capture" || fail "missing owner source started the API"
  test ! -e "$case_root/web.capture" || fail "missing owner source started the Web process"
}

run_with_caller_env_precedence() {
  local case_root="$SMOKE_ROOT/caller-env-precedence"
  create_fixture "$case_root"
  local local_root="$case_root/local root"
  local caller_root="$case_root/caller root"
  mkdir -p "$local_root" "$caller_root"
  printf 'KOIOS_REFERENCE_CORPUS_ROOT=%q\n' "$local_root" >"$case_root/web/.env.local"

  start_fixture "$case_root" "$case_root/stdout" "$case_root/stderr" \
    "KOIOS_REFERENCE_CORPUS_ROOT=$caller_root"

  grep -Fqx "REFERENCE_CORPUS_ROOT=$caller_root" "$case_root/api.capture" ||
    fail "caller environment did not override .env.local"
  grep -Fq ".env.local value ignored for caller-provided KOIOS_REFERENCE_CORPUS_ROOT" \
    "$case_root/stderr" || fail "caller precedence was not reported"
  stop_case_processes "$case_root"
}

run_concurrent_start() {
  local case_root="$SMOKE_ROOT/concurrent-start"
  create_fixture "$case_root"
  mkdir -p "$case_root/run"
  : >"$case_root/run/api.pid.tmp.interrupted"

  start_fixture "$case_root" "$case_root/first.stdout" "$case_root/first.stderr" \
    "KOIOS_SMOKE_CURL_DELAY=0.20" &
  local first_start=$!
  local attempt
  for attempt in $(seq 1 100); do
    [ -d "$case_root/run/lifecycle.lock" ] && break
    sleep 0.01
  done
  [ -d "$case_root/run/lifecycle.lock" ] || fail "first start did not acquire lock"

  start_fixture "$case_root" "$case_root/second.stdout" "$case_root/second.stderr"
  wait "$first_start" || fail "first concurrent start failed"

  grep -Fq "already running and healthy" "$case_root/second.stdout" ||
    fail "serialized second start did not reuse healthy services"
  local state_count
  state_count="$(find "$(state_root_for_case "$case_root")" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  [ "$state_count" = "2" ] || fail "concurrent start launched duplicate services"
  grep -Fqx "version=1" "$case_root/run/api.pid" ||
    fail "interrupted temporary record displaced atomic metadata"
  stop_case_processes "$case_root"
}

run_stale_pid_refusal() {
  local case_root="$SMOKE_ROOT/stale-pid"
  create_fixture "$case_root"
  start_fixture "$case_root" "$case_root/first.stdout" "$case_root/first.stderr"
  local api_pid
  api_pid="$(record_value pid "$case_root/run/api.pid")"
  kill "$api_pid"
  local attempt
  for attempt in $(seq 1 100); do
    [ -z "$(ps -p "$api_pid" -o uid= 2>/dev/null || true)" ] && break
    sleep 0.02
  done

  (
    cd "$case_root/api repo"
    bash -c 'while :; do sleep 1; done' projectkoios.api.main:app --host 127.0.0.1 --port 18080
  ) &
  local unrelated_pid=$!
  local unrelated_state="$(state_root_for_case "$case_root")/$unrelated_pid"
  mkdir -p "$unrelated_state"
  printf '%s\n' "$(cd "$case_root/api repo" && pwd -P)" >"$unrelated_state/cwd"
  printf '%s\n' "18080" >"$unrelated_state/port"
  awk -v replacement="pid=$unrelated_pid" \
    'index($0, "pid=") == 1 { print replacement; next } { print }' \
    "$case_root/run/api.pid" >"$case_root/run/api.pid.reused"
  chmod 600 "$case_root/run/api.pid.reused"
  mv "$case_root/run/api.pid.reused" "$case_root/run/api.pid"

  local status
  set +e
  start_fixture "$case_root" "$case_root/retry.stdout" "$case_root/retry.stderr"
  status=$?
  set -e
  [ "$status" -ne 0 ] || fail "reused stale PID unexpectedly succeeded"
  grep -Eq "PID start identity or owner changed|process command, executable, or cwd changed" \
    "$case_root/retry.stderr" || fail "stale PID did not fail with identity evidence"
  kill -0 "$unrelated_pid" 2>/dev/null || fail "stale PID handling killed unrelated process"
  test -f "$case_root/run/api.pid" || fail "stale PID evidence was removed"
  kill "$unrelated_pid"
  wait "$unrelated_pid" 2>/dev/null || true
  rm -rf "$unrelated_state"
  stop_case_processes "$case_root"
}

run_unhealthy_reuse_refusal() {
  local case_root="$SMOKE_ROOT/unhealthy-reuse"
  create_fixture "$case_root"
  start_fixture "$case_root" "$case_root/first.stdout" "$case_root/first.stderr"
  local api_pid web_pid status
  api_pid="$(record_value pid "$case_root/run/api.pid")"
  web_pid="$(record_value pid "$case_root/run/web.pid")"

  set +e
  start_fixture "$case_root" "$case_root/retry.stdout" "$case_root/retry.stderr" \
    "KOIOS_SMOKE_CURL_FAIL_PORT=18080"
  status=$?
  set -e
  [ "$status" -ne 0 ] || fail "unhealthy managed API was reused"
  grep -Fq "health check failed" "$case_root/retry.stderr" ||
    fail "unhealthy reuse did not report health failure"
  kill -0 "$api_pid" 2>/dev/null || fail "health refusal killed API"
  kill -0 "$web_pid" 2>/dev/null || fail "health refusal killed Web"
  stop_case_processes "$case_root"
}

run_identity_publication_failure_cleanup() {
  local case_root="$SMOKE_ROOT/identity-publication-failure"
  create_fixture "$case_root"
  local status

  set +e
  start_fixture "$case_root" "$case_root/stdout" "$case_root/stderr" \
    "KOIOS_SMOKE_PUBLISH_FAIL_PORT=18080" \
    "KOIOS_PROCESS_IDENTITY_ATTEMPTS=2" \
    "KOIOS_PROCESS_IDENTITY_DELAY=0.01"
  status=$?
  set -e

  [ "$status" -ne 0 ] || fail "incomplete process identity unexpectedly published"
  grep -Fq "Could not capture complete web-api process identity" "$case_root/stderr" ||
    fail "identity publication failure was not reported"
  test ! -e "$case_root/run/api.pid" ||
    fail "failed identity publication retained API metadata"
  test ! -e "$case_root/web.capture" ||
    fail "Web started after API identity publication failed"
  local state_count
  state_count="$(find "$(state_root_for_case "$case_root")" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  [ "$state_count" = "0" ] ||
    fail "failed identity publication orphaned the invocation-owned API child"
}

run_unbound_start_cleanup() {
  local case_root="$SMOKE_ROOT/unbound-start-cleanup"
  create_fixture "$case_root"
  local status

  set +e
  start_fixture "$case_root" "$case_root/stdout" "$case_root/stderr" \
    "KOIOS_SMOKE_NO_LISTEN_PORT=18080" \
    "KOIOS_STARTUP_READY_ATTEMPTS=2" \
    "KOIOS_STARTUP_READY_DELAY=0.01"
  status=$?
  set -e

  [ "$status" -ne 0 ] || fail "unbound managed process unexpectedly became ready"
  grep -Fq "Timed out waiting for Project Koios API" "$case_root/stderr" ||
    fail "unbound startup did not reach bounded readiness failure"
  test ! -e "$case_root/run/api.pid" ||
    fail "cleanup retained metadata for the invocation-owned unbound process"
  test ! -e "$case_root/web.capture" ||
    fail "Web started after the API failed to bind"
  local state_count
  state_count="$(find "$(state_root_for_case "$case_root")" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  [ "$state_count" = "0" ] ||
    fail "cleanup orphaned an invocation-owned process that never listened"
}

run_stale_lock_recovery() {
  local case_root="$SMOKE_ROOT/stale-lock"
  create_fixture "$case_root"
  mkdir -p "$case_root/run/lifecycle.lock"
  cat >"$case_root/run/lifecycle.lock/owner" <<EOF
version=1
pid=999999
uid=$(id -u)
start_token=Mon Jan 1 00:00:00 2001
cwd=$case_root
action=start
command=stale
EOF
  chmod 600 "$case_root/run/lifecycle.lock/owner"

  start_fixture "$case_root" "$case_root/stdout" "$case_root/stderr"
  find "$case_root/run" -maxdepth 1 -type d -name 'lifecycle.lock.stale.*' -print -quit |
    grep -q . || fail "verified stale lock evidence was not retained"
  grep -Fq "Recovered verified stale lifecycle lock" "$case_root/stderr" ||
    fail "stale lock recovery was not reported"
  stop_case_processes "$case_root"
}

run_api_only_restart() {
  local case_root="$SMOKE_ROOT/api-only-restart"
  create_fixture "$case_root"
  start_fixture "$case_root" "$case_root/first.stdout" "$case_root/first.stderr"
  local first_api_pid web_pid
  first_api_pid="$(record_value pid "$case_root/run/api.pid")"
  web_pid="$(record_value pid "$case_root/run/web.pid")"

  stop_fixture_service "$case_root" api >"$case_root/stop.stdout" 2>"$case_root/stop.stderr"
  test ! -e "$case_root/run/api.pid" || fail "API-only stop retained API metadata"
  kill -0 "$web_pid" 2>/dev/null || fail "API-only stop killed Web"

  start_fixture "$case_root" "$case_root/restart.stdout" "$case_root/restart.stderr"
  local second_api_pid
  second_api_pid="$(record_value pid "$case_root/run/api.pid")"
  [ "$second_api_pid" != "$first_api_pid" ] || fail "API-only restart reused stopped PID"
  [ "$(record_value pid "$case_root/run/web.pid")" = "$web_pid" ] ||
    fail "API-only restart replaced Web"
  grep -Fq "Project Koios web already running and healthy" "$case_root/restart.stdout" ||
    fail "API-only restart did not verify and reuse Web"
  stop_case_processes "$case_root"
}

run_surface_profile_refusal
run_runtime_root_isolation
run_surface_openapi_refusal
run_concurrent_deployment_surfaces
run_without_owner_sources
run_with_default_owner_sources
run_with_explicit_owner_sources
run_with_reference_library_owner
run_with_caller_env_precedence
run_concurrent_start
run_stale_pid_refusal
run_unhealthy_reuse_refusal
run_identity_publication_failure_cleanup
run_unbound_start_cleanup
run_stale_lock_recovery
run_api_only_restart
assert_invalid_root_fails "relative-root" "relative/pizzi2020"
assert_invalid_root_fails "missing-root" "$SMOKE_ROOT/does not exist"
assert_missing_owner_source_fails

echo "startup smoke checks passed"
