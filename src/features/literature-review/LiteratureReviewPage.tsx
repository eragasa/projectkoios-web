import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import katex from "katex";
import { type FormEvent, type ReactNode, useState } from "react";

import "katex/dist/katex.min.css";

import { apiClient, type LiteratureReviewProgress } from "../../api/client";

type Claim = LiteratureReviewProgress["claims"][number];

type Status = NonNullable<Claim["status"]>;

const statusLabels: Record<Status, string> = {
  SUPPORTED: "Supported by retrieved evidence",
  QUALIFIED: "Needs narrower wording",
  CONTRADICTED: "Contradicted",
  UNRESOLVED: "Unresolved",
};

function readableSection(section: string): string {
  return section.replaceAll("_", " ");
}

function phaseLabel(phase: LiteratureReviewProgress["phase"]): string {
  if (phase === "PENDING") return "Waiting to start";
  if (phase === "RETRIEVING") return "Retrieving evidence";
  if (phase === "ASSESSING") return "Assessing claims";
  return "Assessment complete";
}

function inlineSubmissionMarkdown(text: string): ReactNode[] {
  const pattern = /(\$[^$]+\$|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  return text
    .split(pattern)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("$") && part.endsWith("$")) {
        const markup = katex.renderToString(part.slice(1, -1), {
          displayMode: false,
          output: "htmlAndMathml",
          strict: false,
          throwOnError: false,
          trust: false,
        });
        return (
          <span
            className="original-submission__inline-math"
            dangerouslySetInnerHTML={{ __html: markup }}
            key={`${part}-${index}`}
          />
        );
      }
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
      }
      const link = /^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/.exec(part);
      if (link) {
        return (
          <a href={link[2]} rel="noreferrer" target="_blank" key={`${part}-${index}`}>
            {link[1]}
          </a>
        );
      }
      return part;
    });
}

function OriginalSubmission({ markdown }: { markdown: string }) {
  return (
    <section className="original-submission" id="original-submission">
      <header>
        <div>
          <p className="eyebrow">Original submission</p>
          <h2>Framework supplied for critical review</h2>
        </div>
        <span>INTAKE · NOT ACCEPTED EVIDENCE</span>
      </header>
      <p className="original-submission__boundary">
        Exact submitted wording is shown below for comparison. It is a review target,
        not a verified source or accepted conclusion.
      </p>
      <details open>
        <summary>Show or hide the original framework</summary>
        <div className="original-submission__document">
          {markdown.split("\n").map((line, index) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "---") return null;
            if (trimmed.startsWith("$$") && trimmed.endsWith("$$")) {
              const markup = katex.renderToString(trimmed.slice(2, -2), {
                displayMode: true,
                output: "htmlAndMathml",
                strict: false,
                throwOnError: false,
                trust: false,
              });
              return (
                <div
                  className="original-submission__equation"
                  dangerouslySetInnerHTML={{ __html: markup }}
                  key={`line-${index}`}
                />
              );
            }
            if (trimmed.startsWith("### ")) {
              return <h4 key={`line-${index}`}>{trimmed.slice(4)}</h4>;
            }
            if (trimmed.startsWith("## ")) {
              return <h3 key={`line-${index}`}>{trimmed.slice(3)}</h3>;
            }
            if (trimmed.startsWith("# ")) {
              return <h2 key={`line-${index}`}>{trimmed.slice(2)}</h2>;
            }
            const listItem = /^(?:\d+\.|\*)\s+(.+)$/.exec(trimmed);
            if (listItem) {
              return (
                <div className="original-submission__list-item" key={`line-${index}`}>
                  <span>•</span>
                  <p>{inlineSubmissionMarkdown(listItem[1])}</p>
                </div>
              );
            }
            return <p key={`line-${index}`}>{inlineSubmissionMarkdown(trimmed)}</p>;
          })}
        </div>
      </details>
    </section>
  );
}

function EquationValidation({ claim }: { claim: Claim }) {
  const frame = claim.validation_frame;
  if (!frame) return null;

  return (
    <section className="equation-validation">
      <header>
        <div>
          <p className="eyebrow">Equation-first critical check</p>
          <h3>{frame.finding.replaceAll("_", " ").toLowerCase()}</h3>
        </div>
        <span>{frame.assessment_status}</span>
      </header>
      <p className="equation-validation__conclusion">{frame.conclusion}</p>
      <div className="equation-validation__list">
        {frame.equations.map((equation) => {
          const markup = katex.renderToString(equation.latex, {
            displayMode: true,
            output: "htmlAndMathml",
            strict: false,
            throwOnError: false,
            trust: false,
          });
          return (
            <article key={`${claim.claim_id}-${equation.label}`}>
              <strong>{equation.label}</strong>
              <div
                className="equation-validation__math"
                dangerouslySetInnerHTML={{ __html: markup }}
              />
              <p>{equation.interpretation}</p>
            </article>
          );
        })}
      </div>
      <p className="equation-validation__evidence">
        Checked against retrieved labels: {frame.evidence_labels.join(", ")}
      </p>
    </section>
  );
}

function ClaimCard({
  claim,
  onProvideReference,
}: {
  claim: Claim;
  onProvideReference: (claimId: string) => void;
}) {
  const statusClass = claim.status?.toLowerCase() ?? "pending";

  return (
    <article
      className={`literature-claim literature-claim--${statusClass}`}
      id={`claim-${claim.claim_id}`}
    >
      <header>
        <div>
          <span className="literature-claim__id">{claim.claim_id}</span>
          <span className="literature-claim__section">
            {readableSection(claim.section)}
          </span>
        </div>
        <span className={`literature-status literature-status--${statusClass}`}>
          {claim.status ? statusLabels[claim.status] : "Pending assessment"}
        </span>
      </header>

      <h2>{claim.claim}</h2>
      <p className="literature-claim__evidence-count">
        {claim.evidence_count} retrieved evidence passages
      </p>

      <EquationValidation claim={claim} />

      {claim.summary ? (
        <section className="literature-claim__assessment">
          <p className="eyebrow">Automated assessment — unreviewed</p>
          <p>{claim.summary}</p>
        </section>
      ) : (
        <p className="literature-claim__waiting">
          Evidence may be ready, but no model assessment has been accepted by the output
          contract yet.
        </p>
      )}

      {claim.corrected_claim ? (
        <section className="literature-claim__correction">
          <h3>Proposed corrected wording</h3>
          <p>{claim.corrected_claim}</p>
        </section>
      ) : null}

      {claim.evidence.length ? (
        <details className="literature-claim__sources">
          <summary>Show cited source locations</summary>
          <ul>
            {claim.evidence.map((source) => (
              <li key={`${claim.claim_id}-${source.label}`}>
                <p>
                  <strong>{source.label}</strong>{" "}
                  <code>@{source.citation_key ?? "uncataloged"}</code>, physical page{" "}
                  {source.physical_page}
                </p>
                <blockquote>{source.quote}</blockquote>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {claim.source_requests.length ? (
        <details className="literature-claim__requests">
          <summary>Remaining source requests</summary>
          <ul>
            {claim.source_requests.map((request) => (
              <li key={request}>{request}</li>
            ))}
          </ul>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => onProvideReference(claim.claim_id)}
          >
            Provide a reference for {claim.claim_id}
          </button>
        </details>
      ) : null}
    </article>
  );
}

function ReferenceIntake({
  claims,
  selectedClaimId,
  onSelectClaim,
}: {
  claims: Claim[];
  selectedClaimId: string;
  onSelectClaim: (claimId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [citationLabel, setCitationLabel] = useState("");
  const [doiOrUrl, setDoiOrUrl] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const provided = useQuery({
    queryKey: ["literature-review-provided-references"],
    queryFn: ({ signal }) => apiClient.providedLiteratureReferences(signal),
    refetchInterval: 5_000,
  });
  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Choose a PDF to provide.");
      if (file.size > 100_000_000) {
        throw new Error("The PDF exceeds the 100 MB intake limit.");
      }
      return apiClient.provideLiteratureReference({
        claimId: selectedClaimId,
        citationLabel,
        doiOrUrl,
        note,
        file,
      });
    },
    onSuccess: async () => {
      setFile(null);
      setCitationLabel("");
      setDoiOrUrl("");
      setNote("");
      setFileInputKey((value) => value + 1);
      await queryClient.invalidateQueries({
        queryKey: ["literature-review-provided-references"],
      });
    },
  });

  const latestProvided = provided.data?.items[0];
  const reassessmentAvailable =
    latestProvided?.status === "INGESTED_AUTOMATED_UNREVIEWED";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    if (!file) {
      setLocalError("Choose a PDF to provide.");
      return;
    }
    if (file.size > 100_000_000) {
      setLocalError("The PDF exceeds the 100 MB intake limit.");
      return;
    }
    upload.mutate();
  }

  return (
    <section className="reference-intake" id="reference-intake">
      <div className="reference-intake__heading">
        <div>
          <p className="eyebrow">Private source intake</p>
          <h2>Provide a missing reference</h2>
          <p>
            Attach a PDF that retrieval could not acquire. It is stored immutably but
            remains outside retrieval and evidence until a separate ingestion step.
          </p>
        </div>
        <span>PDF · 100 MB maximum</span>
      </div>

      <form className="reference-intake__form" onSubmit={submit}>
        <label>
          <span>Affected claim</span>
          <select
            value={selectedClaimId}
            onChange={(event) => onSelectClaim(event.target.value)}
          >
            {claims.map((claim) => (
              <option value={claim.claim_id} key={claim.claim_id}>
                {claim.claim_id} — {claim.claim.slice(0, 72)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Provisional citation label</span>
          <input
            required
            maxLength={128}
            value={citationLabel}
            onChange={(event) => setCitationLabel(event.target.value)}
            placeholder="ExampleAuthor2024"
          />
        </label>
        <label>
          <span>DOI or source URL (optional)</span>
          <input
            maxLength={1000}
            value={doiOrUrl}
            onChange={(event) => setDoiOrUrl(event.target.value)}
            onPaste={(event) => {
              const text = event.clipboardData.getData("text");
              if (text) {
                event.preventDefault();
                setDoiOrUrl(text.trim());
              }
            }}
            placeholder="Enter another DOI or source URL"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <label>
          <span>PDF file</span>
          <input
            key={fileInputKey}
            required
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <label className="reference-intake__note">
          <span>Note (optional)</span>
          <textarea
            maxLength={4000}
            rows={3}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why this source is relevant or how it was obtained."
          />
        </label>
        <div className="reference-intake__submit">
          <p>Uploading does not verify, ingest, cite, or accept the reference.</p>
          <button
            className="button button--primary"
            type="submit"
            disabled={upload.isPending || !citationLabel.trim() || !file}
          >
            {upload.isPending ? "Storing PDF…" : "Provide reference"}
          </button>
        </div>
        <div className="reference-intake__status" aria-live="polite">
          {localError ? <p className="error-message">{localError}</p> : null}
          {upload.isError ? (
            <p className="error-message">
              {upload.error instanceof Error
                ? upload.error.message
                : "The reference could not be stored."}
            </p>
          ) : null}
          {upload.isSuccess ? (
            <p>
              {upload.data.duplicate
                ? "This exact reference intake was already recorded."
                : "Reference stored privately and awaiting ingestion."}
            </p>
          ) : null}
        </div>
      </form>

      {provided.data?.items.length ? (
        <div className="provided-reference-list">
          <h3>Provided references</h3>
          {provided.data.items.map((reference) => (
            <article key={reference.receipt_id}>
              <div>
                <strong>{reference.citation_label}</strong>
                <span>{reference.claim_id}</span>
              </div>
              <p>{reference.status.replaceAll("_", " ").toLowerCase()}</p>
              <code>{reference.source_sha256.slice(0, 16)}…</code>
            </article>
          ))}
          <section className="reference-update-bay" aria-label="Reference next steps">
            <div>
              <p className="eyebrow">Update bay</p>
              <h3>
                {reassessmentAvailable
                  ? "Reference ingested; automated reassessment available"
                  : "Reference received; reassessment has not run"}
              </h3>
              <p>
                {reassessmentAvailable
                  ? `The reference corpus and affected claims were updated in ${latestProvided?.latest_generation ?? "the latest generation"}. Scientific conclusions still require human disposition.`
                  : "Receipt is complete. Human source review, ingestion, retrieval, and affected-claim reassessment are still pending and cannot be inferred from upload alone."}
              </p>
            </div>
            <ol>
              <li className="reference-update-bay__complete">Private receipt stored</li>
              <li
                className={
                  reassessmentAvailable ? "reference-update-bay__complete" : ""
                }
              >
                {reassessmentAvailable
                  ? "Reference corpus ingestion complete"
                  : "Review and ingestion pending separate authorization"}
              </li>
              <li
                className={
                  reassessmentAvailable ? "reference-update-bay__complete" : ""
                }
              >
                {reassessmentAvailable
                  ? "Affected-claim automated reassessment complete"
                  : "Affected-claim retrieval and reassessment pending"}
              </li>
              {reassessmentAvailable ? <li>Human disposition pending</li> : null}
            </ol>
            <div className="reference-update-bay__actions">
              <button
                className="button button--secondary"
                type="button"
                onClick={() => void provided.refetch()}
              >
                Refresh receipt status
              </button>
              <a
                className="button button--secondary"
                href={`#claim-${latestProvided?.claim_id ?? selectedClaimId}`}
              >
                View affected claim
              </a>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function StatusSummary({ review }: { review: LiteratureReviewProgress }) {
  const counts = review.status_counts;
  const statuses = [
    ["Supported", counts.supported, "supported"],
    ["Qualified", counts.qualified, "qualified"],
    ["Contradicted", counts.contradicted, "contradicted"],
    ["Unresolved", counts.unresolved, "unresolved"],
  ] as const;

  return (
    <div className="literature-status-grid" aria-label="Assessment outcomes">
      {statuses.map(([label, count, modifier]) => (
        <div className={`literature-stat literature-stat--${modifier}`} key={label}>
          <strong>{count}</strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

export function LiteratureReviewPage() {
  const [selectedReferenceClaimId, setSelectedReferenceClaimId] = useState("");
  const review = useQuery({
    queryKey: ["literature-review-progress"],
    queryFn: ({ signal }) => apiClient.literatureReviewProgress(signal),
    refetchInterval: 5_000,
  });

  if (review.isPending) {
    return <div className="review-loading">Loading literature-review progress…</div>;
  }
  if (review.isError) {
    return (
      <div className="empty-state">
        <h2>Literature-review monitor unavailable</h2>
        <p>
          Confirm that the local API is running and that a review run is selected in the
          private Project Koios configuration.
        </p>
      </div>
    );
  }

  const item = review.data;
  const referenceClaimId = item.claims.some(
    (claim) => claim.claim_id === selectedReferenceClaimId,
  )
    ? selectedReferenceClaimId
    : item.claims[0].claim_id;
  const validationClaim = item.claims.find((claim) => claim.validation_frame);

  function chooseReferenceClaim(claimId: string) {
    setSelectedReferenceClaimId(claimId);
    requestAnimationFrame(() => {
      document
        .getElementById("reference-intake")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="literature-review-page">
      <header className="literature-review-header">
        <div>
          <p className="eyebrow">Evidence-first method review</p>
          <h1>Literature review</h1>
          <p>
            Follow retrieval and bounded local-model assessment claim by claim. The
            display intentionally excludes private paths, source passages, prompts, and
            raw model responses.
          </p>
        </div>
        <div className="literature-run-state" aria-live="polite">
          <span className={`run-pulse run-pulse--${item.phase.toLowerCase()}`} />
          <div>
            <strong>{phaseLabel(item.phase)}</strong>
            <small>{item.run_id}</small>
          </div>
        </div>
      </header>

      <OriginalSubmission markdown={item.original_submission_markdown} />

      <section className="literature-latest-update" aria-label="Latest review updates">
        <div>
          <p className="eyebrow">Latest review additions</p>
          <h2>Equation-first checks are available</h2>
          <p>
            {item.claims.filter((claim) => claim.validation_frame).length} claims now
            separate mathematical checks from the original automated prose.
          </p>
        </div>
        <div>
          <a className="button button--secondary" href="#original-submission">
            View original submission
          </a>
          {validationClaim ? (
            <a
              className="button button--primary"
              href={`#claim-${validationClaim.claim_id}`}
            >
              View equation-first check
            </a>
          ) : null}
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void review.refetch()}
          >
            Refresh latest updates
          </button>
        </div>
      </section>

      <section className="literature-progress-panel">
        <div className="literature-progress-heading">
          <div>
            <span>{item.assessment_count} assessed</span>
            <span>{item.evidence_ready_count} evidence-ready</span>
            <span>{item.claim_count} total claims</span>
          </div>
          <strong>{item.completion_percent.toFixed(1)}%</strong>
        </div>
        <div
          className="literature-progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={item.completion_percent}
          aria-label="Literature-review assessment progress"
        >
          <span style={{ width: `${item.completion_percent}%` }} />
        </div>
        <StatusSummary review={item} />
      </section>

      <aside className="literature-boundary-notice">
        <strong>{item.assessment_status}</strong>
        <p>
          These model outputs are proposals, not human-reviewed conclusions. No
          scientific calculation or classifier implementation is authorized.
        </p>
        <dl>
          <div>
            <dt>Human disposition</dt>
            <dd>{item.human_disposition ?? "Not recorded"}</dd>
          </div>
          <div>
            <dt>Scientific calculation</dt>
            <dd>
              {item.scientific_calculation_authorized ? "Authorized" : "Not authorized"}
            </dd>
          </div>
          <div>
            <dt>Classifier implementation</dt>
            <dd>
              {item.classifier_implementation_authorized
                ? "Authorized"
                : "Not authorized"}
            </dd>
          </div>
        </dl>
      </aside>

      <ReferenceIntake
        claims={item.claims}
        selectedClaimId={referenceClaimId}
        onSelectClaim={setSelectedReferenceClaimId}
      />

      <section className="literature-claim-list">
        <div className="review-section-heading">
          <div>
            <p className="eyebrow">Claim inventory</p>
            <h2>Assessment trace</h2>
          </div>
          <span>{item.claims.length} atomic claims</span>
        </div>
        {item.claims.map((claim) => (
          <ClaimCard
            claim={claim}
            key={claim.claim_id}
            onProvideReference={chooseReferenceClaim}
          />
        ))}
      </section>
    </div>
  );
}
