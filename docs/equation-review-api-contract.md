# Equation-review API contract

## Authority

The control-only Equation review workspace consumes the deterministic OpenAPI document
from `projectkoios-api` commit `4a7bfa8cba8f1387f51ac29f1ee1e15720d975a7`.
`src/api/schema.generated.ts` is generated from that document; there is no handwritten
equation-review response projection. The browser never falls back to filesystem or
corpus access.

## Endpoints

```text
GET /equation-reviews?document_id=pizzi2020
GET /equation-reviews/{candidate_id}/region
PUT /equation-reviews/{candidate_id}/decision
```

The queue returns complete candidates with source identity, PDF-point region and image
hash, deterministic evidence, nullable assisted output, and the latest nullable human
decision. The API supports only its configured document identity and returns a safe 404
when that identity is not configured.

The region endpoint returns owner-validated PNG, JPEG, or WebP evidence. The API binds
the image to `region.image_sha256`, buffers at most 20,000,000 bytes, and sends
`Content-Disposition: inline` and `X-Content-Type-Options: nosniff`. The browser sends
only the opaque candidate identity and never a source path.

## Human decision request

The generated `EquationReviewDecisionRequest` contains exactly:

```ts
interface EquationReviewDecisionRequest {
  disposition: "ACCEPT_TRANSCRIPTION" | "REJECT_CANDIDATE" | "REVISION_REQUIRED";
  assistance_proposal_sha256: string | null;
  note: string;
  expected_previous_revision: number;
}
```

The browser sends `expected_previous_revision: 0` before the first decision and the
currently displayed owner revision thereafter. `ACCEPT_TRANSCRIPTION` binds the exact
displayed assisted proposal SHA-256. Retrieving or displaying assisted text never
accepts it.

The request contains no receipt identifier or review timestamp. The API creates
`recorded_at_utc`, asks the owner to append the revision, and returns the owner-stored
winning revision. Its HTTP response field is `updated_at_utc`; the UI displays that
owner-returned value as the recorded time. A semantic retry can therefore return the
original winning revision and time.

## Typed failures

The UI handles the generated `EquationReviewFailureResponse` without implying that a
write succeeded:

- HTTP 409 `EQUATION_REVIEW_PROPOSAL_STALE` — displayed assistance changed;
- HTTP 409 `EQUATION_REVIEW_EVIDENCE_STALE` — immutable evidence changed;
- HTTP 409 `EQUATION_REVIEW_REVISION_STALE` — a newer revision exists;
- HTTP 409 `EQUATION_REVIEW_CONCURRENT_DECISION` — a different concurrent decision
  won;
- HTTP 503 `EQUATION_REVIEW_PARTIAL_OUTPUT` — owner output was partial or malformed;
- HTTP 503 `EQUATION_REVIEW_OWNER_UNAVAILABLE` — the authorized owner was unavailable.

Conflict and unavailable states tell the operator to reload owner-backed evidence. Only
a successful decision response displays a recorded revision and time.
