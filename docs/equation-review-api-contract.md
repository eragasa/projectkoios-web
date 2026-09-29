# Equation-review API contract

## Authority

The control-only Equation review workspace consumes the deterministic OpenAPI document
from `projectkoios-api` commit `ae2f60668be892b54892b916ac3464a35496628e`
(tree `66e2f5474b97d00e8eb7a84826abd0686ed23aaf`). Its SHA-256 is
`32953ba016f00a7ba9b63a05cdf8c70d8975273a769fd843d83ede2f6211ff38`.
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
hash, deterministic evidence, display mode, nullable assisted output, review status,
current and expected revisions, and the latest nullable human decision. The API supports
only its configured document identity and returns a safe 404 when that identity is not
configured.

The region endpoint returns owner-validated PNG, JPEG, or WebP evidence. The API binds
the image to `region.image_sha256`, buffers at most 20,000,000 bytes, and sends
`Content-Disposition: inline` and `X-Content-Type-Options: nosniff`. The browser sends
only the opaque candidate identity and never a source path.

## Canonical source and preview boundary

The reviewer edits LaTeX and chooses `INLINE` or `DISPLAY`. The browser deterministically
derives the corresponding Obsidian/MathJax-compatible Markdown solely for review:

```text
INLINE   $<reviewer LaTeX>$
DISPLAY  $$\n<reviewer LaTeX>\n$$
```

The workspace renders both current representations with its local KaTeX `0.16.47`
dependency using `trust: false`, strict errors, and caught render failures. KaTeX output
is preview-only. A successful explicit **Render current correction** action records the
exact LaTeX and derived-Markdown SHA-256 values in a render confirmation. Any subsequent
LaTeX or display-mode edit immediately discards that confirmation and both reviewer
previews.

The browser never submits Markdown as canonical authority. The owner recomputes canonical
Markdown and both hashes from the submitted reviewer LaTeX and display mode before
persisting an accepted schema-3 revision.

## Human decision request

The generated `EquationReviewDecisionRequest` contains exactly:

```ts
interface EquationReviewDecisionRequest {
  disposition: "ACCEPT_TRANSCRIPTION" | "REJECT_CANDIDATE" | "REVISION_REQUIRED";
  assistance_proposal_sha256: string | null;
  reviewer_latex: string | null;
  display_mode: "INLINE" | "DISPLAY" | null;
  render_confirmation: {
    renderer_id: string;
    renderer_version: string;
    rendered_reviewer_latex_sha256: string;
    rendered_obsidian_markdown_sha256: string;
  } | null;
  note: string;
  expected_previous_revision: number;
}
```

`ACCEPT_TRANSCRIPTION` is enabled only while the explicit render confirmation matches the
exact current reviewer LaTeX and derived Markdown. It sends both reviewer-source fields,
the displayed proposal SHA-256, and the render confirmation. Reject and revision-required
requests send null proposal, reviewer-source, and render fields. Every request sends the
owner-projected `expected_previous_revision`.

The request contains neither canonical Markdown nor a browser review timestamp. The API
creates `recorded_at_utc`, asks the owner to append the revision, and returns the
owner-stored winning schema-2 or schema-3 revision with its revision ID and status.
A semantic retry can therefore return the original winning revision and time.

A schema-2 legacy acceptance has no canonical accepted reviewer source. The UI retains it
as stored history and initializes the editable reviewer LaTeX from the current proposal;
a subsequent successful save becomes schema 3 at the next revision.

## Typed failures

The UI handles the generated `EquationReviewFailureResponse` without implying that a
write succeeded:

- HTTP 409 `EQUATION_REVIEW_PROPOSAL_STALE` — displayed assistance changed;
- HTTP 409 `EQUATION_REVIEW_EVIDENCE_STALE` — immutable evidence changed;
- HTTP 409 `EQUATION_REVIEW_REVISION_STALE` — a newer revision exists;
- HTTP 409 `EQUATION_REVIEW_RENDER_STALE` — the derived Markdown/render hash is stale;
- HTTP 409 `EQUATION_REVIEW_EDIT_AFTER_RENDER` — reviewer LaTeX changed after render;
- HTTP 409 `EQUATION_REVIEW_CONCURRENT_DECISION` — a different concurrent decision won;
- HTTP 503 `EQUATION_REVIEW_PARTIAL_OUTPUT` — owner output was partial or malformed;
- HTTP 503 `EQUATION_REVIEW_OWNER_UNAVAILABLE` — the authorized owner was unavailable.

Render-stale and edit-after-render remain visibly distinct. Conflict and unavailable
states tell the operator to reload owner-backed evidence. Only a successful decision
response displays a recorded revision ID, revision number, schema, and owner time.

## Debug and provenance

The collapsed, read-only **Debug & Provenance** pane contains only bounded API contract
fields: opaque identities and hashes, path-free source display name, detector and model
provenance, proposal method/attempt, candidate and decision statuses, current/expected
revisions, owner-stored revision ID/time, render metadata, typed error code, and a
bounded JSON projection. It excludes extracted source text, transcription bodies,
notes, filesystem paths, environment values, credentials, and secrets.
