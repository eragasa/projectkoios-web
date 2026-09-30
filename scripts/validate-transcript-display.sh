#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  scripts/validate-transcript-display.sh \
    /absolute/path/to/projectkoios-api \
    relative/path/to/control.openapi.json \
    <exact-40-character-api-commit> \
    <expected-64-character-openapi-sha256>

Validates the Web transcript display against one reviewed API-owned control OpenAPI
artifact. The script never starts an owner, reads transcript data, installs dependencies,
or changes tracked files. It uses only sanitized browser fixtures.
EOF
}

if [ "$#" -ne 4 ]; then
  usage
  exit 64
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
WEB_ROOT="$(cd "$SCRIPT_DIR/.." && pwd -P)"
API_REPO_INPUT="$1"
OPENAPI_RELATIVE_PATH="$2"
EXPECTED_API_COMMIT="$3"
EXPECTED_OPENAPI_SHA256="$4"

case "$API_REPO_INPUT" in
  /*) ;;
  *)
    echo "API repository path must be absolute: $API_REPO_INPUT" >&2
    exit 64
    ;;
esac

case "$OPENAPI_RELATIVE_PATH" in
  "" | /* | ../* | */../* | */..)
    echo "OpenAPI path must be a non-empty path relative to the API repository." >&2
    exit 64
    ;;
esac

if [[ ! "$EXPECTED_API_COMMIT" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Expected API commit must be an exact 40-character lowercase commit hash." >&2
  exit 64
fi
if [[ ! "$EXPECTED_OPENAPI_SHA256" =~ ^[0-9a-f]{64}$ ]]; then
  echo "Expected OpenAPI SHA-256 must be an exact 64-character lowercase digest." >&2
  exit 64
fi

if [ ! -d "$API_REPO_INPUT/.git" ] && ! git -C "$API_REPO_INPUT" rev-parse --git-dir >/dev/null 2>&1; then
  echo "API repository is not a Git worktree: $API_REPO_INPUT" >&2
  exit 1
fi

API_REPO="$(cd "$API_REPO_INPUT" && pwd -P)"
OPENAPI_INPUT="$API_REPO/$OPENAPI_RELATIVE_PATH"
if [ ! -f "$OPENAPI_INPUT" ]; then
  echo "Control OpenAPI artifact not found: $OPENAPI_INPUT" >&2
  exit 1
fi
if [ -L "$OPENAPI_INPUT" ]; then
  echo "Control OpenAPI artifact must not be a symbolic link." >&2
  exit 1
fi
OPENAPI_DIR="$(cd "$(dirname "$OPENAPI_INPUT")" && pwd -P)"
OPENAPI_PATH="$OPENAPI_DIR/$(basename "$OPENAPI_INPUT")"
case "$OPENAPI_PATH" in
  "$API_REPO"/*) ;;
  *)
    echo "Resolved OpenAPI artifact escapes the API repository." >&2
    exit 1
    ;;
esac

ACTUAL_API_COMMIT="$(git -C "$API_REPO" rev-parse HEAD)"
if [ "$ACTUAL_API_COMMIT" != "$EXPECTED_API_COMMIT" ]; then
  echo "API revision mismatch." >&2
  echo "Expected: $EXPECTED_API_COMMIT" >&2
  echo "Actual:   $ACTUAL_API_COMMIT" >&2
  exit 1
fi
if ! git -C "$API_REPO" ls-files --error-unmatch "$OPENAPI_RELATIVE_PATH" >/dev/null 2>&1; then
  echo "Control OpenAPI artifact is not tracked by the supplied API revision." >&2
  exit 1
fi
if ! git -C "$API_REPO" diff --quiet "$EXPECTED_API_COMMIT" -- "$OPENAPI_RELATIVE_PATH"; then
  echo "Control OpenAPI artifact differs from the supplied API revision." >&2
  exit 1
fi

OPENAPI_TYPESCRIPT="$WEB_ROOT/node_modules/.bin/openapi-typescript"
PLAYWRIGHT="$WEB_ROOT/node_modules/.bin/playwright"
for executable in "$OPENAPI_TYPESCRIPT" "$PLAYWRIGHT"; do
  if [ ! -x "$executable" ]; then
    echo "Required Web dependency is missing: $executable" >&2
    echo "Stop: dependency installation is outside this validation script." >&2
    exit 1
  fi
done

for command in git npm cmp mktemp shasum awk; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command not found: $command" >&2
    exit 1
  fi
done

OPENAPI_SHA256="$(shasum -a 256 "$OPENAPI_PATH" | awk '{print $1}')"
if [ "$OPENAPI_SHA256" != "$EXPECTED_OPENAPI_SHA256" ]; then
  echo "Control OpenAPI SHA-256 mismatch." >&2
  echo "Expected: $EXPECTED_OPENAPI_SHA256" >&2
  echo "Actual:   $OPENAPI_SHA256" >&2
  exit 1
fi

API_STATUS_BEFORE="$(git -C "$API_REPO" status --porcelain=v1 --untracked-files=all)"
WEB_STATUS_BEFORE="$(git -C "$WEB_ROOT" status --porcelain=v1 --untracked-files=all)"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/koios-transcript-validation.XXXXXX")"
cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT INT TERM

GENERATED_SCHEMA="$TEMP_DIR/schema.generated.ts"
cd "$WEB_ROOT"

printf '%s\n' "[1/7] Regenerate API types into isolated temporary storage"
"$OPENAPI_TYPESCRIPT" "$OPENAPI_PATH" -o "$GENERATED_SCHEMA"

printf '%s\n' "[2/7] Compare the reviewed generated schema"
if ! cmp -s "$GENERATED_SCHEMA" "$WEB_ROOT/src/api/schema.generated.ts"; then
  echo "Generated schema is not synchronized with the supplied API artifact." >&2
  echo "Stop: refresh and review src/api/schema.generated.ts before validation." >&2
  exit 1
fi

printf '%s\n' "[3/7] Check formatting"
npm run format:check

printf '%s\n' "[4/7] Check TypeScript"
npm run typecheck

printf '%s\n' "[5/7] Run unit and managed-startup smoke tests"
npm test

printf '%s\n' "[6/7] Build the control profile"
npm run build:control

printf '%s\n' "[7/7] Run the bounded sanitized transcript browser contract"
CI=1 "$PLAYWRIGHT" test tests/e2e/transcripts.spec.ts --workers=1

API_STATUS_AFTER="$(git -C "$API_REPO" status --porcelain=v1 --untracked-files=all)"
WEB_STATUS_AFTER="$(git -C "$WEB_ROOT" status --porcelain=v1 --untracked-files=all)"
if [ "$API_STATUS_AFTER" != "$API_STATUS_BEFORE" ]; then
  echo "API worktree changed during validation; refusing success." >&2
  exit 1
fi
if [ "$WEB_STATUS_AFTER" != "$WEB_STATUS_BEFORE" ]; then
  echo "Web worktree changed during validation; refusing success." >&2
  exit 1
fi

WEB_COMMIT="$(git -C "$WEB_ROOT" rev-parse HEAD)"
cat <<EOF
Transcript display validation passed.
  API commit:       $ACTUAL_API_COMMIT
  OpenAPI SHA-256:  $OPENAPI_SHA256
  Web base commit:  $WEB_COMMIT
  Browser fixture:  sanitized; one spec; one worker
  Worktree status:  unchanged (tracked and untracked entries match)
  Other writes:     ignored build/test outputs; temporary schema removed on exit

Reuse limit: this proves schema synchronization and the Web read-only display contract
for the exact inputs above. It does not validate private corpus data, start an owner,
install dependencies, authorize review, or establish production readiness.
EOF
