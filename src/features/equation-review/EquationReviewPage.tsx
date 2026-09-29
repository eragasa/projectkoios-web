import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import katex from "katex";
import "katex/dist/katex.min.css";
import {
  ApiError,
  apiClient,
  type EquationDisplayMode,
  type EquationReviewCandidate,
  type EquationReviewDecisionRequest,
  type EquationReviewDecisionResponse,
  type EquationReviewDisposition,
  type EquationReviewFailureCode,
  type EquationReviewStatus,
} from "../../api/client";

const DOCUMENT_ID = "pizzi2020";
const RENDERER_ID = "katex";
const RENDERER_VERSION = "0.16.47";

type RenderedPreview = {
  reviewerLatex: string;
  obsidianMarkdown: string;
  latexHtml: string;
  markdownHtml: string;
  confirmation: NonNullable<EquationReviewDecisionRequest["render_confirmation"]>;
};

type RenderResult = { html: string; error: null } | { html: null; error: string };

function canonicalObsidianMarkdown(latex: string, displayMode: EquationDisplayMode) {
  return displayMode === "DISPLAY" ? `$$\n${latex}\n$$` : `$${latex}$`;
}

function renderWithKatex(
  latex: string,
  displayMode: EquationDisplayMode,
): RenderResult {
  try {
    return {
      html: katex.renderToString(latex, {
        displayMode: displayMode === "DISPLAY",
        output: "htmlAndMathml",
        strict: "error",
        throwOnError: true,
        trust: false,
      }),
      error: null,
    };
  } catch (error) {
    return {
      html: null,
      error:
        error instanceof Error
          ? `KaTeX could not render this source: ${error.message}`
          : "KaTeX could not render this source.",
    };
  }
}

async function sha256(value: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "Secure browser hashing is unavailable; this correction cannot be accepted.",
    );
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function decisionFailureMessage(error: unknown) {
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
    EQUATION_REVIEW_RENDER_STALE:
      "Stale render: the rendered Markdown no longer matches the canonical reviewer Markdown. The decision was not saved; render the current correction again.",
    EQUATION_REVIEW_EDIT_AFTER_RENDER:
      "Edit after render: the reviewer LaTeX changed after confirmation. The decision was not saved; render the current correction again.",
    EQUATION_REVIEW_CONCURRENT_DECISION:
      "A different concurrent decision won. This decision was not saved; reload the owner-backed revision.",
    EQUATION_REVIEW_PARTIAL_OUTPUT:
      "The owner returned partial output. The decision was not saved; reload before retrying.",
    EQUATION_REVIEW_OWNER_UNAVAILABLE:
      "The authorized review owner is unavailable. The decision was not saved.",
  };

  return (
    (error.code ? messages[error.code as EquationReviewFailureCode] : undefined) ??
    (error.status === 404
      ? `${DOCUMENT_ID} is not configured for equation review on this API.`
      : "The decision was not saved. Reload owner-backed evidence before retrying.")
  );
}

function statusLabel(status: EquationReviewStatus) {
  return status.replaceAll("_", " ").toLowerCase();
}

function initialReviewerLatex(candidate: EquationReviewCandidate) {
  if (candidate.decision?.schema_version === 3 && candidate.decision.reviewer_latex) {
    return candidate.decision.reviewer_latex;
  }
  return candidate.assistance?.status === "PROPOSED"
    ? candidate.assistance.proposed_latex
    : "";
}

function initialDisplayMode(candidate: EquationReviewCandidate): EquationDisplayMode {
  return candidate.decision?.schema_version === 3 && candidate.decision.display_mode
    ? candidate.decision.display_mode
    : candidate.display_mode;
}

function Preview({ html, label }: { html: string; label: string }) {
  return (
    <div
      aria-label={label}
      className="equation-math-preview"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function PreviewPlaceholder() {
  return (
    <div className="equation-preview-placeholder">
      Render the current correction to create this preview and its acceptance
      confirmation.
    </div>
  );
}

function ProposedSection({ candidate }: { candidate: EquationReviewCandidate }) {
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

  const latex = candidate.assistance.proposed_latex;
  const markdown = canonicalObsidianMarkdown(latex, candidate.display_mode);
  const latexPreview = renderWithKatex(latex, candidate.display_mode);
  const markdownPreview = renderWithKatex(latex, candidate.display_mode);

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

      <div className="equation-source-preview-row">
        <label>
          <span>Proposed LaTeX</span>
          <textarea aria-label="Proposed LaTeX" readOnly rows={5} value={latex} />
        </label>
        <div>
          <span>Rendered proposed LaTeX</span>
          {latexPreview.html ? (
            <Preview html={latexPreview.html} label="Rendered proposed LaTeX" />
          ) : (
            <p role="alert" className="equation-render-error">
              {latexPreview.error}
            </p>
          )}
        </div>
      </div>

      <div className="equation-source-preview-row">
        <label>
          <span>Canonical proposed Obsidian Markdown</span>
          <textarea
            aria-label="Canonical proposed Obsidian Markdown"
            readOnly
            rows={5}
            value={markdown}
          />
        </label>
        <div>
          <span>Rendered proposed Markdown</span>
          {markdownPreview.html ? (
            <Preview html={markdownPreview.html} label="Rendered proposed Markdown" />
          ) : (
            <p role="alert" className="equation-render-error">
              {markdownPreview.error}
            </p>
          )}
        </div>
      </div>
      <p className="equation-preview-policy">
        Preview only: rendered locally with KaTeX {RENDERER_VERSION}, strict errors, and
        trust disabled. The canonical Markdown above remains Obsidian/MathJax-compatible
        authority.
      </p>
    </section>
  );
}

function StoredHistory({ candidate }: { candidate: EquationReviewCandidate }) {
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
          {statusLabel(decision.status)}
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
          This legacy acceptance has no canonical accepted reviewer source. The current
          proposal initializes the reviewer LaTeX; saving creates revision{" "}
          {candidate.current_revision + 1}
          in schema 3.
        </p>
      ) : null}
    </section>
  );
}

function safeContractProjection(candidate: EquationReviewCandidate) {
  const assistance = candidate.assistance;
  const decision = candidate.decision;
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

function DebugProvenance({
  candidate,
  render,
  error,
}: {
  candidate: EquationReviewCandidate;
  render: RenderedPreview | null;
  error: unknown;
}) {
  const assistance = candidate.assistance;
  const model = assistance?.status === "PROPOSED" ? assistance.model_provenance : null;
  const errorCode = error instanceof ApiError ? error.code : null;

  return (
    <details className="equation-debug">
      <summary>Debug &amp; Provenance</summary>
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
                : `${RENDERER_ID}@${RENDERER_VERSION} · no current confirmation`}
            </dd>
          </div>
          <div>
            <dt>Latest decision error</dt>
            <dd>{errorCode ?? "None"}</dd>
          </div>
        </dl>
        <div>
          <h4>Bounded contract JSON</h4>
          <pre>{JSON.stringify(safeContractProjection(candidate), null, 2)}</pre>
        </div>
      </div>
    </details>
  );
}

function CandidateWorkspace({ candidate }: { candidate: EquationReviewCandidate }) {
  const queryClient = useQueryClient();
  const [reviewerLatex, setReviewerLatex] = useState(() =>
    initialReviewerLatex(candidate),
  );
  const [displayMode, setDisplayMode] = useState<EquationDisplayMode>(() =>
    initialDisplayMode(candidate),
  );
  const [note, setNote] = useState("");
  const [rendered, setRendered] = useState<RenderedPreview | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  const reviewerMarkdown = canonicalObsidianMarkdown(reviewerLatex, displayMode);
  const proposal =
    candidate.assistance?.status === "PROPOSED" ? candidate.assistance : null;

  useEffect(() => {
    setReviewerLatex(initialReviewerLatex(candidate));
    setDisplayMode(initialDisplayMode(candidate));
    setNote("");
    setRendered(null);
    setRenderError(null);
  }, [candidate.candidate_id, candidate.current_revision]);

  const decision = useMutation<
    EquationReviewDecisionResponse,
    unknown,
    EquationReviewDecisionRequest
  >({
    mutationFn: (request) =>
      apiClient.saveEquationReviewDecision(candidate.candidate_id, request),
    onSuccess: async () => {
      setRendered(null);
      await queryClient.invalidateQueries({
        queryKey: ["equation-reviews", DOCUMENT_ID],
      });
    },
  });

  const renderIsCurrent = Boolean(
    rendered &&
    rendered.reviewerLatex === reviewerLatex &&
    rendered.obsidianMarkdown === reviewerMarkdown,
  );
  const canAccept = Boolean(
    proposal && reviewerLatex.trim() && renderIsCurrent && !decision.isPending,
  );

  function invalidateRender() {
    setRendered(null);
    setRenderError(null);
    decision.reset();
  }

  async function renderCurrentCorrection() {
    setRendering(true);
    setRendered(null);
    setRenderError(null);
    decision.reset();
    const latexAtRender = reviewerLatex;
    const modeAtRender = displayMode;
    const markdownAtRender = canonicalObsidianMarkdown(latexAtRender, modeAtRender);
    const latexPreview = renderWithKatex(latexAtRender, modeAtRender);
    const markdownPreview = renderWithKatex(latexAtRender, modeAtRender);

    if (!latexPreview.html || !markdownPreview.html) {
      setRenderError(latexPreview.error ?? markdownPreview.error);
      setRendering(false);
      return;
    }

    try {
      const [latexHash, markdownHash] = await Promise.all([
        sha256(latexAtRender),
        sha256(markdownAtRender),
      ]);
      setRendered({
        reviewerLatex: latexAtRender,
        obsidianMarkdown: markdownAtRender,
        latexHtml: latexPreview.html,
        markdownHtml: markdownPreview.html,
        confirmation: {
          renderer_id: RENDERER_ID,
          renderer_version: RENDERER_VERSION,
          rendered_reviewer_latex_sha256: latexHash,
          rendered_obsidian_markdown_sha256: markdownHash,
        },
      });
    } catch (error) {
      setRenderError(
        error instanceof Error ? error.message : "Rendering confirmation failed.",
      );
    } finally {
      setRendering(false);
    }
  }

  function submit(disposition: EquationReviewDisposition) {
    if (
      disposition === "ACCEPT_TRANSCRIPTION" &&
      (!rendered || !renderIsCurrent || !proposal)
    ) {
      setRenderError(
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
      render_confirmation: isAcceptance && rendered ? rendered.confirmation : null,
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
          {statusLabel(candidate.status)}
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

      <ProposedSection candidate={candidate} />

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

        <div className="equation-source-preview-row">
          <label>
            <span>Reviewer LaTeX</span>
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
          </label>
          <div>
            <span>Rendered reviewer LaTeX</span>
            {rendered && renderIsCurrent ? (
              <Preview html={rendered.latexHtml} label="Rendered reviewer LaTeX" />
            ) : (
              <PreviewPlaceholder />
            )}
          </div>
        </div>

        <div className="equation-source-preview-row">
          <label>
            <span>Derived reviewer Obsidian Markdown</span>
            <textarea
              aria-label="Derived reviewer Obsidian Markdown"
              readOnly
              rows={7}
              value={reviewerMarkdown}
            />
          </label>
          <div>
            <span>Rendered reviewer Markdown</span>
            {rendered && renderIsCurrent ? (
              <Preview
                html={rendered.markdownHtml}
                label="Rendered reviewer Markdown"
              />
            ) : (
              <PreviewPlaceholder />
            )}
          </div>
        </div>
        <p className="equation-preview-policy">
          The browser derives canonical Markdown from reviewer LaTeX and display mode.
          It renders only a local KaTeX {RENDERER_VERSION} preview; the API owner
          recomputes and stores canonical Obsidian/MathJax-compatible Markdown.
        </p>

        <StoredHistory candidate={candidate} />

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
            disabled={!reviewerLatex.trim() || rendering || decision.isPending}
            onClick={() => void renderCurrentCorrection()}
            type="button"
          >
            {rendering ? "Rendering…" : "Render current correction"}
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

        {renderError ? (
          <p role="alert" className="equation-render-error">
            {renderError}
          </p>
        ) : null}
        {decision.isError ? (
          <div className="equation-review-error" role="alert">
            <span className="error-message">
              {decisionFailureMessage(decision.error)}
            </span>
            <button
              className="button button--secondary"
              onClick={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["equation-reviews", DOCUMENT_ID],
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

        <DebugProvenance
          candidate={candidate}
          render={renderIsCurrent ? rendered : null}
          error={decision.error}
        />
      </section>
    </article>
  );
}

export function EquationReviewPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["equation-reviews", DOCUMENT_ID],
    queryFn: ({ signal }) => apiClient.equationReviews(DOCUMENT_ID, signal),
    retry: false,
  });

  const candidates = useMemo(() => query.data?.items ?? [], [query.data]);
  const activeCandidate =
    candidates.find((candidate) => candidate.candidate_id === activeId) ??
    candidates[0] ??
    null;

  if (query.isLoading) {
    return <main className="page-shell">Loading equation-review evidence…</main>;
  }

  if (query.isError) {
    return (
      <main className="page-shell">
        <div className="empty-state equation-review-error" role="alert">
          <div>
            <h2>Equation review is unavailable</h2>
            <p className="error-message">{decisionFailureMessage(query.error)}</p>
          </div>
          <button
            className="button button--secondary"
            onClick={() => void query.refetch()}
            type="button"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell equation-review-page">
      <header className="review-page-header">
        <div>
          <p className="eyebrow">Control workspace</p>
          <h1>Equation review</h1>
          <p>
            Compare owner-backed source evidence, canonical assisted text, and an
            explicitly rendered human correction. Viewing or rendering never accepts a
            proposal.
          </p>
        </div>
        <div className="review-progress" aria-label="Equation review progress">
          <strong>
            {query.data?.decided ?? 0} / {query.data?.total ?? 0}
          </strong>
          <span>owner-recorded decisions</span>
          <progress max={query.data?.total || 1} value={query.data?.decided ?? 0} />
        </div>
      </header>

      {candidates.length === 0 ? (
        <div className="empty-state">
          <h2>No equation candidates</h2>
          <p>The owner returned an empty queue for {DOCUMENT_ID}.</p>
        </div>
      ) : (
        <div className="equation-review-workspace">
          <aside aria-label="Equation candidate queue">
            <h2>Candidate queue</h2>
            <ol>
              {candidates.map((candidate) => (
                <li key={candidate.candidate_id}>
                  <button
                    aria-pressed={
                      candidate.candidate_id === activeCandidate?.candidate_id
                    }
                    onClick={() => setActiveId(candidate.candidate_id)}
                    type="button"
                  >
                    <strong>{candidate.candidate_id}</strong>
                    <span>
                      Page {candidate.source.physical_page} ·{" "}
                      {statusLabel(candidate.status)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
          <main>
            {activeCandidate ? (
              <CandidateWorkspace
                key={activeCandidate.candidate_id}
                candidate={activeCandidate}
              />
            ) : null}
          </main>
        </div>
      )}
    </main>
  );
}
