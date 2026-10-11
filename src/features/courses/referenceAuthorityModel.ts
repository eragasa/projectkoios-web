import {
  ApiError,
  type CourseReferenceAssetPreview,
  type CourseReferenceAssetPreviewRequest,
  type CourseReferenceFailureCode,
  type CourseReferenceIdentityPreview,
  type CourseReferenceIdentityPreviewRequest,
  type CourseReferenceItem,
} from "../../api/client";

export const SOLID_STATE_II_COURSE_ID = "dlsu.phy627m.gs1";
export const SOLID_STATE_II_REFERENCE_COUNT = 14;

export const resolutionLabels: Record<CourseReferenceItem["resolution"], string> = {
  ready: "Ready for authority review",
  "rendered-locator-unavailable": "Rendered locator unavailable",
  "display-guard-mismatch": "Display citekey guard mismatch",
  "candidate-unavailable": "Candidate unavailable",
  "candidate-ambiguous": "Candidate ambiguous",
  "candidate-display-guard-mismatch": "Candidate display guard mismatch",
  "owner-evidence-malformed": "Owner evidence malformed",
};

export const identityDispositionLabels = {
  ACCEPT_EXISTING: "Accept existing authority",
  ACCEPT_NEW: "Accept as new authority",
  MERGE: "Merge with existing authority",
  REJECT: "Reject candidate",
  DEFER: "Defer identity decision",
} as const;

export const assetDispositionLabels = {
  AUTHORIZE: "Authorize canonical asset",
  REJECT: "Reject asset candidates",
  DEFER: "Defer asset decision",
} as const;

export const recordMatchLabels: Record<
  CourseReferenceItem["record_matches"][number]["kind"],
  string
> = {
  "exact-observed-key-and-bytes": "Exact observed key and bytes",
  "exact-rendered-key-and-bytes": "Exact rendered key and bytes",
  "same-key-different-bytes": "Conflict · same key, different bytes",
  "same-observed-bytes-different-key":
    "Conflict · observed bytes under a different key",
  "same-rendered-bytes-different-key":
    "Conflict · rendered bytes under a different key",
};

const staleCodes = new Set<CourseReferenceFailureCode>([
  "EVIDENCE_STALE",
  "REVISION_STALE",
  "TARGET_STALE",
  "CONCURRENT_DECISION",
  "IDEMPOTENCY_CONFLICT",
]);

export function isFreshnessFailure(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 409 ||
      Boolean(error.code && staleCodes.has(error.code as CourseReferenceFailureCode)))
  );
}

export function courseReferenceError(
  error: unknown,
  operation: "queue" | "preview" | "decision",
): string {
  if (!(error instanceof ApiError)) {
    return operation === "queue"
      ? "The course reference queue is unavailable."
      : operation === "preview"
        ? "The owner could not preview this decision."
        : "The owner did not record this decision.";
  }
  switch (error.code as CourseReferenceFailureCode | undefined) {
    case "COURSE_NOT_FOUND":
      return "This course reference scope is not configured.";
    case "ITEM_NOT_FOUND":
      return "This queue item is no longer present. Reload the owner queue.";
    case "EVIDENCE_STALE":
      return "The evidence changed. The prior preview is invalid; reload before continuing.";
    case "REVISION_STALE":
      return "A newer item revision exists. The prior preview is invalid; reload before continuing.";
    case "TARGET_STALE":
      return "The selected authority target changed. The prior preview is invalid; reload before continuing.";
    case "CONCURRENT_DECISION":
      return "A concurrent decision won. Reload the owner queue before continuing.";
    case "IDEMPOTENCY_CONFLICT":
      return "The decision key conflicts with different inputs. Reload and create a new intent.";
    case "INVALID_DISPOSITION":
      return "The owner rejected this disposition or its exact consequence fields.";
    case "OWNER_MALFORMED":
      return "The References owner returned malformed authority evidence.";
    case "OWNER_UNAVAILABLE":
      return "The References owner is currently unavailable.";
    default:
      return operation === "queue"
        ? "The course reference queue is unavailable."
        : operation === "preview"
          ? "The owner could not preview this decision."
          : "The owner did not record this decision.";
  }
}

export function parseAliasCitekeys(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/u)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function utcSecond(now = new Date()): string {
  return now.toISOString().replace(/\.\d{3}Z$/u, "Z");
}

function sameStrings(left: string[], right: string[]): boolean {
  return (
    left.length === right.length && left.every((value, index) => value === right[index])
  );
}

export function identityPreviewMatches(
  preview: CourseReferenceIdentityPreview,
  request: CourseReferenceIdentityPreviewRequest,
  selectionId: string,
): boolean {
  return (
    preview.selection_id === selectionId &&
    preview.queue_id === request.expected_queue_id &&
    preview.item_revision_id === request.expected_item_revision_id &&
    preview.disposition === request.disposition &&
    preview.target_state_projection_id ===
      (request.target_state_projection_id ?? null) &&
    preview.canonical_citekey === (request.canonical_citekey ?? null) &&
    preview.expected_current_decision_id ===
      (request.expected_current_decision_id ?? null) &&
    sameStrings(preview.alias_citekeys, request.alias_citekeys) &&
    sameStrings(preview.selected_record_match_ids, request.selected_record_match_ids)
  );
}

export function assetPreviewMatches(
  preview: CourseReferenceAssetPreview,
  request: CourseReferenceAssetPreviewRequest,
  selectionId: string,
): boolean {
  return (
    preview.selection_id === selectionId &&
    preview.queue_id === request.expected_queue_id &&
    preview.item_revision_id === request.expected_item_revision_id &&
    preview.disposition === request.disposition &&
    preview.identity_state_projection_id ===
      request.expected_identity_state_projection_id &&
    preview.expected_current_decision_id ===
      (request.expected_current_decision_id ?? null) &&
    preview.competitors.length === request.competitors.length &&
    preview.competitors.every((value, index) => {
      const requested = request.competitors[index];
      return (
        value.asset_observation_id === requested?.asset_observation_id &&
        value.disposition === requested.disposition &&
        value.rationale === requested.rationale
      );
    })
  );
}
