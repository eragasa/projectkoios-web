import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import katex from "katex";
import { type FormEvent, useState } from "react";

import "katex/dist/katex.min.css";

import {
  apiClient,
  type CitationDecisionDisposition,
  type CitationReviewDetail,
} from "../../api/client";

const dispositionLabels: Record<CitationDecisionDisposition, string> = {
  ACCEPT_CITATION: "Accept citation",
  REJECT_CANDIDATES: "Reject candidates",
  PARTIAL_SUPPORT: "Partial support",
  CORPUS_GAP: "Corpus gap",
  NO_CITATION_REQUIRED: "No citation required",
};

const relationshipLabels: Record<string, string> = {
  DIRECT_SUPPORT: "Direct support",
  PARTIAL_SUPPORT: "Partial support",
  CORPUS_GAP: "Corpus gap",
  BACKGROUND_ONLY: "Background only",
  NO_MATCH: "No match",
  NO_EXTERNAL_CITATION_REQUIRED: "No external citation required",
};

function readableLabel(value: string): string {
  return relationshipLabels[value] ?? value.toLowerCase().replaceAll("_", " ");
}

function MathExpression({ latex, display }: { latex: string; display: boolean }) {
  const markup = katex.renderToString(latex, {
    displayMode: display,
    output: "htmlAndMathml",
    strict: false,
    throwOnError: false,
    trust: false,
  });
  return (
    <div
      className={
        display ? "math-expression math-expression--display" : "math-expression"
      }
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

function CandidateCard({
  candidate,
}: {
  candidate: CitationReviewDetail["candidates"][number];
}) {
  const [previewVisible, setPreviewVisible] = useState(false);
  const sourceUrl = apiClient.citationSourceUrl(
    candidate.file,
    candidate.physical_page,
  );

  return (
    <article className="candidate-card">
      <header>
        <div>
          <span className="candidate-rank">#{candidate.rank}</span>
          <strong>{candidate.citation_key ?? "Unmatched source"}</strong>
          {!candidate.bibtex_entry_present ? (
            <span className="missing-bib">Bibliography entry missing</span>
          ) : null}
        </div>
        <span className="score">{candidate.score.toFixed(2)}</span>
      </header>
      <blockquote>{candidate.passage}</blockquote>
      <footer>
        <span>
          {candidate.file} · physical page {candidate.physical_page}
          {candidate.printed_page !== "none"
            ? ` · printed page ${candidate.printed_page}`
            : ""}
        </span>
        <div className="source-actions">
          <button
            type="button"
            onClick={() => setPreviewVisible((visible) => !visible)}
            aria-expanded={previewVisible}
          >
            {previewVisible ? "Hide PDF page" : "Preview PDF page"}
          </button>
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            Open source at page
          </a>
        </div>
      </footer>
      {previewVisible ? (
        <div className="pdf-preview">
          <iframe
            src={sourceUrl}
            title={`${candidate.file}, physical page ${candidate.physical_page}`}
            loading="lazy"
          />
          <p>
            The PDF page is authoritative for equations and notation; extracted text
            above is retrieval context only.
          </p>
        </div>
      ) : null}
    </article>
  );
}

function DecisionForm({ review }: { review: CitationReviewDetail }) {
  const queryClient = useQueryClient();
  const [disposition, setDisposition] = useState<CitationDecisionDisposition | "">(
    review.decision?.disposition ?? "",
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    new Set(review.decision?.selected_citation_keys ?? []),
  );
  const [note, setNote] = useState(review.decision?.note ?? "");
  const decision = useMutation({
    mutationFn: () => {
      if (!disposition) {
        throw new Error("Choose a review decision before saving.");
      }
      return apiClient.saveCitationDecision(review.claim_id, {
        disposition,
        selected_citation_keys: [...selectedKeys],
        note,
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["citation-reviews"] }),
        queryClient.invalidateQueries({
          queryKey: ["citation-review", review.claim_id],
        }),
      ]);
    },
  });

  const needsCitation =
    disposition === "ACCEPT_CITATION" || disposition === "PARTIAL_SUPPORT";
  const canSave = Boolean(disposition) && (!needsCitation || selectedKeys.size > 0);

  function chooseDisposition(next: CitationDecisionDisposition) {
    setDisposition(next);
    if (next !== "ACCEPT_CITATION" && next !== "PARTIAL_SUPPORT") {
      setSelectedKeys(new Set());
    }
    decision.reset();
  }

  function toggleCitation(key: string) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    decision.reset();
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSave) {
      decision.mutate();
    }
  }

  return (
    <form className="review-decision" onSubmit={submit}>
      <div className="review-section-heading">
        <div>
          <p className="eyebrow">Human disposition</p>
          <h2>Record a decision</h2>
        </div>
        {review.decision ? (
          <span className="revision-badge">Revision {review.decision.revision}</span>
        ) : null}
      </div>

      <fieldset className="decision-options">
        <legend>Review outcome</legend>
        {(
          Object.entries(dispositionLabels) as [CitationDecisionDisposition, string][]
        ).map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name="disposition"
              value={value}
              checked={disposition === value}
              onChange={() => chooseDisposition(value)}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>

      {needsCitation ? (
        <fieldset className="citation-selection">
          <legend>Select the citation keys supported by your review</legend>
          {review.candidates.some((candidate) => candidate.citation_key) ? (
            review.candidates.map((candidate) =>
              candidate.citation_key ? (
                <label key={`${candidate.passage_id}-choice`}>
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(candidate.citation_key)}
                    onChange={() => toggleCitation(candidate.citation_key!)}
                  />
                  <code>{candidate.citation_key}</code>
                  {!candidate.bibtex_entry_present ? (
                    <small>Bibliography entry missing</small>
                  ) : null}
                </label>
              ) : null,
            )
          ) : (
            <p>No citation keys are available among these candidates.</p>
          )}
        </fieldset>
      ) : null}

      <label className="review-note">
        <span>Reviewer note</span>
        <textarea
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            decision.reset();
          }}
          maxLength={4000}
          rows={4}
          placeholder="Explain the evidence check or remaining concern."
        />
      </label>

      <div className="decision-footer">
        <p>
          Saving records a private review decision. It does not edit the manuscript.
        </p>
        <button
          className="button button--primary"
          type="submit"
          disabled={!canSave || decision.isPending}
        >
          {decision.isPending ? "Saving…" : "Save review decision"}
        </button>
      </div>
      <div className="decision-status" aria-live="polite">
        {decision.isSuccess ? <p>Decision saved privately.</p> : null}
        {decision.isError ? (
          <p className="error-message">
            {decision.error instanceof Error
              ? decision.error.message
              : "The decision could not be saved."}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function ReviewWorkspace({ claimId }: { claimId: string }) {
  const review = useQuery({
    queryKey: ["citation-review", claimId],
    queryFn: ({ signal }) => apiClient.citationReview(claimId, signal),
  });

  if (review.isPending) {
    return <div className="review-loading">Loading claim evidence…</div>;
  }
  if (review.isError) {
    return (
      <div className="empty-state">
        <h2>Claim evidence unavailable</h2>
        <p>Confirm that the local Project Koios API is running.</p>
      </div>
    );
  }

  const item = review.data;
  return (
    <article className="review-workspace">
      <header className="claim-header">
        <div className="claim-meta">
          <span>{item.claim_id}</span>
          <span>Appendix G, lines {item.lines}</span>
          <span
            className={`relationship relationship--${item.recommendation_relationship.toLowerCase()}`}
          >
            {readableLabel(item.recommendation_relationship)}
          </span>
        </div>
        <h2>{item.claim}</h2>
        <details>
          <summary>Retrieval query and benchmark expectation</summary>
          <dl className="claim-diagnostics">
            <div>
              <dt>Query</dt>
              <dd>{item.query}</dd>
            </div>
            <div>
              <dt>Expected keys</dt>
              <dd>{item.expected_keys.join(", ") || "None"}</dd>
            </div>
            <div>
              <dt>Retrieval status</dt>
              <dd>{readableLabel(item.evaluation_status)}</dd>
            </div>
          </dl>
        </details>
      </header>

      <section className="manuscript-context">
        <div className="review-section-heading">
          <div>
            <p className="eyebrow">Manuscript context</p>
            <h2>Equations in the reviewed passage</h2>
          </div>
          <span>{item.manuscript_equations.length} expressions</span>
        </div>
        {item.manuscript_equations.length ? (
          <div className="manuscript-equations">
            {item.manuscript_equations.map((equation, index) => (
              <MathExpression
                key={`${item.claim_id}-equation-${index}`}
                latex={equation.latex}
                display={equation.display}
              />
            ))}
          </div>
        ) : (
          <p className="no-equations">
            This claim range contains no explicit TeX math delimiters.
          </p>
        )}
        <details className="latex-source">
          <summary>Show exact manuscript TeX excerpt</summary>
          <pre>{item.manuscript_excerpt_latex}</pre>
        </details>
      </section>

      <section className="review-recommendation">
        <p className="eyebrow">Automated recommendation — unverified</p>
        <p>{item.recommendation}</p>
        {item.recommended_keys.length ? (
          <div className="recommended-keys">
            {item.recommended_keys.map((key) => (
              <code key={key}>{key}</code>
            ))}
          </div>
        ) : null}
      </section>

      <section className="candidate-section">
        <div className="review-section-heading">
          <div>
            <p className="eyebrow">Reference-only retrieval</p>
            <h2>Candidate evidence</h2>
          </div>
          <span>{item.candidates.length} passages</span>
        </div>
        {item.candidates.length ? (
          <div className="candidate-list">
            {item.candidates.map((candidate) => (
              <CandidateCard candidate={candidate} key={candidate.passage_id} />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No candidate passages</h3>
            <p>The current reference corpus did not supply evidence for this claim.</p>
          </div>
        )}
      </section>

      <DecisionForm review={item} />
    </article>
  );
}

export function CitationReviewPage() {
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const queue = useQuery({
    queryKey: ["citation-reviews"],
    queryFn: ({ signal }) => apiClient.citationReviews(signal),
  });

  if (queue.isPending) {
    return <div className="review-loading">Loading citation review queue…</div>;
  }
  if (queue.isError) {
    return (
      <div className="citation-review-page">
        <header className="section-heading">
          <p className="eyebrow">Citation review</p>
          <h1>Review queue unavailable</h1>
          <p>
            Start the configured Project Koios API and confirm that a private review
            bundle is installed.
          </p>
        </header>
      </div>
    );
  }

  const firstPending = queue.data.items.find((item) => !item.decision);
  const activeClaimId =
    selectedClaimId ?? firstPending?.claim_id ?? queue.data.items[0]?.claim_id;

  return (
    <div className="citation-review-page">
      <header className="review-page-header">
        <div>
          <p className="eyebrow">Human review required</p>
          <h1>Citation evidence queue</h1>
          <p>
            Inspect reference passages and record a disposition. Automated findings
            remain unverified until you save a decision.
          </p>
        </div>
        <div className="review-progress" aria-label="Review progress">
          <strong>
            {queue.data.decided}/{queue.data.total}
          </strong>
          <span>claims reviewed</span>
          <progress value={queue.data.decided} max={queue.data.total} />
        </div>
      </header>

      <div className="review-integrity-banner">
        <strong>{queue.data.assessment}</strong>
        <span>
          Manuscript SHA-256 <code>{queue.data.manuscript_sha256}</code>
        </span>
      </div>

      <div className="review-layout">
        <aside className="claim-queue" aria-label="Citation claims">
          {queue.data.items.map((item) => (
            <button
              key={item.claim_id}
              className={item.claim_id === activeClaimId ? "active" : ""}
              type="button"
              onClick={() => setSelectedClaimId(item.claim_id)}
            >
              <span className="queue-item-meta">
                <code>{item.claim_id}</code>
                <span
                  className={item.decision ? "queue-status decided" : "queue-status"}
                >
                  {item.decision ? "Reviewed" : "Pending"}
                </span>
              </span>
              <strong>{item.claim}</strong>
              <small>{readableLabel(item.recommendation_relationship)}</small>
            </button>
          ))}
        </aside>

        <div className="review-main">
          {activeClaimId ? (
            <ReviewWorkspace key={activeClaimId} claimId={activeClaimId} />
          ) : (
            <div className="empty-state">
              <h2>No claims in this review bundle</h2>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
