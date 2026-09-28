import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import {
  ApiError,
  apiClient,
  type EquationReviewCandidate,
  type EquationReviewDisposition,
} from "../../api/client";

const documentId = "pizzi2020";

const dispositionLabels: Record<EquationReviewDisposition, string> = {
  ACCEPT_TRANSCRIPTION: "Accept this assisted transcription",
  REJECT_CANDIDATE: "Reject this equation candidate",
  REVISION_REQUIRED: "Request a corrected transcription",
};

function shortHash(value: string): string {
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

function ReviewForm({ candidate }: { candidate: EquationReviewCandidate }) {
  const queryClient = useQueryClient();
  const [disposition, setDisposition] = useState<EquationReviewDisposition | "">(
    candidate.decision?.disposition ?? "",
  );
  const [note, setNote] = useState(candidate.decision?.note ?? "");
  const proposedAssistance =
    candidate.assistance?.status === "PROPOSED" ? candidate.assistance : null;
  const decision = useMutation({
    mutationFn: () => {
      if (!disposition) {
        throw new Error("Choose a human review action before saving.");
      }
      return apiClient.saveEquationReviewDecision(candidate.candidate_id, {
        disposition,
        assistance_proposal_sha256:
          disposition === "ACCEPT_TRANSCRIPTION"
            ? (proposedAssistance?.proposal_sha256 ?? null)
            : null,
        note,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["equation-reviews", documentId],
      });
    },
  });
  const canSave =
    Boolean(disposition) &&
    (disposition !== "ACCEPT_TRANSCRIPTION" ||
      Boolean(proposedAssistance?.proposal_sha256));

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSave) {
      decision.mutate();
    }
  }

  return (
    <form className="equation-review-actions" onSubmit={submit}>
      <div>
        <p className="eyebrow">Explicit human review</p>
        <h3>Record a disposition</h3>
        <p>
          Assisted text remains a proposal unless you choose its acceptance and save
          that decision.
        </p>
      </div>
      <fieldset>
        <legend>Review action</legend>
        {(
          Object.entries(dispositionLabels) as [EquationReviewDisposition, string][]
        ).map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name={`disposition-${candidate.candidate_id}`}
              value={value}
              checked={disposition === value}
              disabled={value === "ACCEPT_TRANSCRIPTION" && !proposedAssistance}
              onChange={() => {
                setDisposition(value);
                decision.reset();
              }}
            />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
      <label className="equation-review-note">
        <span>Reviewer note</span>
        <textarea
          rows={3}
          maxLength={4000}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            decision.reset();
          }}
          placeholder="Describe the evidence check or required correction."
        />
      </label>
      <div className="equation-review-actions__footer">
        <span>
          {candidate.decision
            ? `Existing human decision · revision ${candidate.decision.revision}`
            : "No human decision recorded"}
        </span>
        <button
          className="button button--primary"
          type="submit"
          disabled={!canSave || decision.isPending}
        >
          {decision.isPending ? "Saving…" : "Save human review"}
        </button>
      </div>
      <div aria-live="polite">
        {decision.isSuccess ? <p>Human review saved by the API.</p> : null}
        {decision.isError ? (
          <p className="error-message">
            {decision.error instanceof Error
              ? decision.error.message
              : "The human review could not be saved."}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function CandidateWorkspace({ candidate }: { candidate: EquationReviewCandidate }) {
  const assistance = candidate.assistance;

  return (
    <article className="equation-candidate">
      <header className="equation-candidate__header">
        <div>
          <p className="eyebrow">Candidate identity</p>
          <h2>{candidate.candidate_id}</h2>
          <span>{candidate.source.document_id}</span>
        </div>
        <span className={candidate.decision ? "decided" : "pending"}>
          {candidate.decision ? "Human reviewed" : "Awaiting human review"}
        </span>
      </header>

      <section className="equation-evidence-grid" aria-label="Source evidence">
        <div className="equation-region-card">
          <div>
            <span>Source region</span>
            <strong>
              {candidate.source.source_name} · page {candidate.source.physical_page}
            </strong>
          </div>
          <figure>
            <img
              src={apiClient.equationRegionImageUrl(candidate.candidate_id)}
              alt={`Equation candidate region from ${candidate.source.source_name}, page ${candidate.source.physical_page}`}
            />
            <figcaption>
              PDF points: x {candidate.region.x}, y {candidate.region.y}, width{" "}
              {candidate.region.width}, height {candidate.region.height}
            </figcaption>
          </figure>
          <dl>
            <div>
              <dt>Source SHA-256</dt>
              <dd title={candidate.source.source_sha256}>
                <code>{shortHash(candidate.source.source_sha256)}</code>
              </dd>
            </div>
            <div>
              <dt>Region image SHA-256</dt>
              <dd title={candidate.region.image_sha256}>
                <code>{shortHash(candidate.region.image_sha256)}</code>
              </dd>
            </div>
          </dl>
        </div>

        <div className="equation-evidence-card">
          <p className="eyebrow">Deterministic evidence</p>
          <h3>
            {candidate.deterministic_evidence.detector}@
            {candidate.deterministic_evidence.detector_version}
          </h3>
          <dl>
            <div>
              <dt>Evidence identity</dt>
              <dd title={candidate.deterministic_evidence.evidence_sha256}>
                <code>
                  {shortHash(candidate.deterministic_evidence.evidence_sha256)}
                </code>
              </dd>
            </div>
            <div>
              <dt>Extracted text</dt>
              <dd>
                {candidate.deterministic_evidence.extracted_text ??
                  "No deterministic text extraction"}
              </dd>
            </div>
          </dl>
          <p>
            Detector output identifies the candidate and its source region; it is not a
            human-accepted transcription.
          </p>
        </div>
      </section>

      <section className="equation-assistance" aria-labelledby="assistance-heading">
        <div>
          <p className="eyebrow">Assisted status</p>
          <h3 id="assistance-heading">
            {assistance ? assistance.status.toLowerCase() : "Not requested"}
          </h3>
        </div>
        {assistance?.status === "PROPOSED" && assistance.proposed_latex ? (
          <div className="equation-assistance__proposal">
            <span>Unaccepted assisted proposal</span>
            <code>{assistance.proposed_latex}</code>
            <small>
              {assistance.method ?? "Unspecified method"} · proposal{" "}
              {assistance.proposal_sha256
                ? shortHash(assistance.proposal_sha256)
                : "identity unavailable"}
            </small>
          </div>
        ) : (
          <p>
            {assistance?.status === "PENDING"
              ? "An assisted proposal is pending and cannot be accepted yet."
              : assistance?.status === "FAILED"
                ? "Assistance failed; deterministic evidence remains available for review."
                : "No assisted text is attached to this candidate."}
          </p>
        )}
      </section>

      <ReviewForm candidate={candidate} />
    </article>
  );
}

export function EquationReviewPage() {
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const queue = useQuery({
    queryKey: ["equation-reviews", documentId],
    queryFn: ({ signal }) => apiClient.equationReviews(documentId, signal),
    retry: false,
  });

  if (queue.isPending) {
    return <div className="review-loading">Loading equation review candidates…</div>;
  }

  if (queue.isError) {
    const unsupported = queue.error instanceof ApiError && queue.error.status === 404;
    return (
      <div className="control-dashboard equation-review-page">
        <header className="control-heading">
          <div>
            <p className="eyebrow">Private workspace · API boundary</p>
            <h1>Equation review unavailable</h1>
            <p>
              {unsupported
                ? "The web review boundary is ready, but the configured API does not implement equation review yet."
                : "Equation candidates could not be loaded from the configured API."}
            </p>
          </div>
          <div className="operator-card">
            <span className="operator-card__status">No review data</span>
            <strong>pizzi2020 not loaded</strong>
            <p>No filesystem or corpus fallback is attempted by the browser.</p>
          </div>
        </header>
        <section className="control-notice" aria-label="Equation API requirement">
          <strong>Required API contract</strong>
          <span>
            GET <code>/equation-reviews?document_id=pizzi2020</code>, region image, and
            decision endpoints must be supplied by the owning API.
          </span>
        </section>
      </div>
    );
  }

  const firstPending = queue.data.items.find((item) => !item.decision);
  const activeCandidateId =
    selectedCandidateId ??
    firstPending?.candidate_id ??
    queue.data.items[0]?.candidate_id;
  const activeCandidate = queue.data.items.find(
    (item) => item.candidate_id === activeCandidateId,
  );

  return (
    <div className="control-dashboard equation-review-page">
      <header className="control-heading">
        <div>
          <p className="eyebrow">Private workspace · Document-centric corpus</p>
          <h1>Equation review</h1>
          <p>
            Compare deterministic source evidence with any assisted transcription, then
            record an explicit human disposition.
          </p>
        </div>
        <div className="operator-card" aria-label="Equation review progress">
          <span className="operator-card__status">{queue.data.document_id}</span>
          <strong>
            {queue.data.decided}/{queue.data.total} reviewed
          </strong>
          <p>Assisted text is never accepted by display or retrieval alone.</p>
        </div>
      </header>

      <section className="control-notice" aria-label="Equation review boundary">
        <strong>Source evidence remains authoritative.</strong>
        <span>
          Region images and hashes come from the API. The browser does not read or
          derive corpus files directly.
        </span>
      </section>

      {queue.data.items.length ? (
        <div className="equation-review-workspace">
          <aside aria-labelledby="equation-candidate-list-heading">
            <p className="eyebrow">{queue.data.document_id}</p>
            <h2 id="equation-candidate-list-heading">Candidates</h2>
            <ol>
              {queue.data.items.map((candidate) => (
                <li key={candidate.candidate_id}>
                  <button
                    type="button"
                    aria-pressed={candidate.candidate_id === activeCandidateId}
                    onClick={() => setSelectedCandidateId(candidate.candidate_id)}
                  >
                    <strong>{candidate.candidate_id}</strong>
                    <span>
                      Page {candidate.source.physical_page} ·{" "}
                      {candidate.decision ? "reviewed" : "pending"}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>
          <main>
            {activeCandidate ? (
              <CandidateWorkspace
                candidate={activeCandidate}
                key={activeCandidate.candidate_id}
              />
            ) : null}
          </main>
        </div>
      ) : (
        <div className="empty-state">
          <h2>No pizzi2020 equation candidates</h2>
          <p>The API returned a successful, empty review queue.</p>
        </div>
      )}
    </div>
  );
}
