#!/usr/bin/env bash

# Shared, source-only helpers for serialized Project Koios process lifecycle management.
# Callers remain responsible for `set -euo pipefail` and for acquiring the lifecycle
# lock before inspecting, starting, or stopping managed processes.

KOIOS_LIFECYCLE_LOCK_HELD=0
KOIOS_LIFECYCLE_LOCK_DIR=""
KOIOS_LIFECYCLE_LOCK_PID=""
KOIOS_LIFECYCLE_LOCK_START=""
KOIOS_VERIFY_REASON=""
KOIOS_VERIFIED_PID=""
KOIOS_RESOLVED_RUN_DIR=""

koios_resolve_run_dir() {
  local web_root="$1"
  local surface="$2"
  local value source
  if [ "${KOIOS_RUN_DIR+x}" = x ]; then
    value="$KOIOS_RUN_DIR"
    source=KOIOS_RUN_DIR
  elif [ "${KOIOS_RUNTIME_ROOT+x}" = x ]; then
    if [ -z "$KOIOS_RUNTIME_ROOT" ] || [[ "$KOIOS_RUNTIME_ROOT" == *$'\n'* ]] ||
      [[ "$KOIOS_RUNTIME_ROOT" == *$'\r'* ]]; then
      echo "KOIOS_RUNTIME_ROOT must be a non-empty single-line path." >&2
      return 1
    fi
    case "$surface" in
      www | web) ;;
      *)
        echo "Cannot derive a runtime directory for unknown surface: $surface" >&2
        return 1
        ;;
    esac
    value="${KOIOS_RUNTIME_ROOT%/}/$surface"
    source=KOIOS_RUNTIME_ROOT
  else
    value="$web_root/.run/$surface"
    source=default
  fi
  if [ -z "$value" ] || [[ "$value" == *$'\n'* ]] || [[ "$value" == *$'\r'* ]]; then
    echo "$source must resolve to a non-empty single-line run directory." >&2
    return 1
  fi
  KOIOS_RESOLVED_RUN_DIR="$value"
}

koios_trim_whitespace() {
  printf '%s' "$1" | awk '{$1=$1; print}'
}

koios_metadata_value() {
  local key="$1"
  local file="$2"
  awk -v prefix="$key=" 'index($0, prefix) == 1 { print substr($0, length(prefix) + 1); exit }' "$file"
}

koios_process_uid() {
  local pid="$1"
  local value
  value="$(ps -p "$pid" -o uid= 2>/dev/null || true)"
  koios_trim_whitespace "$value"
}

koios_process_start_token() {
  local pid="$1"
  local value
  value="$(ps -p "$pid" -o lstart= 2>/dev/null || true)"
  koios_trim_whitespace "$value"
}

koios_process_parent_pid() {
  local pid="$1"
  local value
  value="$(ps -p "$pid" -o ppid= 2>/dev/null || true)"
  koios_trim_whitespace "$value"
}

koios_process_command() {
  local pid="$1"
  ps -p "$pid" -o command= 2>/dev/null || true
}

koios_process_cwd() {
  local pid="$1"
  { lsof -a -p "$pid" -d cwd -Fn 2>/dev/null || true; } |
    awk 'substr($0, 1, 1) == "n" { print substr($0, 2); exit }'
}

koios_process_executable() {
  local pid="$1"
  { lsof -a -p "$pid" -d txt -Fn 2>/dev/null || true; } |
    awk 'substr($0, 1, 1) == "n" { print substr($0, 2); exit }'
}

koios_port_owned_by_pid() {
  local pid="$1"
  local port="$2"
  local observed
  observed="$(lsof -n -P -a -p "$pid" -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null || true)"
  [ "$observed" = "$pid" ]
}

koios_validate_record_field() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ] || [[ "$value" == *$'\n'* ]] || [[ "$value" == *$'\r'* ]]; then
    echo "Cannot record invalid managed-process field: $name" >&2
    return 1
  fi
}

koios_atomic_write_record() {
  local destination="$1"
  shift
  local temporary="${destination}.tmp.$$.$RANDOM"
  umask 077
  : >"$temporary"
  local line
  for line in "$@"; do
    printf '%s\n' "$line" >>"$temporary"
  done
  chmod 600 "$temporary"
  mv -f "$temporary" "$destination"
}

koios_publish_process_record() {
  local record_file="$1"
  local service="$2"
  local pid="$3"
  local expected_cwd="$4"
  local host="$5"
  local port="$6"
  local command_marker="$7"
  local health_url="$8"
  local attempts="${KOIOS_PROCESS_IDENTITY_ATTEMPTS:-100}"
  local delay="${KOIOS_PROCESS_IDENTITY_DELAY:-0.02}"
  local attempt=1
  local uid=""
  local start_token=""
  local command=""
  local cwd=""
  local executable=""
  local previous_identity=""

  while [ "$attempt" -le "$attempts" ]; do
    uid="$(koios_process_uid "$pid")"
    start_token="$(koios_process_start_token "$pid")"
    command="$(koios_process_command "$pid")"
    cwd="$(koios_process_cwd "$pid")"
    executable="$(koios_process_executable "$pid")"
    local identity="$uid|$start_token|$command|$cwd|$executable"
    if [ -n "$uid" ] && [ -n "$start_token" ] && [ -n "$command" ] &&
      [ -n "$cwd" ] && [ -n "$executable" ] && [ "$identity" = "$previous_identity" ]; then
      break
    fi
    previous_identity="$identity"
    sleep "$delay"
    attempt=$((attempt + 1))
  done

  if [ -z "$uid" ] || [ -z "$start_token" ] || [ -z "$command" ] ||
    [ -z "$cwd" ] || [ -z "$executable" ]; then
    echo "Could not capture complete $service process identity for PID $pid." >&2
    return 1
  fi
  if [ "$uid" != "$(id -u)" ]; then
    echo "Refusing to manage $service PID $pid owned by UID $uid." >&2
    return 1
  fi
  if [ "$cwd" != "$expected_cwd" ]; then
    echo "Refusing to record $service PID $pid with unexpected cwd: $cwd" >&2
    return 1
  fi
  if [[ "$command" != *"$command_marker"* ]]; then
    echo "Refusing to record $service PID $pid with unexpected command: $command" >&2
    return 1
  fi

  local field
  for field in "$service" "$uid" "$start_token" "$command" "$executable" \
    "$cwd" "$host" "$port" "$command_marker" "$health_url"; do
    koios_validate_record_field "process metadata" "$field"
  done

  koios_atomic_write_record "$record_file" \
    "version=1" \
    "service=$service" \
    "pid=$pid" \
    "uid=$uid" \
    "start_token=$start_token" \
    "executable=$executable" \
    "cwd=$cwd" \
    "host=$host" \
    "port=$port" \
    "command_marker=$command_marker" \
    "health_url=$health_url" \
    "command=$command"
}

koios_verify_process_record() {
  local record_file="$1"
  local expected_service="$2"
  local expected_cwd="$3"
  local expected_host="$4"
  local expected_port="$5"
  local expected_marker="$6"
  local require_port="${7:-1}"
  KOIOS_VERIFY_REASON=""
  KOIOS_VERIFIED_PID=""

  if [ ! -f "$record_file" ]; then
    KOIOS_VERIFY_REASON="metadata is absent"
    return 4
  fi

  local version service pid uid start_token executable cwd host port marker command
  version="$(koios_metadata_value version "$record_file")"
  service="$(koios_metadata_value service "$record_file")"
  pid="$(koios_metadata_value pid "$record_file")"
  uid="$(koios_metadata_value uid "$record_file")"
  start_token="$(koios_metadata_value start_token "$record_file")"
  executable="$(koios_metadata_value executable "$record_file")"
  cwd="$(koios_metadata_value cwd "$record_file")"
  host="$(koios_metadata_value host "$record_file")"
  port="$(koios_metadata_value port "$record_file")"
  marker="$(koios_metadata_value command_marker "$record_file")"
  command="$(koios_metadata_value command "$record_file")"

  if [ "$version" != "1" ] || [[ ! "$pid" =~ ^[0-9]+$ ]] ||
    [ -z "$uid" ] || [ -z "$start_token" ] || [ -z "$executable" ] ||
    [ -z "$cwd" ] || [ -z "$command" ]; then
    KOIOS_VERIFY_REASON="metadata is malformed"
    return 2
  fi
  if [ "$service" != "$expected_service" ] || [ "$cwd" != "$expected_cwd" ] ||
    [ "$host" != "$expected_host" ] || [ "$port" != "$expected_port" ] ||
    [ "$marker" != "$expected_marker" ]; then
    KOIOS_VERIFY_REASON="metadata does not match the requested service configuration"
    return 2
  fi

  local current_uid current_start current_command current_cwd current_executable
  current_uid="$(koios_process_uid "$pid")"
  if [ -z "$current_uid" ]; then
    KOIOS_VERIFY_REASON="recorded process is not running"
    return 3
  fi
  current_start="$(koios_process_start_token "$pid")"
  if [ "$current_uid" != "$uid" ] || [ "$current_uid" != "$(id -u)" ] ||
    [ "$current_start" != "$start_token" ]; then
    KOIOS_VERIFY_REASON="PID start identity or owner changed"
    return 2
  fi
  current_command="$(koios_process_command "$pid")"
  current_cwd="$(koios_process_cwd "$pid")"
  current_executable="$(koios_process_executable "$pid")"
  if [ "$current_command" != "$command" ] || [[ "$current_command" != *"$expected_marker"* ]] ||
    [ "$current_cwd" != "$cwd" ] || [ "$current_executable" != "$executable" ]; then
    KOIOS_VERIFY_REASON="process command, executable, or cwd changed"
    return 2
  fi
  if [ "$require_port" -eq 1 ] && ! koios_port_owned_by_pid "$pid" "$expected_port"; then
    KOIOS_VERIFY_REASON="process does not own the expected listening port"
    return 2
  fi

  KOIOS_VERIFIED_PID="$pid"
  return 0
}

koios_is_legacy_pid_file() {
  local record_file="$1"
  [ -f "$record_file" ] || return 1
  local contents
  contents="$(cat "$record_file")"
  [[ "$contents" =~ ^[0-9]+$ ]]
}

koios_upgrade_legacy_pid_file() {
  local record_file="$1"
  local service="$2"
  local expected_cwd="$3"
  local host="$4"
  local port="$5"
  local marker="$6"
  local health_url="$7"
  local pid
  pid="$(cat "$record_file")"

  if ! kill -0 "$pid" 2>/dev/null; then
    rm -f "$record_file"
    return 3
  fi
  local uid command cwd executable
  uid="$(koios_process_uid "$pid")"
  command="$(koios_process_command "$pid")"
  cwd="$(koios_process_cwd "$pid")"
  executable="$(koios_process_executable "$pid")"
  if [ "$uid" != "$(id -u)" ] || [[ "$command" != *"$marker"* ]] ||
    [ "$cwd" != "$expected_cwd" ] || [ -z "$executable" ] ||
    ! koios_port_owned_by_pid "$pid" "$port"; then
    KOIOS_VERIFY_REASON="legacy PID does not match command, executable, cwd, owner, and port"
    return 2
  fi
  koios_publish_process_record "$record_file" "$service" "$pid" "$expected_cwd" \
    "$host" "$port" "$marker" "$health_url"
}

koios_prepare_process_record() {
  local record_file="$1"
  local service="$2"
  local expected_cwd="$3"
  local host="$4"
  local port="$5"
  local marker="$6"
  local health_url="$7"

  if [ ! -e "$record_file" ]; then
    return 1
  fi
  if koios_is_legacy_pid_file "$record_file"; then
    local upgrade_status
    if koios_upgrade_legacy_pid_file "$record_file" "$service" "$expected_cwd" \
      "$host" "$port" "$marker" "$health_url"; then
      :
    else
      upgrade_status=$?
      if [ "$upgrade_status" -eq 3 ]; then
        return 1
      fi
      echo "Refusing to reuse $service metadata at $record_file: $KOIOS_VERIFY_REASON." >&2
      return 2
    fi
  fi

  local verify_status
  if koios_verify_process_record "$record_file" "$service" "$expected_cwd" \
    "$host" "$port" "$marker" 1; then
    return 0
  else
    verify_status=$?
  fi
  if [ "$verify_status" -eq 3 ]; then
    rm -f "$record_file"
    return 1
  fi
  echo "Refusing to reuse $service metadata at $record_file: $KOIOS_VERIFY_REASON." >&2
  return 2
}

koios_invocation_owns_child() {
  local pid="$1"
  local expected_start="$2"
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  [ "$(koios_process_uid "$pid")" = "$(id -u)" ] || return 1
  [ "$(koios_process_parent_pid "$pid")" = "$$" ] || return 1
  [ "$(koios_process_start_token "$pid")" = "$expected_start" ] || return 1
  local job_pid
  while IFS= read -r job_pid; do
    [ "$job_pid" = "$pid" ] && return 0
  done < <(jobs -pr)
  return 1
}

koios_stop_invocation_child() {
  local name="$1"
  local pid="$2"
  local start_token
  start_token="$(koios_process_start_token "$pid")"
  if [ -z "$(koios_process_uid "$pid")" ]; then
    echo "$name stopped before managed metadata was published."
    return 0
  fi
  if [ -z "$start_token" ] || ! koios_invocation_owns_child "$pid" "$start_token"; then
    echo "Refusing to stop unrecorded $name PID $pid: direct-child ownership could not be verified." >&2
    return 1
  fi

  kill "$pid"
  local attempt=1
  while [ "$attempt" -le 40 ]; do
    if [ -z "$(koios_process_uid "$pid")" ]; then
      echo "$name stopped after metadata publication failed."
      return 0
    fi
    if ! koios_invocation_owns_child "$pid" "$start_token"; then
      echo "Refusing further signals for unrecorded $name PID $pid: direct-child identity changed." >&2
      return 1
    fi
    sleep 0.25
    attempt=$((attempt + 1))
  done

  if ! koios_invocation_owns_child "$pid" "$start_token"; then
    echo "Refusing SIGKILL for unrecorded $name PID $pid: direct-child identity changed." >&2
    return 1
  fi
  echo "$name did not stop after 10 seconds; sending SIGKILL." >&2
  kill -9 "$pid"
  attempt=1
  while [ "$attempt" -le 40 ] && [ -n "$(koios_process_uid "$pid")" ]; do
    sleep 0.05
    attempt=$((attempt + 1))
  done
  if [ -n "$(koios_process_uid "$pid")" ]; then
    echo "Unrecorded $name PID $pid remained after SIGKILL." >&2
    return 1
  fi
  echo "$name stopped after metadata publication failed."
}

koios_stop_recorded_process() {
  local name="$1"
  local record_file="$2"
  local service="$3"
  local expected_cwd="$4"
  local host="$5"
  local port="$6"
  local marker="$7"
  local require_port="${8:-1}"

  if [ ! -e "$record_file" ]; then
    echo "$name is not managed by this workspace."
    return 0
  fi
  if koios_is_legacy_pid_file "$record_file"; then
    local health_url="http://$host:$port/"
    local legacy_status=0
    if koios_upgrade_legacy_pid_file "$record_file" "$service" "$expected_cwd" \
      "$host" "$port" "$marker" "$health_url"; then
      :
    else
      legacy_status=$?
      if [ "$legacy_status" -eq 3 ]; then
        echo "$name is already stopped."
        return 0
      fi
      echo "Refusing to stop $name: $KOIOS_VERIFY_REASON." >&2
      return 1
    fi
  fi

  local verify_status
  if koios_verify_process_record "$record_file" "$service" "$expected_cwd" \
    "$host" "$port" "$marker" "$require_port"; then
    :
  else
    verify_status=$?
    if [ "$verify_status" -eq 3 ]; then
      echo "$name is already stopped."
      rm -f "$record_file"
      return 0
    fi
    echo "Refusing to stop $name: $KOIOS_VERIFY_REASON." >&2
    return 1
  fi

  local pid="$KOIOS_VERIFIED_PID"
  kill "$pid"
  local attempt=1
  while [ "$attempt" -le 40 ]; do
    if [ -z "$(koios_process_uid "$pid")" ]; then
      rm -f "$record_file"
      echo "$name stopped."
      return 0
    fi
    local post_signal_status=0
    if koios_verify_process_record "$record_file" "$service" "$expected_cwd" \
      "$host" "$port" "$marker" 0; then
      :
    else
      post_signal_status=$?
      if [ "$post_signal_status" -eq 3 ]; then
        rm -f "$record_file"
        echo "$name stopped."
        return 0
      fi
      echo "Refusing further signals for $name PID $pid: $KOIOS_VERIFY_REASON." >&2
      return 1
    fi
    sleep 0.25
    attempt=$((attempt + 1))
  done

  if ! koios_verify_process_record "$record_file" "$service" "$expected_cwd" \
    "$host" "$port" "$marker" 0; then
    echo "Refusing SIGKILL for $name PID $pid: $KOIOS_VERIFY_REASON." >&2
    return 1
  fi
  echo "$name did not stop after 10 seconds; sending SIGKILL." >&2
  kill -9 "$pid"
  attempt=1
  while [ "$attempt" -le 40 ] && [ -n "$(koios_process_uid "$pid")" ]; do
    sleep 0.05
    attempt=$((attempt + 1))
  done
  if [ -n "$(koios_process_uid "$pid")" ]; then
    echo "$name PID $pid remained after SIGKILL; retaining metadata." >&2
    return 1
  fi
  rm -f "$record_file"
  echo "$name stopped."
}

koios_write_lock_owner() {
  local owner_file="$1"
  local action="$2"
  local pid="$$"
  local uid start_token cwd command
  uid="$(id -u)"
  start_token="$(koios_process_start_token "$pid")"
  cwd="$(pwd -P)"
  command="$(koios_process_command "$pid")"
  koios_atomic_write_record "$owner_file" \
    "version=1" \
    "pid=$pid" \
    "uid=$uid" \
    "start_token=$start_token" \
    "cwd=$cwd" \
    "action=$action" \
    "command=$command"
  KOIOS_LIFECYCLE_LOCK_PID="$pid"
  KOIOS_LIFECYCLE_LOCK_START="$start_token"
}

koios_lock_is_verified_stale() {
  local owner_file="$1"
  [ -f "$owner_file" ] || return 1
  local version pid uid start_token
  version="$(koios_metadata_value version "$owner_file")"
  pid="$(koios_metadata_value pid "$owner_file")"
  uid="$(koios_metadata_value uid "$owner_file")"
  start_token="$(koios_metadata_value start_token "$owner_file")"
  [ "$version" = "1" ] && [[ "$pid" =~ ^[0-9]+$ ]] && [ -n "$uid" ] &&
    [ -n "$start_token" ] || return 1
  local current_uid current_start
  current_uid="$(koios_process_uid "$pid")"
  current_start="$(koios_process_start_token "$pid")"
  [ -z "$current_uid" ] || [ "$current_uid" != "$uid" ] ||
    [ "$current_start" != "$start_token" ]
}

koios_acquire_lifecycle_lock() {
  local run_dir="$1"
  local action="$2"
  local attempts="${KOIOS_LIFECYCLE_LOCK_ATTEMPTS:-200}"
  local delay="${KOIOS_LIFECYCLE_LOCK_DELAY:-0.05}"
  local lock_dir="$run_dir/lifecycle.lock"
  local attempt=1

  mkdir -p "$run_dir"
  chmod 700 "$run_dir"
  while [ "$attempt" -le "$attempts" ]; do
    if mkdir -m 700 "$lock_dir" 2>/dev/null; then
      koios_write_lock_owner "$lock_dir/owner" "$action"
      KOIOS_LIFECYCLE_LOCK_HELD=1
      KOIOS_LIFECYCLE_LOCK_DIR="$lock_dir"
      return 0
    fi
    if koios_lock_is_verified_stale "$lock_dir/owner"; then
      local stale_dir="$run_dir/lifecycle.lock.stale.$(date +%s).$$"
      if mv "$lock_dir" "$stale_dir" 2>/dev/null; then
        echo "Recovered verified stale lifecycle lock; evidence retained at $stale_dir." >&2
        continue
      fi
    fi
    sleep "$delay"
    attempt=$((attempt + 1))
  done
  echo "Timed out waiting for the managed lifecycle lock at $lock_dir." >&2
  return 1
}

koios_release_lifecycle_lock() {
  [ "$KOIOS_LIFECYCLE_LOCK_HELD" -eq 1 ] || return 0
  local owner_file="$KOIOS_LIFECYCLE_LOCK_DIR/owner"
  local owner_pid owner_start
  owner_pid="$(koios_metadata_value pid "$owner_file" 2>/dev/null || true)"
  owner_start="$(koios_metadata_value start_token "$owner_file" 2>/dev/null || true)"
  if [ "$owner_pid" != "$KOIOS_LIFECYCLE_LOCK_PID" ] ||
    [ "$owner_start" != "$KOIOS_LIFECYCLE_LOCK_START" ]; then
    echo "Refusing to release lifecycle lock not owned by this process." >&2
    return 1
  fi
  rm -rf "$KOIOS_LIFECYCLE_LOCK_DIR"
  KOIOS_LIFECYCLE_LOCK_HELD=0
}

koios_load_local_env_preserving_caller() {
  local env_file="$1"
  [ -f "$env_file" ] || return 0
  local caller_names=()
  local caller_values=()
  local name
  while IFS= read -r name; do
    case "$name" in
      KOIOS_* | PROJECTKOIOS_* | VITE_KOIOS_*)
        caller_names+=("$name")
        caller_values+=("${!name}")
        ;;
    esac
  done < <(compgen -e)

  set -a
  # shellcheck disable=SC1090
  . "$env_file"
  set +a

  local index local_value
  for ((index = 0; index < ${#caller_names[@]}; index++)); do
    name="${caller_names[$index]}"
    local_value="${!name-}"
    if [ "$local_value" != "${caller_values[$index]}" ]; then
      echo ".env.local value ignored for caller-provided $name." >&2
    fi
    printf -v "$name" '%s' "${caller_values[$index]}"
    export "$name"
  done
}
