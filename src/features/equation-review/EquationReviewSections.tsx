import type { ReactNode } from "react";
import { ApiError, type EquationReviewCandidate } from "../../api/client";
import { BoundedJsonView, DisclosurePanel } from "../../components/DisclosurePanel";
import { KatexMarkup } from "../../components/KatexMarkup";
import {
  candidateProposalDerivation,
  derivationDescription,
  derivationFailureMessages,
  equationStatusLabel,
} from "./equationReviewModel";
import {
  canonicalObsidianMarkdown,
  EQUATION_RENDERER_ID,
  EQUATION_RENDERER_VERSION,
  renderEquationWithKatex,
  type RenderedEquationPreview,
} from "./equationRendering";
import { deriveProposalLatexBody } from "./equationLatex";

export function EquationPreview({ html, label }: { html: string; label: string }) {
  return <KatexMarkup className="equation-math-preview" html={html} label={label} />;
}

export function EquationPreviewPlaceholder() {
  return (
    <div className="equation-preview-placeholder">
      Render the current correction to create this preview and its acceptance
      confirmation.
    </div>
  );
}

export function EquationSourcePreviewRow({
  sourceLabel,
  source,
  sourceFooter,
  previewLabel,
  preview,
}: {
  sourceLabel: string;
  source: ReactNode;
  sourceFooter?: ReactNode;
  previewLabel: string;
  preview: ReactNode;
}) {
  return (
    <div className="equation-source-preview-row">
      <div className="equation-source-panel">
        <span>{sourceLabel}</span>
        {source}
        {sourceFooter}
      </div>
      <div>
        <span>{previewLabel}</span>
        {preview}
      </div>
    </div>
  );
}

export function ProposedEquationSection({
  candidate,
}: {
  candidate: EquationReviewCandidate;
}) {
  if (candidate.assistance?.status !== "PROPOSED") {
    return (
      <section
        className="equation-transcription-section"
        aria-labelledby="proposed-heading"
      >
        <header>
          <div>
            <p className="eyebrow">Assisted output</p>
            <h3 id="proposed-heading">Proposed</h3>
          </div>
          <span className="pending">No proposal available</span>
        </header>
        <p className="equation-section-empty">
          Assistance is {candidate.assistance?.status.toLowerCase() ?? "unavailable"}.
          There is no transcription to accept.
        </p>
      </section>
    );
  }

  const rawLatex = candidate.assistance.proposed_latex;
  const derivation = deriveProposalLatexBody(rawLatex);
  const derivedBody = derivation.ok ? derivation.body : null;
  const markdown = derivedBody
    ? canonicalObsidianMarkdown(derivedBody, candidate.display_mode)
    : null;
  const latexPreview = derivedBody
    ? renderEquationWithKatex(derivedBody, candidate.display_mode)
    : null;
  const markdownPreview = derivedBody
    ? renderEquationWithKatex(derivedBody, candidate.display_mode)
    : null;

  return (
    <section
      className="equation-transcription-section"
      aria-labelledby="proposed-heading"
    >
      <header>
        <div>
          <p className="eyebrow">Assisted output</p>
          <h3 id="proposed-heading">Proposed</h3>
        </div>
        <span className="proposal-warning">Unaccepted assisted proposal</span>
      </header>

      <EquationSourcePreviewRow
        sourceLabel="Raw immutable assisted proposal LaTeX"
        source={
          <pre aria-label="Proposed LaTeX" className="equation-source-code">
            {rawLatex}
          </pre>
        }
        sourceFooter={
          <small className="equation-raw-proposal-hash">
            Raw immutable source · proposal SHA-256{" "}
            {candidate.assistance.proposal_sha256}
          </small>
        }
        previewLabel="Rendered proposed LaTeX body"
        preview={
          latexPreview?.html ? (
            <EquationPreview html={latexPreview.html} label="Rendered proposed LaTeX" />
          ) : (
            <p role="alert" className="equation-render-error">
              {derivation.ok
                ? latexPreview?.error
                : `Proposal derivation rejected: ${derivationFailureMessages[derivation.reason]}.`}
            </p>
          )
        }
      />

      <EquationSourcePreviewRow
        sourceLabel="Derived proposed Obsidian Markdown"
        source={
          <textarea
            aria-label="Canonical proposed Obsidian Markdown"
            readOnly
            rows={5}
            value={markdown ?? ""}
          />
        }
        previewLabel="Rendered proposed Markdown body"
        preview={
          markdownPreview?.html ? (
            <EquationPreview
              html={markdownPreview.html}
              label="Rendered proposed Markdown"
            />
          ) : (
            <p role="alert" className="equation-render-error">
              {derivation.ok
                ? markdownPreview?.error
                : "No proposed Markdown or preview was derived from noncanonical source."}
            </p>
          )
        }
      />
      <p className="equation-preview-policy">
        Derivation: {derivationDescription(derivation)}. The immutable source above is
        never rewritten. Preview only: rendered locally from the derived math body with
        KaTeX {EQUATION_RENDERER_VERSION}, strict errors, and trust disabled. The
        derived Markdown remains Obsidian/MathJax-compatible.
      </p>
    </section>
  );
}

export function EquationReviewHistory({
  candidate,
}: {
  candidate: EquationReviewCandidate;
}) {
  const decision = candidate.decision;
  if (!decision) {
    return (
      <section className="equation-review-history" aria-labelledby="history-heading">
        <h4 id="history-heading">Stored review history</h4>
        <p>No stored human revision.</p>
      </section>
    );
  }

  return (
    <section className="equation-review-history" aria-labelledby="history-heading">
      <div>
        <h4 id="history-heading">Stored review history</h4>
        <span>
          Schema {decision.schema_version} · revision {decision.revision} ·{" "}
          {equationStatusLabel(decision.status)}
        </span>
      </div>
      <dl>
        <div>
          <dt>Revision ID</dt>
          <dd>{decision.revision_id}</dd>
        </div>
        <div>
          <dt>Owner recorded</dt>
          <dd>
            <time dateTime={decision.recorded_at_utc}>{decision.recorded_at_utc}</time>
          </dd>
        </div>
        <div>
          <dt>Disposition</dt>
          <dd>{decision.disposition}</dd>
        </div>
        <div>
          <dt>Note</dt>
          <dd>{decision.note || "No note"}</dd>
        </div>
      </dl>
      {decision.schema_version === 2 ? (
        <p>
          This legacy acceptance has no canonical accepted reviewer source. The
          deterministically derived proposal body initializes the reviewer LaTeX; saving
          creates revision {candidate.current_revision + 1}
          in schema 3.
        </p>
      ) : null}
    </section>
  );
}

function safeContractProjection(candidate: EquationReviewCandidate) {
  const assistance = candidate.assistance;
  const decision = candidate.decision;
  const derivation = candidateProposalDerivation(candidate);
  return {
    candidate_id: candidate.candidate_id,
    document_id: candidate.source.document_id,
    source_name: candidate.source.source_name,
    source_sha256: candidate.source.source_sha256,
    region: {
      coordinate_space: candidate.region.coordinate_space,
      physical_page: candidate.source.physical_page,
      image_sha256: candidate.region.image_sha256,
    },
    deterministic_evidence: {
      detector: candidate.deterministic_evidence.detector,
      detector_version: candidate.deterministic_evidence.detector_version,
      evidence_sha256: candidate.deterministic_evidence.evidence_sha256,
    },
    assistance:
      assistance?.status === "PROPOSED"
        ? {
            status: assistance.status,
            method: assistance.method,
            proposal_sha256: assistance.proposal_sha256,
            attempt_id: assistance.attempt_id ?? null,
            model_provenance: assistance.model_provenance ?? null,
          }
        : assistance,
    proposal_derivation: derivation
      ? { status: derivation.status, reason: derivation.reason }
      : null,
    display_mode: candidate.display_mode,
    status: candidate.status,
    current_revision: candidate.current_revision,
    expected_previous_revision: candidate.expected_previous_revision,
    decision: decision
      ? {
          schema_version: decision.schema_version,
          status: decision.status,
          disposition: decision.disposition,
          revision: decision.revision,
          revision_id: decision.revision_id,
          recorded_at_utc: decision.recorded_at_utc,
          reviewer_latex_sha256: decision.reviewer_latex_sha256,
          obsidian_markdown_sha256: decision.obsidian_markdown_sha256,
          render_confirmation: decision.render_confirmation,
        }
      : null,
  };
}

export function EquationDebugProvenance({
  candidate,
  render,
  error,
}: {
  candidate: EquationReviewCandidate;
  render: RenderedEquationPreview | null;
  error: unknown;
}) {
  const assistance = candidate.assistance;
  const model = assistance?.status === "PROPOSED" ? assistance.model_provenance : null;
  const derivation = candidateProposalDerivation(candidate);
  const errorCode = error instanceof ApiError ? error.code : null;

  return (
    <DisclosurePanel className="equation-debug" summary="Debug & Provenance">
      <div className="equation-debug__content">
        <dl>
          <div>
            <dt>Candidate / document</dt>
            <dd>
              {candidate.candidate_id} · {candidate.source.document_id}
            </dd>
          </div>
          <div>
            <dt>Source</dt>
            <dd>
              {candidate.source.source_name} · SHA-256 {candidate.source.source_sha256}
            </dd>
          </div>
          <div>
            <dt>Evidence</dt>
            <dd>
              {candidate.deterministic_evidence.detector}@
              {candidate.deterministic_evidence.detector_version} · SHA-256{" "}
              {candidate.deterministic_evidence.evidence_sha256}
            </dd>
          </div>
          <div>
            <dt>Proposal</dt>
            <dd>
              {assistance?.status === "PROPOSED"
                ? `${assistance.method} · SHA-256 ${assistance.proposal_sha256}`
                : (assistance?.status ?? "UNAVAILABLE")}
            </dd>
          </div>
          {assistance?.status === "PROPOSED" && assistance.attempt_id ? (
            <div>
              <dt>Attempt</dt>
              <dd>{assistance.attempt_id}</dd>
            </div>
          ) : null}
          {model ? (
            <>
              <div>
                <dt>Model</dt>
                <dd>
                  {model.model_name} · SHA-256 {model.model_sha256}
                </dd>
              </div>
              <div>
                <dt>Prompt / request / result</dt>
                <dd>
                  {model.prompt_version} · {model.request_id} · {model.result_id}
                </dd>
              </div>
            </>
          ) : null}
          <div>
            <dt>Proposal derivation</dt>
            <dd>{derivation ? derivationDescription(derivation) : "NOT_AVAILABLE"}</dd>
          </div>
          <div>
            <dt>Candidate / decision status</dt>
            <dd>
              {candidate.status} · {candidate.decision?.status ?? "NO_DECISION"}
            </dd>
          </div>
          <div>
            <dt>Revisions</dt>
            <dd>
              current {candidate.current_revision} · expected previous{" "}
              {candidate.expected_previous_revision} · stored{" "}
              {candidate.decision?.revision ?? "none"}
            </dd>
          </div>
          <div>
            <dt>Stored revision</dt>
            <dd>
              {candidate.decision
                ? `${candidate.decision.revision_id} · ${candidate.decision.recorded_at_utc}`
                : "None"}
            </dd>
          </div>
          <div>
            <dt>Current renderer</dt>
            <dd>
              {render
                ? `${render.confirmation.renderer_id}@${render.confirmation.renderer_version} · LaTeX ${render.confirmation.rendered_reviewer_latex_sha256} · Markdown ${render.confirmation.rendered_obsidian_markdown_sha256}`
                : `${EQUATION_RENDERER_ID}@${EQUATION_RENDERER_VERSION} · no current confirmation`}
            </dd>
          </div>
          <div>
            <dt>Latest decision error</dt>
            <dd>{errorCode ?? "None"}</dd>
          </div>
        </dl>
        <div>
          <h4>Bounded contract JSON</h4>
          <BoundedJsonView value={safeContractProjection(candidate)} />
        </div>
      </div>
    </DisclosurePanel>
  );
}
