import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import {
  apiClient,
  type CourseReferenceAssetDecisionRequest,
  type CourseReferenceAssetDisposition,
  type CourseReferenceAssetPreviewRequest,
  type CourseReferenceDecisionReceipt,
  type CourseReferenceIdentityDecisionRequest,
  type CourseReferenceIdentityDisposition,
  type CourseReferenceIdentityPreviewRequest,
  type CourseReferenceItem,
  type CourseReferenceQueue,
} from "../../api/client";
import { DisclosurePanel } from "../../components/DisclosurePanel";
import {
  assetDispositionLabels,
  assetPreviewMatches,
  courseReferenceError,
  identityDispositionLabels,
  identityPreviewMatches,
  isFreshnessFailure,
  parseAliasCitekeys,
  recordMatchLabels,
  resolutionLabels,
  utcSecond,
} from "./referenceAuthorityModel";

export interface ReferenceDraftState {
  dirty: boolean;
  busy: boolean;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} kB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function shortId(value: string): string {
  if (value.length <= 30) return value;
  return `${value.slice(0, 18)}…${value.slice(-10)}`;
}

function MetadataAndEvidence({ item }: { item: CourseReferenceItem }) {
  const candidate = item.candidate;
  return (
    <>
      <section
        className="reference-authority-section"
        aria-labelledby="candidate-metadata-heading"
      >
        <div className="reference-authority-section__heading">
          <div>
            <p className="eyebrow">Candidate metadata</p>
            <h3 id="candidate-metadata-heading">
              {candidate?.title ?? "Candidate metadata unavailable"}
            </h3>
          </div>
          <span
            className={`reference-resolution reference-resolution--${item.resolution}`}
          >
            {resolutionLabels[item.resolution]}
          </span>
        </div>
        {candidate ? (
          <dl className="reference-metadata-grid">
            <div>
              <dt>Proposed citekey</dt>
              <dd>
                <code>{candidate.proposed_citekey}</code>
              </dd>
            </div>
            <div>
              <dt>Entry type</dt>
              <dd>{candidate.entry_type}</dd>
            </div>
            <div>
              <dt>Authors</dt>
              <dd>{candidate.authors.join("; ") || "Not supplied"}</dd>
            </div>
            <div>
              <dt>Year</dt>
              <dd>{candidate.year ?? "Not supplied"}</dd>
            </div>
            <div>
              <dt>DOI</dt>
              <dd>{candidate.doi ?? "Not supplied"}</dd>
            </div>
            <div>
              <dt>ISBN / eprint</dt>
              <dd>{candidate.isbn ?? candidate.eprint ?? "Not supplied"}</dd>
            </div>
            <div>
              <dt>Identity status</dt>
              <dd>{candidate.identity_status}</dd>
            </div>
            <div>
              <dt>Citekey status</dt>
              <dd>{candidate.citekey_status}</dd>
            </div>
            <div>
              <dt>Candidate identity</dt>
              <dd>
                <code>{candidate.candidate_id}</code>
              </dd>
            </div>
            <div>
              <dt>Source observations</dt>
              <dd>
                {candidate.source_observation_ids.map((id) => (
                  <code key={id}>{id} </code>
                ))}
              </dd>
            </div>
          </dl>
        ) : (
          <p>
            The complete Courses-owned selection remains in the queue, but References
            did not project a resolvable candidate. No authority action is available.
          </p>
        )}
      </section>

      <section
        className="reference-authority-section"
        aria-labelledby="readiness-heading"
      >
        <div className="reference-authority-section__heading">
          <div>
            <p className="eyebrow">Readiness</p>
            <h3 id="readiness-heading">Evidence and assets remain separate</h3>
          </div>
        </div>
        <dl className="reference-readiness-grid">
          <div>
            <dt>Identity evidence</dt>
            <dd>{item.observations.length} source observations</dd>
          </div>
          <div>
            <dt>Rendered evidence</dt>
            <dd>{item.rendered_entry ? "Available" : "Unavailable"}</dd>
          </div>
          <div>
            <dt>Existing-record observations</dt>
            <dd>{item.record_matches.length} matches or conflicts</dd>
          </div>
          <div>
            <dt>Asset evidence</dt>
            <dd>{item.assets.length} candidates</dd>
          </div>
          <div>
            <dt>Active identity authority</dt>
            <dd>{item.active_authority ? "Present" : "Not established"}</dd>
          </div>
          <div>
            <dt>Canonical asset authority</dt>
            <dd>
              {item.active_authority?.canonical_asset_decision_id
                ? "Decision present"
                : "Not established"}
            </dd>
          </div>
        </dl>
      </section>

      {item.active_authority ? (
        <section
          className="reference-authority-section"
          aria-labelledby="active-authority-heading"
        >
          <div className="reference-authority-section__heading">
            <div>
              <p className="eyebrow">Current References authority</p>
              <h3 id="active-authority-heading">
                <code>{item.active_authority.active_citekey}</code>
              </h3>
            </div>
          </div>
          <dl className="reference-readiness-grid">
            <div>
              <dt>State projection</dt>
              <dd>
                <code>{item.active_authority.state_projection_id}</code>
              </dd>
            </div>
            <div>
              <dt>Identity decision</dt>
              <dd>
                <code>{item.active_authority.identity_decision_id}</code>
              </dd>
            </div>
            <div>
              <dt>Bibliographic work</dt>
              <dd>
                <code>{item.active_authority.bibliographic_work_id}</code>
              </dd>
            </div>
            <div>
              <dt>Aliases</dt>
              <dd>{item.active_authority.alias_citekeys.join(", ") || "None"}</dd>
            </div>
            <div>
              <dt>Canonical asset decision</dt>
              <dd>
                <code>
                  {item.active_authority.canonical_asset_decision_id ?? "None"}
                </code>
              </dd>
            </div>
            <div>
              <dt>Source asset</dt>
              <dd>
                <code>{item.active_authority.source_asset_id ?? "None"}</code>
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section
        className="reference-authority-section"
        aria-labelledby="matches-heading"
      >
        <div className="reference-authority-section__heading">
          <div>
            <p className="eyebrow">Exact owner observations</p>
            <h3 id="matches-heading">Existing matches and conflicts</h3>
          </div>
          <span>{item.record_matches.length}</span>
        </div>
        {item.record_matches.length ? (
          <div className="reference-match-list">
            {item.record_matches.map((match) => (
              <article className="reference-match" key={match.record_id}>
                <strong>{recordMatchLabels[match.kind]}</strong>
                <code>{match.citekey}</code>
                <span>{formatBytes(match.bibtex_byte_size)}</span>
                <small>SHA-256 {match.bibtex_sha256}</small>
                <small>{match.authority_status.replaceAll("-", " ")}</small>
                <small>{match.record_id}</small>
              </article>
            ))}
          </div>
        ) : (
          <p className="reference-muted">
            No existing-record observation was projected.
          </p>
        )}
      </section>

      <section className="reference-authority-section" aria-labelledby="assets-heading">
        <div className="reference-authority-section__heading">
          <div>
            <p className="eyebrow">Source assets</p>
            <h3 id="assets-heading">Asset evidence</h3>
          </div>
          <span>{item.assets.length}</span>
        </div>
        {item.assets.length ? (
          <div className="reference-asset-list">
            {item.assets.map((asset) => (
              <article className="reference-asset" key={asset.asset_observation_id}>
                <header>
                  <strong>{asset.runtime_availability}</strong>
                  <span>{formatBytes(asset.byte_size)}</span>
                </header>
                <dl>
                  <div>
                    <dt>Rights</dt>
                    <dd>{asset.rights_status}</dd>
                  </div>
                  <div>
                    <dt>Asset status</dt>
                    <dd>{asset.asset_status}</dd>
                  </div>
                  <div>
                    <dt>Document bindings</dt>
                    <dd>{asset.document_binding_ids.length}</dd>
                  </div>
                  <div>
                    <dt>Ingestion evidence</dt>
                    <dd>{asset.ingestion_evidence_ids.length}</dd>
                  </div>
                </dl>
                <small>SHA-256 {asset.sha256}</small>
                <small>{asset.asset_observation_id}</small>
                <small>runtime evidence {asset.runtime_evidence_id ?? "none"}</small>
                {asset.document_binding_ids.map((id) => (
                  <small key={id}>document binding {id}</small>
                ))}
                {asset.ingestion_evidence_ids.map((id) => (
                  <small key={id}>ingestion evidence {id}</small>
                ))}
                {asset.ingestion_artifact_links.map((link) => (
                  <small key={link.link_id}>
                    artifact link {link.link_id} · document {link.document_id}
                  </small>
                ))}
              </article>
            ))}
          </div>
        ) : (
          <p className="reference-muted">No source-asset evidence was projected.</p>
        )}
      </section>

      <DisclosurePanel
        className="reference-provenance"
        summary="Metadata and provenance identities"
      >
        <dl>
          <div>
            <dt>Selection</dt>
            <dd>
              <code>{item.selection.selection_id}</code>
            </dd>
          </div>
          <div>
            <dt>Locator binding</dt>
            <dd>
              <code>{item.selection.locator_binding_id}</code>
            </dd>
          </div>
          <div>
            <dt>Reference locator</dt>
            <dd>
              <code>{item.selection.reference_locator}</code>
            </dd>
          </div>
          <div>
            <dt>Item revision</dt>
            <dd>
              <code>{item.item_revision_id}</code>
            </dd>
          </div>
          <div>
            <dt>Origin</dt>
            <dd>{item.selection.origin}</dd>
          </div>
          <div>
            <dt>Display guard</dt>
            <dd>{item.selection.display_citekey_status}</dd>
          </div>
        </dl>
        {item.observations.map((observation) => (
          <article key={observation.observation_id}>
            <strong>{observation.observed_citekey}</strong>
            <span>source {observation.source_id}</span>
            <span>entry {observation.entry_index}</span>
            <span>{formatBytes(observation.entry_byte_size)}</span>
            <code>{observation.observation_id}</code>
            <code>entry SHA-256 {observation.entry_sha256}</code>
            <code>bibliography SHA-256 {observation.bibliography_sha256}</code>
          </article>
        ))}
        {item.rendered_entry ? (
          <article>
            <strong>Rendered {item.rendered_entry.citekey}</strong>
            <span>{item.rendered_entry.entry_type}</span>
            <span>{formatBytes(item.rendered_entry.rendered_byte_size)}</span>
            <code>{item.rendered_entry.entry_id}</code>
            <code>rendered SHA-256 {item.rendered_entry.rendered_sha256}</code>
            {item.rendered_entry.normalized_fields.map(([name, value]) => (
              <span key={`${name}:${value}`}>
                {name}: {value}
              </span>
            ))}
          </article>
        ) : null}
        {[
          ...item.current_identity_decisions,
          ...(item.current_asset_decision ? [item.current_asset_decision] : []),
        ].map((head) => (
          <article key={head.decision_id}>
            <strong>
              {head.dimension} · {head.decision}
            </strong>
            <span>{head.decided_at}</span>
            <span>{head.authority_scope}</span>
            <code>{head.decision_id}</code>
            <code>actor {head.actor_id}</code>
            <code>verification {head.actor_verification_record_id}</code>
            <code>subject {head.subject_id}</code>
            <code>context {head.context_id}</code>
          </article>
        ))}
      </DisclosurePanel>
    </>
  );
}

function Receipt({ receipt }: { receipt: CourseReferenceDecisionReceipt }) {
  return (
    <section
      className="reference-receipt"
      role="status"
      aria-label="Recorded owner receipt"
    >
      <div>
        <p className="eyebrow">Owner-recorded receipt</p>
        <h4>
          {receipt.dimension === "reference-identity"
            ? "Identity decision recorded"
            : "Asset decision recorded"}
        </h4>
      </div>
      <dl>
        <div>
          <dt>Disposition</dt>
          <dd>{receipt.disposition}</dd>
        </div>
        <div>
          <dt>Receipt</dt>
          <dd>
            <code>{receipt.receipt_id}</code>
          </dd>
        </div>
        <div>
          <dt>Decision</dt>
          <dd>
            <code>{receipt.decision_id}</code>
          </dd>
        </div>
        <div>
          <dt>Owner preview</dt>
          <dd>
            <code>{receipt.preview_id}</code>
          </dd>
        </div>
        <div>
          <dt>Current head</dt>
          <dd>
            <code>{receipt.current_decision_id}</code>
          </dd>
        </div>
        <div>
          <dt>State projection</dt>
          <dd>
            <code>{receipt.state_projection_id ?? "None"}</code>
          </dd>
        </div>
        <div>
          <dt>Current state projection</dt>
          <dd>
            <code>{receipt.current_state_projection_id ?? "None"}</code>
          </dd>
        </div>
        <div>
          <dt>PUT request</dt>
          <dd>
            <code>{receipt.put_request_id}</code>
          </dd>
        </div>
        <div>
          <dt>Decision append request</dt>
          <dd>
            <code>{receipt.decision_append_request_id}</code>
          </dd>
        </div>
        <div>
          <dt>Result</dt>
          <dd>
            <code>{receipt.result_id}</code>
          </dd>
        </div>
        <div>
          <dt>Refreshed item revision</dt>
          <dd>
            <code>{receipt.refreshed_item_revision_id}</code>
          </dd>
        </div>
        <div>
          <dt>Refreshed queue</dt>
          <dd>
            <code>{receipt.refreshed_queue_id}</code>
          </dd>
        </div>
      </dl>
    </section>
  );
}

function IdentityDecisionPanel({
  courseId,
  queue,
  item,
  onStateChange,
  onNext,
}: {
  courseId: string;
  queue: CourseReferenceQueue;
  item: CourseReferenceItem;
  onStateChange: (state: ReferenceDraftState) => void;
  onNext?: () => void;
}) {
  const queryClient = useQueryClient();
  const [disposition, setDisposition] = useState<
    CourseReferenceIdentityDisposition | ""
  >("");
  const [targetStateId, setTargetStateId] = useState("");
  const [canonicalCitekey, setCanonicalCitekey] = useState(
    item.candidate?.proposed_citekey ?? item.selection.display_citekey,
  );
  const [aliasText, setAliasText] = useState("");
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [currentDecisionId, setCurrentDecisionId] = useState("");
  const [rationale, setRationale] = useState("");
  const [frozenRequest, setFrozenRequest] =
    useState<CourseReferenceIdentityDecisionRequest | null>(null);

  const preview = useMutation({
    mutationFn: (request: CourseReferenceIdentityPreviewRequest) =>
      apiClient.previewCourseReferenceIdentity(
        courseId,
        item.selection.selection_id,
        request,
      ),
  });
  const decision = useMutation({
    mutationFn: (request: CourseReferenceIdentityDecisionRequest) =>
      apiClient.decideCourseReferenceIdentity(
        courseId,
        item.selection.selection_id,
        request,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["course-references", courseId],
      });
    },
    onError: async (error) => {
      if (isFreshnessFailure(error)) {
        preview.reset();
        setFrozenRequest(null);
        await queryClient.invalidateQueries({
          queryKey: ["course-references", courseId],
        });
      }
    },
  });

  useEffect(() => {
    preview.reset();
    setFrozenRequest(null);
  }, [queue.queue_id, item.item_revision_id]);

  const aliases = parseAliasCitekeys(aliasText);
  const selectedRecordMatchIds = item.record_matches
    .map((match) => match.record_id)
    .filter((recordId) => selectedMatches.has(recordId));
  const accepting =
    disposition === "ACCEPT_EXISTING" ||
    disposition === "ACCEPT_NEW" ||
    disposition === "MERGE";
  const needsTarget = disposition === "ACCEPT_EXISTING" || disposition === "MERGE";
  const hasDraft = Boolean(
    disposition ||
    targetStateId ||
    aliasText ||
    selectedMatches.size ||
    currentDecisionId ||
    rationale,
  );
  const previewRequest: CourseReferenceIdentityPreviewRequest | null = disposition
    ? {
        expected_queue_id: queue.queue_id,
        expected_item_revision_id: item.item_revision_id,
        disposition,
        target_state_projection_id: needsTarget ? targetStateId || null : null,
        canonical_citekey: accepting ? canonicalCitekey || null : null,
        alias_citekeys: accepting ? aliases : [],
        selected_record_match_ids: selectedRecordMatchIds,
        expected_current_decision_id: currentDecisionId || null,
      }
    : null;
  const previewIsCurrent = Boolean(
    preview.data &&
    previewRequest &&
    identityPreviewMatches(preview.data, previewRequest, item.selection.selection_id),
  );
  const canPreview = Boolean(
    previewRequest &&
    (!accepting || canonicalCitekey) &&
    (!needsTarget || targetStateId),
  );

  useEffect(() => {
    onStateChange({
      dirty: hasDraft && !decision.isSuccess,
      busy: preview.isPending || decision.isPending,
    });
  }, [
    decision.isPending,
    decision.isSuccess,
    hasDraft,
    onStateChange,
    preview.isPending,
  ]);

  function invalidateConsequence() {
    preview.reset();
    decision.reset();
    setFrozenRequest(null);
  }

  function requestPreview() {
    if (!previewRequest || !canPreview) return;
    decision.reset();
    setFrozenRequest(null);
    preview.mutate(previewRequest);
  }

  function confirmDecision() {
    if (!preview.data || !previewRequest || !previewIsCurrent || !rationale.trim())
      return;
    const request: CourseReferenceIdentityDecisionRequest = frozenRequest ?? {
      ...previewRequest,
      expected_preview_id: preview.data.preview_id,
      expected_preview_result_id: preview.data.result_id,
      idempotency_key: crypto.randomUUID(),
      rationale: rationale.trim(),
      decided_at: utcSecond(),
    };
    if (!frozenRequest) setFrozenRequest(request);
    decision.mutate(request);
  }

  return (
    <section
      className="reference-decision-panel"
      aria-labelledby="identity-decision-heading"
    >
      <div className="reference-authority-section__heading">
        <div>
          <p className="eyebrow">Step 1 · Reference identity</p>
          <h3 id="identity-decision-heading">Preview and record identity authority</h3>
        </div>
        <span>{item.allowed_identity_actions.length} allowed actions</span>
      </div>
      {item.allowed_identity_actions.length === 0 ? (
        <p className="reference-muted">
          The owner exposes no identity action for this item.
        </p>
      ) : (
        <>
          <fieldset className="reference-disposition-options">
            <legend>Owner-allowed identity action</legend>
            {item.allowed_identity_actions.map((action) => (
              <label key={action}>
                <input
                  type="radio"
                  name={`identity-disposition-${item.selection.selection_id}`}
                  checked={disposition === action}
                  onChange={() => {
                    invalidateConsequence();
                    setDisposition(action);
                  }}
                />
                <span>{identityDispositionLabels[action]}</span>
              </label>
            ))}
          </fieldset>

          {needsTarget ? (
            <label className="reference-field">
              <span>Exact existing authority target</span>
              <select
                value={targetStateId}
                onChange={(event) => {
                  invalidateConsequence();
                  setTargetStateId(event.target.value);
                }}
              >
                <option value="">Select an owner-projected authority</option>
                {queue.active_authorities.map((authority) => (
                  <option
                    value={authority.state_projection_id}
                    key={authority.state_projection_id}
                  >
                    {authority.active_citekey} ·{" "}
                    {shortId(authority.state_projection_id)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {accepting ? (
            <div className="reference-form-grid">
              <label className="reference-field">
                <span>Canonical citekey</span>
                <input
                  value={canonicalCitekey}
                  onChange={(event) => {
                    invalidateConsequence();
                    setCanonicalCitekey(event.target.value);
                  }}
                  maxLength={200}
                />
              </label>
              <label className="reference-field">
                <span>Alias citekeys · comma or line separated</span>
                <textarea
                  value={aliasText}
                  onChange={(event) => {
                    invalidateConsequence();
                    setAliasText(event.target.value);
                  }}
                  rows={2}
                />
              </label>
            </div>
          ) : null}

          {item.record_matches.length ? (
            <fieldset className="reference-match-selection">
              <legend>Record observations bound to this decision</legend>
              {item.record_matches.map((match) => (
                <label key={match.record_id}>
                  <input
                    type="checkbox"
                    checked={selectedMatches.has(match.record_id)}
                    onChange={() => {
                      invalidateConsequence();
                      setSelectedMatches((current) => {
                        const next = new Set(current);
                        if (next.has(match.record_id)) next.delete(match.record_id);
                        else next.add(match.record_id);
                        return next;
                      });
                    }}
                  />
                  <span>
                    <strong>{match.citekey}</strong>
                    <small>{recordMatchLabels[match.kind]}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}

          {item.current_identity_decisions.length ? (
            <label className="reference-field">
              <span>Expected current identity-decision head</span>
              <select
                value={currentDecisionId}
                onChange={(event) => {
                  invalidateConsequence();
                  setCurrentDecisionId(event.target.value);
                }}
              >
                <option value="">No current head</option>
                {item.current_identity_decisions.map((head) => (
                  <option value={head.decision_id} key={head.decision_id}>
                    {head.decision} · {head.decided_at}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <button
            className="button button--secondary"
            type="button"
            disabled={!canPreview || preview.isPending || decision.isPending}
            onClick={requestPreview}
          >
            {preview.isPending
              ? "Generating owner preview…"
              : "Preview identity consequences"}
          </button>

          {preview.data ? (
            <section
              className={`reference-owner-preview${previewIsCurrent ? "" : " reference-owner-preview--stale"}`}
              aria-label="Owner-generated identity preview"
            >
              <header>
                <div>
                  <p className="eyebrow">Owner-generated preview</p>
                  <h4>{identityDispositionLabels[preview.data.disposition]}</h4>
                </div>
                <span>{previewIsCurrent ? "Current" : "Invalidated"}</span>
              </header>
              <dl>
                <div>
                  <dt>Canonical citekey</dt>
                  <dd>{preview.data.canonical_citekey ?? "None"}</dd>
                </div>
                <div>
                  <dt>Target authority</dt>
                  <dd>
                    <code>{preview.data.target_state_projection_id ?? "None"}</code>
                  </dd>
                </div>
                <div>
                  <dt>Aliases</dt>
                  <dd>{preview.data.alias_citekeys.join(", ") || "None"}</dd>
                </div>
                <div>
                  <dt>Bound record matches</dt>
                  <dd>{preview.data.selected_record_match_ids.join(", ") || "None"}</dd>
                </div>
                <div>
                  <dt>Expected current head</dt>
                  <dd>
                    <code>{preview.data.expected_current_decision_id ?? "None"}</code>
                  </dd>
                </div>
                <div>
                  <dt>Queue / item revision</dt>
                  <dd>
                    <code>
                      {preview.data.queue_id} · {preview.data.item_revision_id}
                    </code>
                  </dd>
                </div>
                <div>
                  <dt>Selection</dt>
                  <dd>
                    <code>{preview.data.selection_id}</code>
                  </dd>
                </div>
                <div>
                  <dt>Preview request</dt>
                  <dd>
                    <code>{preview.data.request_id}</code>
                  </dd>
                </div>
                <div>
                  <dt>Preview</dt>
                  <dd>
                    <code>{preview.data.preview_id}</code>
                  </dd>
                </div>
                <div>
                  <dt>Preview result</dt>
                  <dd>
                    <code>{preview.data.result_id}</code>
                  </dd>
                </div>
              </dl>
            </section>
          ) : null}

          <label className="reference-field">
            <span>Decision rationale</span>
            <textarea
              value={rationale}
              onChange={(event) => {
                invalidateConsequence();
                setRationale(event.target.value);
              }}
              maxLength={4096}
              rows={3}
            />
          </label>
          <div className="reference-confirm-row">
            <p>
              Identity acceptance does not authorize source bytes. Confirmation binds
              the exact current owner preview.
            </p>
            <button
              className="button button--primary"
              type="button"
              disabled={!previewIsCurrent || !rationale.trim() || decision.isPending}
              onClick={confirmDecision}
            >
              {decision.isPending
                ? "Recording identity decision…"
                : frozenRequest && decision.isError
                  ? "Retry exact identity request"
                  : "Confirm identity decision"}
            </button>
          </div>
        </>
      )}

      {preview.isError ? (
        <div className="reference-error" role="alert">
          <p>{courseReferenceError(preview.error, "preview")}</p>
          {isFreshnessFailure(preview.error) ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["course-references", courseId],
                })
              }
            >
              Reload owner queue
            </button>
          ) : null}
        </div>
      ) : null}
      {decision.isError ? (
        <div className="reference-error" role="alert">
          <p>{courseReferenceError(decision.error, "decision")}</p>
          {isFreshnessFailure(decision.error) ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["course-references", courseId],
                })
              }
            >
              Reload owner queue
            </button>
          ) : null}
        </div>
      ) : null}
      {decision.data ? (
        <>
          <Receipt receipt={decision.data} />
          {onNext ? (
            <button className="button button--secondary" type="button" onClick={onNext}>
              Next queue item
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

type AssetDraft = Record<
  string,
  { disposition: CourseReferenceAssetDisposition | ""; rationale: string }
>;

function initialAssetDraft(item: CourseReferenceItem): AssetDraft {
  return Object.fromEntries(
    item.assets.map((asset) => [
      asset.asset_observation_id,
      { disposition: "", rationale: "" },
    ]),
  );
}

function AssetDecisionPanel({
  courseId,
  queue,
  item,
  onStateChange,
  onNext,
}: {
  courseId: string;
  queue: CourseReferenceQueue;
  item: CourseReferenceItem;
  onStateChange: (state: ReferenceDraftState) => void;
  onNext?: () => void;
}) {
  const queryClient = useQueryClient();
  const [disposition, setDisposition] = useState<CourseReferenceAssetDisposition | "">(
    "",
  );
  const [competitors, setCompetitors] = useState<AssetDraft>(() =>
    initialAssetDraft(item),
  );
  const [rationale, setRationale] = useState("");
  const [frozenRequest, setFrozenRequest] =
    useState<CourseReferenceAssetDecisionRequest | null>(null);
  const authority = item.active_authority;

  const preview = useMutation({
    mutationFn: (request: CourseReferenceAssetPreviewRequest) =>
      apiClient.previewCourseReferenceAsset(
        courseId,
        item.selection.selection_id,
        request,
      ),
  });
  const decision = useMutation({
    mutationFn: (request: CourseReferenceAssetDecisionRequest) =>
      apiClient.decideCourseReferenceAsset(
        courseId,
        item.selection.selection_id,
        request,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["course-references", courseId],
      });
    },
    onError: async (error) => {
      if (isFreshnessFailure(error)) {
        preview.reset();
        setFrozenRequest(null);
        await queryClient.invalidateQueries({
          queryKey: ["course-references", courseId],
        });
      }
    },
  });

  useEffect(() => {
    setCompetitors(initialAssetDraft(item));
    setDisposition("");
    setRationale("");
    setFrozenRequest(null);
    preview.reset();
    decision.reset();
  }, [item.selection.selection_id]);

  useEffect(() => {
    preview.reset();
    setFrozenRequest(null);
  }, [queue.queue_id, item.item_revision_id, authority?.state_projection_id]);

  const competitorRequests = item.assets.map((asset) => ({
    asset_observation_id: asset.asset_observation_id,
    disposition: competitors[asset.asset_observation_id]?.disposition,
    rationale: competitors[asset.asset_observation_id]?.rationale.trim() ?? "",
  }));
  const competitorsComplete = competitorRequests.every(
    (value) => value.disposition && value.rationale,
  );
  const hasDraft = Boolean(
    disposition ||
    rationale ||
    competitorRequests.some((value) => value.disposition || value.rationale),
  );
  const previewRequest: CourseReferenceAssetPreviewRequest | null =
    disposition && authority && competitorsComplete
      ? {
          expected_queue_id: queue.queue_id,
          expected_item_revision_id: item.item_revision_id,
          expected_identity_state_projection_id: authority.state_projection_id,
          disposition,
          competitors: competitorRequests.map((value) => ({
            ...value,
            disposition: value.disposition as CourseReferenceAssetDisposition,
          })),
          expected_current_decision_id:
            item.current_asset_decision?.decision_id ?? null,
        }
      : null;
  const previewIsCurrent = Boolean(
    preview.data &&
    previewRequest &&
    assetPreviewMatches(preview.data, previewRequest, item.selection.selection_id),
  );

  useEffect(() => {
    onStateChange({
      dirty: hasDraft && !decision.isSuccess,
      busy: preview.isPending || decision.isPending,
    });
  }, [
    decision.isPending,
    decision.isSuccess,
    hasDraft,
    onStateChange,
    preview.isPending,
  ]);

  function invalidateConsequence() {
    preview.reset();
    decision.reset();
    setFrozenRequest(null);
  }

  function confirmDecision() {
    if (!preview.data || !previewRequest || !previewIsCurrent || !rationale.trim())
      return;
    const request: CourseReferenceAssetDecisionRequest = frozenRequest ?? {
      ...previewRequest,
      expected_preview_id: preview.data.preview_id,
      expected_preview_result_id: preview.data.result_id,
      expected_asset_plan_id: preview.data.plan_id,
      idempotency_key: crypto.randomUUID(),
      rationale: rationale.trim(),
      decided_at: utcSecond(),
    };
    if (!frozenRequest) setFrozenRequest(request);
    decision.mutate(request);
  }

  if (!authority || item.allowed_asset_actions.length === 0) {
    return (
      <section
        className="reference-decision-panel"
        aria-labelledby="asset-decision-heading"
      >
        <div className="reference-authority-section__heading">
          <div>
            <p className="eyebrow">Step 2 · Canonical asset</p>
            <h3 id="asset-decision-heading">Asset authority follows identity</h3>
          </div>
        </div>
        <p className="reference-muted">
          Record or reload an accepted identity authority before the owner exposes asset
          actions.
        </p>
      </section>
    );
  }

  return (
    <section
      className="reference-decision-panel"
      aria-labelledby="asset-decision-heading"
    >
      <div className="reference-authority-section__heading">
        <div>
          <p className="eyebrow">Step 2 · Canonical asset</p>
          <h3 id="asset-decision-heading">Preview and record asset authority</h3>
        </div>
        <span>{item.allowed_asset_actions.length} allowed actions</span>
      </div>
      <fieldset className="reference-disposition-options">
        <legend>Owner-allowed asset action</legend>
        {item.allowed_asset_actions.map((action) => (
          <label key={action}>
            <input
              type="radio"
              name={`asset-disposition-${item.selection.selection_id}`}
              checked={disposition === action}
              onChange={() => {
                invalidateConsequence();
                setDisposition(action);
              }}
            />
            <span>{assetDispositionLabels[action]}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="reference-asset-decisions">
        <legend>Explicit disposition for every asset competitor</legend>
        {item.assets.map((asset, index) => {
          const draft = competitors[asset.asset_observation_id] ?? {
            disposition: "",
            rationale: "",
          };
          return (
            <article key={asset.asset_observation_id}>
              <strong>
                Asset {index + 1} · {asset.runtime_availability} ·{" "}
                {formatBytes(asset.byte_size)}
              </strong>
              <code>{shortId(asset.asset_observation_id)}</code>
              <label>
                <span>Competitor disposition</span>
                <select
                  value={draft.disposition}
                  onChange={(event) => {
                    invalidateConsequence();
                    setCompetitors((current) => ({
                      ...current,
                      [asset.asset_observation_id]: {
                        ...draft,
                        disposition: event.target
                          .value as CourseReferenceAssetDisposition,
                      },
                    }));
                  }}
                >
                  <option value="">Choose explicitly</option>
                  {Object.entries(assetDispositionLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Competitor rationale</span>
                <textarea
                  value={draft.rationale}
                  onChange={(event) => {
                    invalidateConsequence();
                    setCompetitors((current) => ({
                      ...current,
                      [asset.asset_observation_id]: {
                        ...draft,
                        rationale: event.target.value,
                      },
                    }));
                  }}
                  maxLength={4096}
                  rows={2}
                />
              </label>
            </article>
          );
        })}
      </fieldset>
      <button
        className="button button--secondary"
        type="button"
        disabled={!previewRequest || preview.isPending || decision.isPending}
        onClick={() => {
          if (previewRequest) {
            decision.reset();
            setFrozenRequest(null);
            preview.mutate(previewRequest);
          }
        }}
      >
        {preview.isPending ? "Generating owner preview…" : "Preview asset consequences"}
      </button>
      {preview.data ? (
        <section
          className={`reference-owner-preview${previewIsCurrent ? "" : " reference-owner-preview--stale"}`}
          aria-label="Owner-generated asset preview"
        >
          <header>
            <div>
              <p className="eyebrow">Owner-generated preview</p>
              <h4>{assetDispositionLabels[preview.data.disposition]}</h4>
            </div>
            <span>{previewIsCurrent ? "Current" : "Invalidated"}</span>
          </header>
          <dl>
            <div>
              <dt>Selected canonical asset</dt>
              <dd>
                <code>{preview.data.selected_asset_observation_id ?? "None"}</code>
              </dd>
            </div>
            <div>
              <dt>Competitor consequences</dt>
              <dd>{preview.data.competitors.length}</dd>
            </div>
            <div>
              <dt>Expected current head</dt>
              <dd>
                <code>{preview.data.expected_current_decision_id ?? "None"}</code>
              </dd>
            </div>
            <div>
              <dt>Queue / item revision</dt>
              <dd>
                <code>
                  {preview.data.queue_id} · {preview.data.item_revision_id}
                </code>
              </dd>
            </div>
            <div>
              <dt>Selection</dt>
              <dd>
                <code>{preview.data.selection_id}</code>
              </dd>
            </div>
            <div>
              <dt>Preview request</dt>
              <dd>
                <code>{preview.data.request_id}</code>
              </dd>
            </div>
            <div>
              <dt>Identity projection</dt>
              <dd>
                <code>{preview.data.identity_state_projection_id}</code>
              </dd>
            </div>
            <div>
              <dt>Owner asset plan</dt>
              <dd>
                <code>{preview.data.plan_id}</code>
              </dd>
            </div>
            <div>
              <dt>Preview</dt>
              <dd>
                <code>{preview.data.preview_id}</code>
              </dd>
            </div>
            <div>
              <dt>Preview result</dt>
              <dd>
                <code>{preview.data.result_id}</code>
              </dd>
            </div>
          </dl>
          <ol>
            {preview.data.competitors.map((value) => (
              <li key={value.asset_observation_id}>
                <code>{value.asset_observation_id}</code> ·{" "}
                <strong>{value.disposition}</strong> · {value.rationale}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <label className="reference-field">
        <span>Overall asset-decision rationale</span>
        <textarea
          value={rationale}
          onChange={(event) => {
            invalidateConsequence();
            setRationale(event.target.value);
          }}
          maxLength={4096}
          rows={3}
        />
      </label>
      <div className="reference-confirm-row">
        <p>
          Confirmation binds the refreshed identity projection, complete asset plan, and
          exact owner preview.
        </p>
        <button
          className="button button--primary"
          type="button"
          disabled={!previewIsCurrent || !rationale.trim() || decision.isPending}
          onClick={confirmDecision}
        >
          {decision.isPending
            ? "Recording asset decision…"
            : frozenRequest && decision.isError
              ? "Retry exact asset request"
              : "Confirm asset decision"}
        </button>
      </div>
      {preview.isError ? (
        <div className="reference-error" role="alert">
          <p>{courseReferenceError(preview.error, "preview")}</p>
          {isFreshnessFailure(preview.error) ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["course-references", courseId],
                })
              }
            >
              Reload owner queue
            </button>
          ) : null}
        </div>
      ) : null}
      {decision.isError ? (
        <div className="reference-error" role="alert">
          <p>{courseReferenceError(decision.error, "decision")}</p>
          {isFreshnessFailure(decision.error) ? (
            <button
              type="button"
              className="button button--secondary"
              onClick={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["course-references", courseId],
                })
              }
            >
              Reload owner queue
            </button>
          ) : null}
        </div>
      ) : null}
      {decision.data ? (
        <>
          <Receipt receipt={decision.data} />
          {onNext ? (
            <button className="button button--secondary" type="button" onClick={onNext}>
              Next queue item
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function ReferenceAuthorityWorkspace({
  courseId,
  queue,
  item,
  onDraftStateChange,
  onNext,
}: {
  courseId: string;
  queue: CourseReferenceQueue;
  item: CourseReferenceItem;
  onDraftStateChange: (state: ReferenceDraftState) => void;
  onNext?: () => void;
}) {
  const [identityState, setIdentityState] = useState<ReferenceDraftState>({
    dirty: false,
    busy: false,
  });
  const [assetState, setAssetState] = useState<ReferenceDraftState>({
    dirty: false,
    busy: false,
  });
  const stableIdentityState = useMemo(
    () => identityState,
    [identityState.busy, identityState.dirty],
  );
  const stableAssetState = useMemo(
    () => assetState,
    [assetState.busy, assetState.dirty],
  );

  useEffect(() => {
    onDraftStateChange({
      dirty: stableIdentityState.dirty || stableAssetState.dirty,
      busy: stableIdentityState.busy || stableAssetState.busy,
    });
  }, [onDraftStateChange, stableAssetState, stableIdentityState]);

  return (
    <article className="reference-workspace">
      <header className="reference-workspace__header">
        <div>
          <p className="eyebrow">
            Selection {item.selection.ordinal} of {queue.scope.total}
          </p>
          <h2>
            <code>{item.selection.display_citekey}</code>
          </h2>
          <span>{item.selection.origin.replaceAll("-", " ")}</span>
        </div>
        <span
          className={`reference-resolution reference-resolution--${item.resolution}`}
        >
          {resolutionLabels[item.resolution]}
        </span>
      </header>
      <MetadataAndEvidence item={item} />
      <IdentityDecisionPanel
        courseId={courseId}
        queue={queue}
        item={item}
        onStateChange={setIdentityState}
        onNext={onNext}
      />
      <AssetDecisionPanel
        courseId={courseId}
        queue={queue}
        item={item}
        onStateChange={setAssetState}
        onNext={onNext}
      />
    </article>
  );
}
