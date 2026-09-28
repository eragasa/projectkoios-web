# Provisional equation-review API contract

## Status

This is the minimal browser-side contract needed by the control-only Equation review
workspace. It is **not implemented by the current `projectkoios-api` OpenAPI document**.
The API-owning repository must adopt or revise it before the workspace can show live
corpus data. The browser does not fall back to filesystem or corpus access.

## Endpoints

```text
GET /equation-reviews?document_id=pizzi2020
GET /equation-reviews/{candidate_id}/region
PUT /equation-reviews/{candidate_id}/decision
```

The queue endpoint returns `application/json`:

```ts
interface EquationReviewQueueResponse {
  document_id: string;
  total: number;
  decided: number;
  items: EquationReviewCandidate[];
}

interface EquationReviewCandidate {
  candidate_id: string;
  source: {
    document_id: string;
    source_name: string;
    source_sha256: string;
    physical_page: number;
  };
  region: {
    coordinate_space: "PDF_POINTS";
    x: number;
    y: number;
    width: number;
    height: number;
    image_sha256: string;
  };
  deterministic_evidence: {
    detector: string;
    detector_version: string;
    evidence_sha256: string;
    extracted_text: string | null;
  };
  assistance:
    | null
    | {
        status: "PENDING" | "FAILED";
        method: string | null;
        proposal_sha256: null;
        proposed_latex: null;
      }
    | {
        status: "PROPOSED";
        method: string;
        proposal_sha256: string;
        proposed_latex: string;
      };
  decision: EquationReviewDecision | null;
}
```

The region endpoint returns the image represented by `region.image_sha256`. The API
must authorize the candidate, bind it to the stated source region, and set an
appropriate image content type. The browser never supplies a source path.

The decision endpoint accepts:

```ts
interface EquationReviewDecisionRequest {
  disposition: "ACCEPT_TRANSCRIPTION" | "REJECT_CANDIDATE" | "REVISION_REQUIRED";
  assistance_proposal_sha256: string | null;
  note: string;
}
```

It returns the stored decision plus `candidate_id`, `revision`, and `updated_at_utc`.
`ACCEPT_TRANSCRIPTION` must identify the exact assisted proposal with
`assistance_proposal_sha256`; retrieving or displaying assisted text never accepts it.
The API owns validation, persistence, authorization, and concurrency policy.

The provisional TypeScript projection is in
`src/api/equationReviewContract.ts`. Once the API publishes an authoritative OpenAPI
schema, regenerate `src/api/schema.generated.ts`, replace the provisional projection,
and run the existing UI contract tests against the adopted response.
