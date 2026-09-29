#!/usr/bin/env bash

set -euo pipefail

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STARTUP_SOURCE="$REPOSITORY_ROOT/scripts/startup.sh"
SMOKE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/projectkoios-web-startup-smoke.XXXXXX")"
MANAGED_PIDS=()

fail() {
  echo "startup smoke failure: $*" >&2
  exit 1
}

stop_case_processes() {
  local case_root="$1"
  local pid_file
  for pid_file in "$case_root/run/web.pid" "$case_root/run/api.pid"; do
    if [ -f "$pid_file" ]; then
      local pid
      pid="$(cat "$pid_file")"
      if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
        MANAGED_PIDS+=("$pid")
        kill "$pid" 2>/dev/null || true
        local attempt
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
    fi
  done
}

cleanup() {
  local pid
  local pid_file
  while IFS= read -r pid_file; do
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ "$pid" =~ ^[0-9]+$ ]]; then
      kill "$pid" 2>/dev/null || true
      kill -9 "$pid" 2>/dev/null || true
    fi
  done < <(find "$SMOKE_ROOT" -type f -path '*/run/*.pid' 2>/dev/null)
  for pid in "${MANAGED_PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
    kill -9 "$pid" 2>/dev/null || true
  done
  rm -rf "$SMOKE_ROOT"
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
    "$case_root/fake-bin"
  cp "$STARTUP_SOURCE" "$case_root/web/scripts/startup.sh"
  chmod +x "$case_root/web/scripts/startup.sh"

  cat >"$case_root/fake-bin/curl" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
  cat >"$case_root/fake-bin/lsof" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
  chmod +x "$case_root/fake-bin/curl" "$case_root/fake-bin/lsof"

  cat >"$case_root/api repo/.venv/bin/python" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
{
  printf 'PYTHONPATH=%s\n' "${PYTHONPATH:-}"
  printf 'DEPLOYMENT_PROFILE=%s\n' "${KOIOS_DEPLOYMENT_PROFILE:-<unset>}"
  printf 'COURSE_CATALOG=%s\n' "${KOIOS_COURSE_CATALOG:-<unset>}"
  printf 'PROJECT_CATALOG=%s\n' "${KOIOS_PROJECT_CATALOG:-<unset>}"
  if [ "${KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT+x}" = x ]; then
    printf 'EQUATION_ROOT=%s\n' "$KOIOS_EQUATION_REVIEW_PIZZI2020_DOCUMENT_ROOT"
  else
    printf 'EQUATION_ROOT=<unset>\n'
  fi
  printf 'ARGS='
  printf '%q ' "$@"
  printf '\n'
} >"$KOIOS_SMOKE_API_CAPTURE"
exec sleep 300
EOF
  chmod +x "$case_root/api repo/.venv/bin/python"

  cat >"$case_root/web/node_modules/.bin/vite" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
{
  printf 'DEPLOYMENT_PROFILE=%s\n' "${VITE_KOIOS_DEPLOYMENT_PROFILE:-<unset>}"
  printf 'ARGS='
  printf '%q ' "$@"
  printf '\n'
} >"$KOIOS_SMOKE_WEB_CAPTURE"
exec sleep 300
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

run_without_owner_sources() {
  local case_root="$SMOKE_ROOT/no-owner"
  create_fixture "$case_root"
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
  local expected_pythonpath="$case_root/api repo/src/python:$case_root/core repo/src/python:$case_root/search repo/src/python:$case_root/obsidian repo/src/python"
  grep -Fqx "PYTHONPATH=$expected_pythonpath" "$api_capture" ||
    fail "default PYTHONPATH included unexpected owner sources"
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
  local expected_pythonpath="$case_root/api repo/src/python:$case_root/core repo/src/python:$case_root/search repo/src/python:$case_root/obsidian repo/src/python:$applications_repo/src/python:$ingestion_repo/src/python:$references_repo/src/python"
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
  local catalogs="$case_root/explicit catalogs"
  mkdir -p \
    "$applications_repo/src/python" \
    "$ingestion_repo/src/python" \
    "$references_repo/src/python" \
    "$document_root" \
    "$catalogs"
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
  local expected_pythonpath="$case_root/api repo/src/python:$case_root/core repo/src/python:$case_root/search repo/src/python:$case_root/obsidian repo/src/python:$applications_repo/src/python:$ingestion_repo/src/python:$references_repo/src/python"
  grep -Fqx "PYTHONPATH=$expected_pythonpath" "$api_capture" ||
    fail "owner PYTHONPATH composition or ordering changed"
  grep -Fqx "EQUATION_ROOT=$document_root" "$api_capture" ||
    fail "explicit equation root was not passed exactly"
  grep -Fqx "COURSE_CATALOG=$course_catalog" "$api_capture" ||
    fail "explicit course catalog was replaced"
  grep -Fqx "PROJECT_CATALOG=$project_catalog" "$api_capture" ||
    fail "explicit project catalog was replaced"
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
  grep -Fq "Equation-review owner source tree not found" "$case_root/stderr" ||
    fail "missing owner source did not produce the bounded validation error"
  test ! -e "$case_root/api.capture" || fail "missing owner source started the API"
  test ! -e "$case_root/web.capture" || fail "missing owner source started the Web process"
}

run_without_owner_sources
run_with_default_owner_sources
run_with_explicit_owner_sources
assert_invalid_root_fails "relative-root" "relative/pizzi2020"
assert_invalid_root_fails "missing-root" "$SMOKE_ROOT/does not exist"
assert_missing_owner_source_fails

echo "startup smoke checks passed"
