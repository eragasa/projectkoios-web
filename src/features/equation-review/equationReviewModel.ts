import {
  ApiError,
  type EquationDisplayMode,
  type EquationReviewCandidate,
  type EquationReviewFailureCode,
  type EquationReviewStatus,
} from "../../api/client";
import {
  deriveProposalLatexBody,
  type ProposalLatexDerivation,
  type ProposalLatexDerivationFailure,
} from "./equationLatex";

export const EQUATION_REVIEW_DOCUMENT_ID = "pizzi2020";

export const derivationFailureMessages: Record<ProposalLatexDerivationFailure, string> =
  {
    EMPTY: "the source or derived math body is empty",
    EDGE_WHITESPACE: "the source or derived math body has edge whitespace",
    CARRIAGE_RETURN: "the source contains a carriage return",
    NON_NFC: "the source is not NFC-normalized",
    MIXED_DELIMITERS: "the outer math delimiters are mixed",
    UNMATCHED_DELIMITER: "an outer math delimiter is unmatched",
    NESTED_OR_INTERNAL_DELIMITER:
      "the math body contains nested or internal delimiters",
    NONCANONICAL_DISPLAY_NEWLINE:
      "display delimiters do not contain the canonical matching line feeds",
  };

export function equationDecisionFailureMessage(error: unknown) {
  if (!(error instanceof ApiError)) {
    return "The decision was not saved. Reload owner-backed evidence before retrying.";
  }

  const messages: Partial<Record<EquationReviewFailureCode, string>> = {
    EQUATION_REVIEW_PROPOSAL_STALE:
      "The assisted proposal changed. The decision was not saved; reload owner-backed evidence.",
    EQUATION_REVIEW_EVIDENCE_STALE:
      "The equation evidence changed. The decision was not saved; reload owner-backed evidence.",
    EQUATION_REVIEW_REVISION_STALE:
      "A newer human revision exists. The decision was not saved; reload before reviewing again.",
    EQUATION_REVIEW_REVIEWER_LATEX_NONCANONICAL:
      "The reviewer LaTeX is not a canonical NFC math body. The decision was not saved; remove delimiters, edge whitespace, or carriage returns and render again.",
    EQUATION_REVIEW_RENDER_STALE:
      "Stale render: the rendered Markdown no longer matches the canonical reviewer Markdown. The decision was not saved; render the current correction again.",
    EQUATION_REVIEW_EDIT_AFTER_RENDER:
      "Edit after render: the reviewer LaTeX changed after confirmation. The decision was not saved; render the current correction again.",
    EQUATION_REVIEW_CONCURRENT_DECISION:
      "A different concurrent decision won. This decision was not saved; reload the owner-backed revision.",
    EQUATION_REVIEW_PARTIAL_OUTPUT:
      "The owner returned partial output. The decision was not saved; reload before retrying.",
    EQUATION_REVIEW_QUEUE_INCOMPLETE:
      "The owner queue is incomplete. No review state was loaded; retry after the owner publishes a complete queue.",
    EQUATION_REVIEW_QUEUE_MALFORMED:
      "The owner queue is malformed. No review state was loaded; the queue must be repaired before review.",
    EQUATION_REVIEW_OWNER_UNAVAILABLE:
      "The authorized review owner is unavailable. The decision was not saved.",
  };

  return (
    (error.code ? messages[error.code as EquationReviewFailureCode] : undefined) ??
    (error.status === 404
      ? `${EQUATION_REVIEW_DOCUMENT_ID} is not configured for equation review on this API.`
      : "The decision was not saved. Reload owner-backed evidence before retrying.")
  );
}

export function equationStatusLabel(status: EquationReviewStatus) {
  return status.replaceAll("_", " ").toLowerCase();
}

export function candidateProposalDerivation(candidate: EquationReviewCandidate) {
  return candidate.assistance.status === "AUTOMATED_UNREVIEWED"
    ? deriveProposalLatexBody(candidate.assistance.proposed_latex)
    : null;
}

export function initialReviewerLatex(candidate: EquationReviewCandidate) {
  if (candidate.decision?.schema_version === 3 && candidate.decision.reviewer_latex) {
    return candidate.decision.reviewer_latex;
  }
  const derivation = candidateProposalDerivation(candidate);
  return derivation?.ok ? derivation.body : "";
}

export function initialDisplayMode(
  candidate: EquationReviewCandidate,
): EquationDisplayMode {
  return candidate.decision?.schema_version === 3 && candidate.decision.display_mode
    ? candidate.decision.display_mode
    : candidate.display_mode;
}

export function equationSourceLabel(candidate: EquationReviewCandidate) {
  return candidate.deterministic_evidence.source_label ?? candidate.source.document_id;
}

export interface EquationReviewQueueContext {
  contractId: string;
  schemaVersion: number;
  projectionId: string;
  packageId: string;
  sourceSha256: string;
  total: number;
  decided: number;
  pending: number;
  currentIndex: number;
}

export function derivationDescription(derivation: ProposalLatexDerivation) {
  if (derivation.ok) {
    return derivation.status;
  }
  return `INVALID · ${derivation.reason} · ${derivationFailureMessages[derivation.reason]}`;
}
