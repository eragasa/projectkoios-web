import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  apiClient,
  type EquationDisplayMode,
  type EquationReviewCandidate,
  type EquationReviewDecisionRequest,
  type EquationReviewDecisionResponse,
  type EquationReviewDisposition,
} from "../../api/client";
import {
  EquationDebugProvenance,
  EquationPreview,
  EquationPreviewPlaceholder,
  EquationReviewHistory,
  EquationSourcePreviewRow,
  ProposedEquationSection,
} from "./EquationReviewSections";
import { deriveProposalLatexBody } from "./equationLatex";
import {
  candidateProposalDerivation,
  derivationDescription,
  derivationFailureMessages,
  EQUATION_REVIEW_DOCUMENT_ID,
  equationDecisionFailureMessage,
  equationStatusLabel,
  initialDisplayMode,
  initialReviewerLatex,
} from "./equationReviewModel";
import {
  canonicalObsidianMarkdown,
  EQUATION_RENDERER_VERSION,
} from "./equationRendering";
import { useEquationRenderConfirmation } from "./useEquationRenderConfirmation";

export function EquationCandidateWorkspace({
  candidate,
}: {
  candidate: EquationReviewCandidate;
}) {
  const queryClient = useQueryClient();
  const [reviewerLatex, setReviewerLatex] = useState(() =>
    initialReviewerLatex(candidate),
  );
  const [displayMode, setDisplayMode] = useState<EquationDisplayMode>(() =>
    initialDisplayMode(candidate),
  );
  const [note, setNote] = useState("");

  const reviewerCanonicality = deriveProposalLatexBody(reviewerLatex);
  const reviewerIsCanonical =
    reviewerCanonicality.ok && reviewerCanonicality.status === "UNWRAPPED_EXACT";
  const reviewerMarkdown = reviewerIsCanonical
    ? canonicalObsidianMarkdown(reviewerLatex, displayMode)
    : "";
  const proposal =
    candidate.assistance?.status === "PROPOSED" ? candidate.assistance : null;
  const derivedProposal = candidateProposalDerivation(candidate);
  const render = useEquationRenderConfirmation({
    reviewerLatex,
    obsidianMarkdown: reviewerMarkdown,
    displayMode,
  });

  useEffect(() => {
    setReviewerLatex(initialReviewerLatex(candidate));
    setDisplayMode(initialDisplayMode(candidate));
    setNote("");
    render.invalidate();
  }, [candidate.candidate_id, candidate.current_revision]);

  const decision = useMutation<
    EquationReviewDecisionResponse,
    unknown,
    EquationReviewDecisionRequest
  >({
    mutationFn: (request) =>
      apiClient.saveEquationReviewDecision(candidate.candidate_id, request),
    onSuccess: async () => {
      render.invalidate();
      await queryClient.invalidateQueries({
        queryKey: ["equation-reviews", EQUATION_REVIEW_DOCUMENT_ID],
      });
    },
  });

  const canAccept = Boolean(
    proposal &&
    derivedProposal?.ok &&
    reviewerIsCanonical &&
    render.isCurrent &&
    !decision.isPending,
  );

  function invalidateRender() {
    render.invalidate();
    decision.reset();
  }

  async function renderCurrentCorrection() {
    decision.reset();
    if (!derivedProposal?.ok) {
      render.reject(
        "The immutable proposal has no deterministic canonical math-body derivation. No render confirmation was created.",
      );
      return;
    }
    if (!reviewerIsCanonical) {
      render.reject(
        "Reviewer LaTeX must be an exact NFC canonical math body without delimiters, carriage returns, or edge whitespace.",
      );
      return;
    }
    await render.renderCurrent();
  }

  function submit(disposition: EquationReviewDisposition) {
    if (
      disposition === "ACCEPT_TRANSCRIPTION" &&
      (!render.rendered ||
        !render.isCurrent ||
        !proposal ||
        !derivedProposal?.ok ||
        !reviewerIsCanonical)
    ) {
      render.reject(
        "Render the exact current correction before accepting it. No decision was sent.",
      );
      return;
    }

    const isAcceptance = disposition === "ACCEPT_TRANSCRIPTION";
    decision.mutate({
      disposition,
      assistance_proposal_sha256:
        isAcceptance && proposal ? proposal.proposal_sha256 : null,
      reviewer_latex: isAcceptance ? reviewerLatex : null,
      display_mode: isAcceptance ? displayMode : null,
      render_confirmation:
        isAcceptance && render.rendered ? render.rendered.confirmation : null,
      note,
      expected_previous_revision: candidate.expected_previous_revision,
    });
  }

  const saved = decision.data;

  return (
    <article className="equation-candidate">
      <header className="equation-candidate__header">
        <div>
          <p className="eyebrow">Candidate</p>
          <h2>{candidate.candidate_id}</h2>
          <span>
            {candidate.source.source_name} · physical page{" "}
            {candidate.source.physical_page}
          </span>
        </div>
        <span className={candidate.status === "UNREVIEWED" ? "pending" : "decided"}>
          {equationStatusLabel(candidate.status)}
        </span>
      </header>

      <section className="equation-region-card" aria-labelledby="region-heading">
        <div>
          <h3 id="region-heading">Source region</h3>
          <span>Full-width evidence · {candidate.region.coordinate_space}</span>
        </div>
        <figure>
          <img
            src={apiClient.equationRegionImageUrl(candidate.candidate_id)}
            alt={`Equation region from ${candidate.source.source_name}, physical page ${candidate.source.physical_page}`}
          />
          <figcaption>
            Region image SHA-256 {candidate.region.image_sha256} · x{" "}
            {candidate.region.x}, y {candidate.region.y}, width {candidate.region.width}
            , height {candidate.region.height}
          </figcaption>
        </figure>
      </section>

      <ProposedEquationSection candidate={candidate} />

      <section
        className="equation-transcription-section equation-reviewer"
        aria-labelledby="reviewer-heading"
      >
        <header>
          <div>
            <p className="eyebrow">Human authority</p>
            <h3 id="reviewer-heading">Reviewer</h3>
          </div>
          <label className="equation-display-mode">
            <span>Display mode</span>
            <select
              aria-label="Reviewer display mode"
              disabled={decision.isPending}
              onChange={(event) => {
                invalidateRender();
                setDisplayMode(event.target.value as EquationDisplayMode);
              }}
              value={displayMode}
            >
              <option value="INLINE">Inline</option>
              <option value="DISPLAY">Display</option>
            </select>
          </label>
        </header>

        {derivedProposal && !derivedProposal.ok ? (
          <p className="equation-derivation-warning">
            Acceptance blocked: immutable proposal derivation is invalid ({" "}
            {derivedProposal.reason}:{" "}
            {derivationFailureMessages[derivedProposal.reason]}). Reject the candidate
            or request correction rather than guessing.
          </p>
        ) : null}

        <EquationSourcePreviewRow
          sourceLabel="Reviewer LaTeX"
          source={
            <textarea
              aria-label="Reviewer LaTeX"
              disabled={decision.isPending}
              onChange={(event) => {
                invalidateRender();
                setReviewerLatex(event.target.value);
              }}
              rows={7}
              spellCheck={false}
              value={reviewerLatex}
            />
          }
          previewLabel="Rendered reviewer LaTeX"
          preview={
            render.rendered && render.isCurrent ? (
              <EquationPreview
                html={render.rendered.latexHtml}
                label="Rendered reviewer LaTeX"
              />
            ) : (
              <EquationPreviewPlaceholder />
            )
          }
        />

        <EquationSourcePreviewRow
          sourceLabel="Derived reviewer Obsidian Markdown"
          source={
            <textarea
              aria-label="Derived reviewer Obsidian Markdown"
              readOnly
              rows={7}
              value={reviewerMarkdown}
            />
          }
          previewLabel="Rendered reviewer Markdown"
          preview={
            render.rendered && render.isCurrent ? (
              <EquationPreview
                html={render.rendered.markdownHtml}
                label="Rendered reviewer Markdown"
              />
            ) : (
              <EquationPreviewPlaceholder />
            )
          }
        />
        {reviewerLatex && !reviewerIsCanonical ? (
          <p className="equation-derivation-warning">
            Reviewer source is noncanonical (
            {derivationDescription(reviewerCanonicality)}). Rendering and acceptance
            remain disabled.
          </p>
        ) : null}
        <p className="equation-preview-policy">
          The browser derives canonical Markdown from reviewer LaTeX and display mode.
          It renders only a local KaTeX {EQUATION_RENDERER_VERSION} preview; the API
          owner recomputes and stores canonical Obsidian/MathJax-compatible Markdown.
        </p>

        <EquationReviewHistory candidate={candidate} />

        <label className="equation-review-note">
          <span>Reviewer note</span>
          <textarea
            disabled={decision.isPending}
            onChange={(event) => {
              decision.reset();
              setNote(event.target.value);
            }}
            rows={3}
            value={note}
          />
        </label>

        <div className="equation-review-controls">
          <button
            className="button button--secondary"
            disabled={
              !reviewerIsCanonical ||
              !derivedProposal?.ok ||
              render.isRendering ||
              decision.isPending
            }
            onClick={() => void renderCurrentCorrection()}
            type="button"
          >
            {render.isRendering ? "Rendering…" : "Render current correction"}
          </button>
          <button
            className="button button--primary"
            disabled={!canAccept}
            onClick={() => submit("ACCEPT_TRANSCRIPTION")}
            type="button"
          >
            Accept reviewed transcription
          </button>
          <button
            className="button button--secondary"
            disabled={decision.isPending}
            onClick={() => submit("REVISION_REQUIRED")}
            type="button"
          >
            Request correction
          </button>
          <button
            className="button button--secondary"
            disabled={decision.isPending}
            onClick={() => submit("REJECT_CANDIDATE")}
            type="button"
          >
            Reject candidate
          </button>
          <span>Next owner revision: {candidate.expected_previous_revision + 1}</span>
        </div>

        {render.error ? (
          <p role="alert" className="equation-render-error">
            {render.error}
          </p>
        ) : null}
        {decision.isError ? (
          <div className="equation-review-error" role="alert">
            <span className="error-message">
              {equationDecisionFailureMessage(decision.error)}
            </span>
            <button
              className="button button--secondary"
              onClick={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["equation-reviews", EQUATION_REVIEW_DOCUMENT_ID],
                })
              }
              type="button"
            >
              Reload evidence
            </button>
          </div>
        ) : null}
        {saved ? (
          <p className="equation-save-success" role="status">
            Owner recorded schema {saved.schema_version} review revision{" "}
            {saved.revision} ({saved.revision_id}) at{" "}
            <time dateTime={saved.recorded_at_utc}>{saved.recorded_at_utc}</time>.
          </p>
        ) : null}

        <EquationDebugProvenance
          candidate={candidate}
          render={render.isCurrent ? render.rendered : null}
          error={decision.error}
        />
      </section>
    </article>
  );
}
