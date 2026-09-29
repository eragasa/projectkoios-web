# Equation-review API contract

## Authority

The control-only Equation review workspace consumes the deterministic OpenAPI document
from `projectkoios-api` commit `5ea1128dce3e7c8d93272ff0155f2e2d81c8a72e`
(tree `4d5a8152e11c7f310421e8c59bf81579d35de68b`). Its SHA-256 is
`018039121496e5eadb4cd3d58c98179bbd894a97a9ca4370115e25eb02acb4d2`.
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

The assisted proposal is immutable source: the workspace displays its exact raw text and
owner-provided SHA-256 without trimming, normalization, or delimiter rewriting. For
preview and legacy schema-2 prefill only, the browser deterministically derives a reviewer
math body. It strips exactly one complete matching outer `$...$` or `$$...$$` pair; a
display pair may contain exactly one matching LF immediately inside both delimiters. An
already-unwrapped canonical body remains byte-for-byte exact. Empty, mixed, unmatched,
nested/double-delimited, edge-whitespace, carriage-return, non-NFC, and asymmetric
display-newline inputs are flagged and blocked rather than repaired or guessed.

The reviewer edits the derived math body and chooses `INLINE` or `DISPLAY`. The browser
deterministically derives the corresponding Obsidian/MathJax-compatible Markdown solely
for review:

```text
INLINE   $<reviewer math body>$
DISPLAY  $$\n<reviewer math body>\n$$
```

Proposed previews and proposed Markdown use only the successfully derived body, never raw
proposal delimiters. A schema-3 decision instead prepopulates its exact stored canonical
reviewer source.

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
- HTTP 409 `EQUATION_REVIEW_REVIEWER_LATEX_NONCANONICAL` — reviewer LaTeX is not the
  exact NFC math body (no delimiters, edge whitespace, or carriage returns);
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
provenance, proposal method/attempt, deterministic proposal-derivation status/reason,
candidate and decision statuses, current/expected revisions, owner-stored revision
ID/time, render metadata, typed error code, and a bounded JSON projection. It excludes
extracted source text, transcription bodies, notes, filesystem paths, environment values,
credentials, and secrets.
