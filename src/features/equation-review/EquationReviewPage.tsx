import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api/client";
import { ReviewPageHeader, ReviewProgress } from "../../components/ReviewPageHeader";
import { EquationCandidateWorkspace } from "./EquationCandidateWorkspace";
import {
  EQUATION_REVIEW_DOCUMENT_ID,
  equationDecisionFailureMessage,
  equationStatusLabel,
} from "./equationReviewModel";

export function EquationReviewPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["equation-reviews", EQUATION_REVIEW_DOCUMENT_ID],
    queryFn: ({ signal }) =>
      apiClient.equationReviews(EQUATION_REVIEW_DOCUMENT_ID, signal),
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
            <p className="error-message">
              {equationDecisionFailureMessage(query.error)}
            </p>
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
      <ReviewPageHeader
        eyebrow="Control workspace"
        title="Equation review"
        description="Compare owner-backed source evidence, canonical assisted text, and an explicitly rendered human correction. Viewing or rendering never accepts a proposal."
        aside={
          <ReviewProgress
            ariaLabel="Equation review progress"
            current={query.data?.decided ?? 0}
            total={query.data?.total ?? 0}
            summary="owner-recorded decisions"
            separator=" / "
          />
        }
      />

      {candidates.length === 0 ? (
        <div className="empty-state">
          <h2>No equation candidates</h2>
          <p>The owner returned an empty queue for {EQUATION_REVIEW_DOCUMENT_ID}.</p>
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
                      {equationStatusLabel(candidate.status)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
          <main>
            {activeCandidate ? (
              <EquationCandidateWorkspace
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
