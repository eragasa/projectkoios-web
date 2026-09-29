import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { ReviewPageHeader, ReviewProgress } from "../../components/ReviewPageHeader";
import {
  EquationCandidateWorkspace,
  type EquationCandidateDraftState,
} from "./EquationCandidateWorkspace";
import {
  EQUATION_REVIEW_DOCUMENT_ID,
  equationDecisionFailureMessage,
  equationStatusLabel,
  type EquationReviewQueueContext,
} from "./equationReviewModel";

const MAX_EQUATION_REVIEW_CANDIDATES = 256;

interface CandidateNavigationState extends EquationCandidateDraftState {
  candidateId: string;
}

export function EquationReviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("candidate");
  const [navigationState, setNavigationState] =
    useState<CandidateNavigationState | null>(null);
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["equation-reviews", EQUATION_REVIEW_DOCUMENT_ID],
    queryFn: ({ signal }) =>
      apiClient.equationReviews(EQUATION_REVIEW_DOCUMENT_ID, signal),
    retry: false,
  });

  const candidates = useMemo(() => query.data?.items ?? [], [query.data]);
  const selectedIndex = selectedId
    ? candidates.findIndex((candidate) => candidate.candidate_id === selectedId)
    : -1;
  const activeIndex = selectedIndex >= 0 ? selectedIndex : candidates.length ? 0 : -1;
  const activeCandidate = activeIndex >= 0 ? candidates[activeIndex] : null;
  const queueExceedsBound =
    candidates.length > MAX_EQUATION_REVIEW_CANDIDATES ||
    (query.data?.total ?? 0) > MAX_EQUATION_REVIEW_CANDIDATES;

  const setSelectedCandidate = useCallback(
    (candidateId: string) => {
      const next = new URLSearchParams(searchParams);
      next.set("candidate", candidateId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (!queueExceedsBound && activeCandidate && selectedIndex < 0) {
      setSelectedCandidate(activeCandidate.candidate_id);
    }
  }, [activeCandidate, queueExceedsBound, selectedIndex, setSelectedCandidate]);

  useEffect(() => {
    setNavigationState(null);
    setPendingCandidateId(null);
  }, [activeCandidate?.candidate_id]);

  const handleDraftStateChange = useCallback(
    (state: EquationCandidateDraftState) => {
      if (!activeCandidate) return;
      setNavigationState((current) => {
        if (
          current?.candidateId === activeCandidate.candidate_id &&
          current.dirty === state.dirty &&
          current.busy === state.busy
        ) {
          return current;
        }
        return { candidateId: activeCandidate.candidate_id, ...state };
      });
    },
    [activeCandidate],
  );

  const activeNavigationState =
    navigationState?.candidateId === activeCandidate?.candidate_id
      ? navigationState
      : null;
  const hasUnsavedDraft = activeNavigationState?.dirty ?? false;
  const saveInProgress = activeNavigationState?.busy ?? false;

  useEffect(() => {
    if (!hasUnsavedDraft) return;
    const guardUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guardUnload);
    return () => window.removeEventListener("beforeunload", guardUnload);
  }, [hasUnsavedDraft]);

  function requestCandidate(candidateId: string) {
    if (candidateId === activeCandidate?.candidate_id || saveInProgress) return;
    if (hasUnsavedDraft) {
      setPendingCandidateId(candidateId);
      return;
    }
    setSelectedCandidate(candidateId);
  }

  function discardAndNavigate() {
    if (!pendingCandidateId) return;
    const candidateId = pendingCandidateId;
    setNavigationState(null);
    setPendingCandidateId(null);
    setSelectedCandidate(candidateId);
  }

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

  const queue = query.data;
  const queueContext: EquationReviewQueueContext | null = queue
    ? {
        contractId: queue.contract_id,
        schemaVersion: queue.schema_version,
        projectionId: queue.projection_id,
        packageId: queue.package_id,
        sourceSha256: queue.source_sha256,
        total: queue.total,
        decided: queue.decided,
        pending: queue.pending,
        currentIndex: activeIndex,
      }
    : null;
  const previousCandidate = activeIndex > 0 ? candidates[activeIndex - 1] : null;
  const nextCandidate =
    activeIndex >= 0 && activeIndex < candidates.length - 1
      ? candidates[activeIndex + 1]
      : null;

  return (
    <main className="page-shell equation-review-page">
      <ReviewPageHeader
        eyebrow="Control workspace"
        title="Equation review"
        description="Compare owner-backed source evidence, canonical assisted text, and an explicitly rendered human correction. Viewing or rendering never accepts a proposal."
        aside={
          <div className="equation-queue-progress">
            <ReviewProgress
              ariaLabel="Equation review progress"
              current={queue?.decided ?? 0}
              total={queue?.total ?? 0}
              summary="decided"
              separator=" / "
            />
            <span>{queue?.pending ?? 0} pending</span>
          </div>
        }
      />

      {queueExceedsBound ? (
        <div className="empty-state equation-review-error" role="alert">
          <div>
            <h2>Equation queue exceeds the browser safety bound</h2>
            <p className="error-message">
              At most {MAX_EQUATION_REVIEW_CANDIDATES} owner-projected candidates can be
              reviewed at once. No candidate was selected.
            </p>
          </div>
        </div>
      ) : candidates.length === 0 ? (
        <div className="empty-state">
          <h2>No equation candidates</h2>
          <p>The owner returned an empty queue for {EQUATION_REVIEW_DOCUMENT_ID}.</p>
        </div>
      ) : (
        <div className="equation-review-workspace">
          <aside aria-label="Equation candidate queue">
            <h2>Candidate queue</h2>
            <p>
              {queue?.total} total · {queue?.decided} decided · {queue?.pending} pending
            </p>
            <ol>
              {candidates.map((candidate, index) => (
                <li key={candidate.candidate_id}>
                  <button
                    aria-current={
                      candidate.candidate_id === activeCandidate?.candidate_id
                        ? "true"
                        : undefined
                    }
                    aria-label={`Select candidate ${index + 1} of ${candidates.length}: ${candidate.candidate_id}, ${equationStatusLabel(candidate.status)}`}
                    disabled={saveInProgress}
                    onClick={() => requestCandidate(candidate.candidate_id)}
                    type="button"
                  >
                    <strong>
                      {index + 1}. {candidate.candidate_id}
                    </strong>
                    <span>
                      Page {candidate.source.physical_page} ·{" "}
                      {equationStatusLabel(candidate.status)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
          <div className="equation-workspace-main">
            <nav
              className="equation-queue-navigation"
              aria-label="Candidate navigation"
            >
              <button
                className="button button--secondary"
                disabled={!previousCandidate || saveInProgress}
                onClick={() =>
                  previousCandidate && requestCandidate(previousCandidate.candidate_id)
                }
                type="button"
              >
                Previous
              </button>
              <span>
                Candidate {activeIndex + 1} of {candidates.length}
              </span>
              <button
                className="button button--secondary"
                disabled={!nextCandidate || saveInProgress}
                onClick={() =>
                  nextCandidate && requestCandidate(nextCandidate.candidate_id)
                }
                type="button"
              >
                Next
              </button>
            </nav>

            {pendingCandidateId ? (
              <section
                className="equation-navigation-guard"
                role="alertdialog"
                aria-labelledby="equation-navigation-guard-heading"
              >
                <div>
                  <h3 id="equation-navigation-guard-heading">
                    Discard unsubmitted changes?
                  </h3>
                  <p>
                    Reviewer source, display mode, or note changed for the current
                    candidate. Stay here or explicitly discard the draft before
                    navigating.
                  </p>
                </div>
                <div>
                  <button
                    className="button button--secondary"
                    onClick={() => setPendingCandidateId(null)}
                    type="button"
                  >
                    Stay on candidate
                  </button>
                  <button
                    className="button button--primary"
                    onClick={discardAndNavigate}
                    type="button"
                  >
                    Discard changes and continue
                  </button>
                </div>
              </section>
            ) : null}

            {activeCandidate && queueContext ? (
              <EquationCandidateWorkspace
                key={activeCandidate.candidate_id}
                candidate={activeCandidate}
                queue={queueContext}
                onDraftStateChange={handleDraftStateChange}
                onNextCandidate={
                  nextCandidate
                    ? () => requestCandidate(nextCandidate.candidate_id)
                    : undefined
                }
              />
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
