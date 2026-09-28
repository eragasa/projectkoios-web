// Provisional browser-owned boundary for an API capability that is not yet implemented.
// The projectkoios-api OpenAPI document remains authoritative once it adopts a contract.

export type EquationReviewDisposition =
  "ACCEPT_TRANSCRIPTION" | "REJECT_CANDIDATE" | "REVISION_REQUIRED";

export interface EquationSourceIdentity {
  document_id: string;
  source_name: string;
  source_sha256: string;
  physical_page: number;
}

export interface EquationRegionEvidence {
  coordinate_space: "PDF_POINTS";
  x: number;
  y: number;
  width: number;
  height: number;
  image_sha256: string;
}

export interface DeterministicEquationEvidence {
  detector: string;
  detector_version: string;
  evidence_sha256: string;
  extracted_text: string | null;
}

export type AssistedEquationProposal =
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

export interface EquationReviewDecision {
  disposition: EquationReviewDisposition;
  assistance_proposal_sha256: string | null;
  note: string;
  revision: number;
  updated_at_utc: string;
}

export interface EquationReviewCandidate {
  candidate_id: string;
  source: EquationSourceIdentity;
  region: EquationRegionEvidence;
  deterministic_evidence: DeterministicEquationEvidence;
  assistance: AssistedEquationProposal | null;
  decision: EquationReviewDecision | null;
}

export interface EquationReviewQueueResponse {
  document_id: string;
  total: number;
  decided: number;
  items: EquationReviewCandidate[];
}

export interface EquationReviewDecisionRequest {
  disposition: EquationReviewDisposition;
  assistance_proposal_sha256: string | null;
  note: string;
}

export interface EquationReviewDecisionResponse extends EquationReviewDecision {
  candidate_id: string;
}
