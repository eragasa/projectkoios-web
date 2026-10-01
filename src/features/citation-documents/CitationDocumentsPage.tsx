import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  ApiError,
  apiClient,
  type CitationDocumentCatalog,
  type CitationDocumentItem,
  type CitationDocumentProcessResponse,
  type CitationDocumentReceipt,
  type CitationDocumentSourceGap,
} from "../../api/client";
import { usePageMetadata } from "../../app/usePageMetadata";
import { DisclosurePanel } from "../../components/DisclosurePanel";
import { ReviewPageHeader, ReviewProgress } from "../../components/ReviewPageHeader";

const MAX_PDF_BYTES = 50_000_000;

type BibliographyStatus = CitationDocumentItem["bibliography_membership_status"];
type DocumentStatus = CitationDocumentItem["document_status"];
type IdentityStatus = CitationDocumentItem["identity_items"][number]["status"];
type KeyResolutionStatus = CitationDocumentItem["key_resolution_status"];
type TechnicalStatus = CitationDocumentItem["technical_ingestion_statuses"][number];

type FilterValue<T extends string> = "ALL" | T;

const bibliographyLabels: Record<BibliographyStatus, string> = {
  defined: "Defined",
  undefined: "Undefined",
  "not-evaluated": "Not evaluated",
};

const keyResolutionLabels: Record<KeyResolutionStatus, string> = {
  resolved: "Resolved",
  ambiguous: "Ambiguous",
  unresolved: "Unresolved",
};

const identityLabels: Record<IdentityStatus, string> = {
  "accepted-active-canonical": "Accepted active canonical identity",
  "accepted-without-active-citekey": "Accepted without active citekey",
  "candidate-proposed-noncanonical": "Candidate proposed noncanonical identity",
  "inactive-superseded": "Inactive superseded identity",
  unresolved: "Unresolved identity",
};

const documentLabels: Record<DocumentStatus, string> = {
  "not-evaluated": "Not evaluated",
  "not-observed": "Missing",
  "available-unverified-linkage": "Available · linkage unverified",
  "available-linked": "Attached",
  ambiguous: "Ambiguous",
  inaccessible: "Inaccessible",
};

const technicalLabels: Record<TechnicalStatus, string> = {
  NOT_REQUESTED: "Not requested",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  INDETERMINATE: "Indeterminate · reconciliation required",
};

const documentOptions = Object.entries(documentLabels) as [DocumentStatus, string][];
const bibliographyOptions = Object.entries(bibliographyLabels) as [
  BibliographyStatus,
  string,
][];
const keyResolutionOptions = Object.entries(keyResolutionLabels) as [
  KeyResolutionStatus,
  string,
][];

function errorMessage(error: Error, operation: "catalog" | "upload" | "process") {
  if (!(error instanceof ApiError)) {
    return operation === "catalog"
      ? "The citation-document catalog could not be loaded."
      : "The citation-document request could not be completed.";
  }

  switch (error.code) {
    case "CITATION_DOCUMENT_INVALID_REQUEST":
      return "The bounded citation-document request was rejected.";
    case "CITATION_DOCUMENT_ITEM_NOT_FOUND":
      return "This citation item is no longer in the current catalog.";
    case "CITATION_DOCUMENT_PROJECTION_CONFLICT":
      return "The citation catalog changed. Refresh it before continuing.";
    case "CITATION_DOCUMENT_PDF_TOO_LARGE":
      return "The PDF exceeds the 50,000,000-byte private receipt limit.";
    case "CITATION_DOCUMENT_UNSUPPORTED_MEDIA_TYPE":
      return "The source was rejected because it is not a valid PDF request.";
    case "CITATION_DOCUMENT_OWNER_MALFORMED":
      return "The citation-document owner returned an invalid projection.";
    case "CITATION_DOCUMENT_OWNER_UNAVAILABLE":
      return "The citation-document owner is currently unavailable.";
    case "CITATION_DOCUMENT_OWNER_FAILURE":
      return "The citation-document owner failed without recording success.";
    default:
      return operation === "catalog"
        ? "The citation-document catalog is unavailable."
        : "The citation-document request failed.";
  }
}

function CitationCatalogError({ error }: { error: Error }) {
  return (
    <div className="empty-state" role="alert">
      <h2>Citation-document catalog unavailable</h2>
      <p>{errorMessage(error, "catalog")}</p>
    </div>
  );
}

function StatusValue({ children }: { children: React.ReactNode }) {
  return <span className="citation-document-status-value">{children}</span>;
}

function IdentityStatusList({ item }: { item: CitationDocumentItem }) {
  if (item.identity_items.length === 0) {
    return <StatusValue>No identity items</StatusValue>;
  }
  return (
    <ul className="citation-document-inline-statuses">
      {item.identity_items.map((identity) => (
        <li key={identity.item_id}>{identityLabels[identity.status]}</li>
      ))}
    </ul>
  );
}

function TechnicalStatusList({ item }: { item: CitationDocumentItem }) {
  return (
    <ul className="citation-document-inline-statuses">
      {item.technical_ingestion_statuses.map((status, index) => (
        <li key={`${item.item_id}-technical-${index}`}>{technicalLabels[status]}</li>
      ))}
    </ul>
  );
}

function CitationStatusGrid({ item }: { item: CitationDocumentItem }) {
  return (
    <dl
      className="citation-document-status-grid"
      aria-label={`Orthogonal status for ${item.literal_citekey}`}
    >
      <div>
        <dt>Bibliography membership</dt>
        <dd>
          <StatusValue>
            {bibliographyLabels[item.bibliography_membership_status]}
          </StatusValue>
        </dd>
      </div>
      <div>
        <dt>Key resolution</dt>
        <dd>
          <StatusValue>{keyResolutionLabels[item.key_resolution_status]}</StatusValue>
        </dd>
      </div>
      <div>
        <dt>Reference identity</dt>
        <dd>
          <IdentityStatusList item={item} />
        </dd>
      </div>
      <div>
        <dt>Document availability</dt>
        <dd>
          <StatusValue>{documentLabels[item.document_status]}</StatusValue>
        </dd>
      </div>
      <div>
        <dt>Private receipt evidence</dt>
        <dd>
          <StatusValue>
            {item.private_receipt_status === "RECEIVED" ? "Received" : "Not received"}
          </StatusValue>
        </dd>
      </div>
      <div>
        <dt>Private processing admission</dt>
        <dd>
          <StatusValue>
            {item.private_processing_admission_status === "AUTHORIZED"
              ? "Authorized"
              : "Not authorized"}
          </StatusValue>
        </dd>
      </div>
      <div>
        <dt>Technical ingestion</dt>
        <dd>
          <TechnicalStatusList item={item} />
        </dd>
      </div>
      <div>
        <dt>Transcript</dt>
        <dd>
          <StatusValue>
            {item.transcript_status === "AUTOMATED_UNREVIEWED"
              ? "Available · Automated · unreviewed"
              : "Not available"}
          </StatusValue>
        </dd>
      </div>
      <div>
        <dt>Search indexing</dt>
        <dd>
          <StatusValue>Not evaluated</StatusValue>
        </dd>
      </div>
      <div>
        <dt>Human / scientific acceptance</dt>
        <dd>
          <StatusValue>Not evaluated</StatusValue>
        </dd>
      </div>
    </dl>
  );
}

function ItemEvidence({ item }: { item: CitationDocumentItem }) {
  return (
    <div className="citation-document-evidence">
      <DisclosurePanel
        summary={`${item.occurrence_ids.length} manuscript ${item.occurrence_ids.length === 1 ? "occurrence" : "occurrences"}`}
      >
        <ol aria-label={`Manuscript occurrences for ${item.literal_citekey}`}>
          {item.occurrence_ids.map((occurrenceId, index) => (
            <li key={`${item.item_id}-occurrence-${index}`}>
              <code>{occurrenceId}</code>
            </li>
          ))}
        </ol>
      </DisclosurePanel>

      <DisclosurePanel summary={`${item.identity_items.length} identity items`}>
        {item.identity_items.length === 0 ? (
          <p>No identity items were projected for this unresolved key.</p>
        ) : (
          <dl className="citation-document-identity-list">
            {item.identity_items.map((identity) => (
              <div key={identity.item_id}>
                <dt>{identityLabels[identity.status]}</dt>
                <dd>
                  <code>{identity.item_id}</code>
                </dd>
              </div>
            ))}
          </dl>
        )}
      </DisclosurePanel>

      {item.processing_results.length > 0 ? (
        <DisclosurePanel
          summary={`${item.processing_results.length} terminal processing results`}
        >
          <ol className="citation-document-processing-results">
            {item.processing_results.map((result) => (
              <li key={result.result_id}>
                <strong>{technicalLabels[result.status]}</strong>
                {result.failure_code ? <span>{result.failure_code}</span> : null}
                <code>{result.result_id}</code>
              </li>
            ))}
          </ol>
        </DisclosurePanel>
      ) : null}
    </div>
  );
}

function TerminalResult({ result }: { result: CitationDocumentProcessResponse }) {
  if (result.status === "SUCCEEDED") {
    return (
      <div
        className="citation-document-terminal citation-document-terminal--success"
        role="status"
      >
        <strong>Private processing succeeded.</strong>
        <p>
          The catalog is refreshing before transcript navigation is enabled. The
          transcript remains automated and unreviewed.
        </p>
      </div>
    );
  }
  if (result.status === "INDETERMINATE") {
    return (
      <div
        className="citation-document-terminal citation-document-terminal--warning"
        role="alert"
      >
        <strong>Processing outcome indeterminate · reconciliation required.</strong>
        <p>
          Publication may be partial or unknown. No transcript, retry, overwrite, or
          repair action is available here.
        </p>
        {result.failure_code ? <span>{result.failure_code}</span> : null}
      </div>
    );
  }
  return (
    <div
      className="citation-document-terminal citation-document-terminal--error"
      role="alert"
    >
      <strong>Private processing failed.</strong>
      <p>No transcript or automatic retry was inferred from this terminal result.</p>
      {result.failure_code ? <span>{result.failure_code}</span> : null}
    </div>
  );
}

function CitationDocumentActions({
  item,
  projectionId,
}: {
  item: CitationDocumentItem;
  projectionId: string;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: (selectedFile: File) =>
      apiClient.provideCitationDocumentSource(item.item_id, selectedFile),
    onSuccess: () => {
      setFile(null);
      setFileInputKey((value) => value + 1);
    },
  });
  const process = useMutation({
    mutationFn: (request: {
      receipt: CitationDocumentReceipt;
      identityItemId: string;
    }) =>
      apiClient.processCitationDocumentPrivately(item.item_id, {
        expected_projection_id: projectionId,
        identity_item_id: request.identityItemId,
        receipt: request.receipt,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["citation-documents"] });
    },
  });

  const receipt = upload.data;
  const terminalReflected = Boolean(
    process.data &&
    item.processing_results.some(
      (result) => result.result_id === process.data?.result_id,
    ),
  );
  const activeActions =
    process.data && !terminalReflected
      ? []
      : receipt && !process.data
        ? receipt.allowed_actions
        : item.allowed_actions;
  const canProvide = activeActions.includes("PROVIDE_PDF");
  const canProcess = activeActions.includes("PROCESS_PRIVATELY");
  const canOpenTranscript = activeActions.includes("OPEN_TRANSCRIPT");

  function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    upload.reset();
    process.reset();
    if (!file) {
      setLocalError("Choose a PDF to receive privately.");
      return;
    }
    if (file.size < 5) {
      setLocalError("The PDF request body must contain at least 5 bytes.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setLocalError("The PDF exceeds the 50,000,000-byte private receipt limit.");
      return;
    }
    upload.mutate(file);
  }

  function processPrivately() {
    if (!receipt || !canProcess) return;
    const identityItem =
      item.identity_items.length === 1 ? item.identity_items[0] : null;
    if (!identityItem) {
      setLocalError("Private processing requires one exact owner identity item.");
      return;
    }
    setLocalError(null);
    process.mutate({ receipt, identityItemId: identityItem.item_id });
  }

  return (
    <section
      className="citation-document-actions"
      aria-label={`Available actions for ${item.literal_citekey}`}
      aria-busy={upload.isPending || process.isPending}
    >
      {canProvide ? (
        <form onSubmit={submitUpload} className="citation-document-upload">
          <label>
            <span>PDF for {item.literal_citekey}</span>
            <input
              key={fileInputKey}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setLocalError(null);
                upload.reset();
              }}
            />
          </label>
          <div>
            <p>
              Receipt stores exact PDF bytes privately. It does not link, admit,
              process, index, review, or accept the source.
            </p>
            <button
              type="submit"
              className="button button--primary"
              disabled={!file || upload.isPending}
            >
              {upload.isPending ? "Receiving PDF…" : "Provide PDF"}
            </button>
          </div>
        </form>
      ) : null}

      {receipt ? (
        <div className="citation-document-receipt" role="status">
          <strong>PDF received privately.</strong>
          <p>
            Receipt only: the source is not yet admitted, processed, indexed, reviewed,
            or accepted.
          </p>
          <code>{receipt.receipt_id}</code>
        </div>
      ) : null}

      {canProcess ? (
        <div className="citation-document-process">
          <div>
            <strong>Separate private processing command</strong>
            <p>
              Uses configured local-operator authority and admission. This does not
              prove an authenticated remote user and returns one terminal result.
            </p>
          </div>
          <button
            className="button button--primary"
            type="button"
            disabled={process.isPending}
            onClick={processPrivately}
          >
            {process.isPending ? "Processing privately…" : "Process privately"}
          </button>
        </div>
      ) : null}

      {process.isPending ? (
        <p className="citation-document-local-pending" role="status">
          This browser request is pending. No queued or running owner state is claimed.
        </p>
      ) : null}

      {canOpenTranscript && item.transcript_document_id ? (
        <Link
          className="button button--primary citation-document-transcript-link"
          to={`/control/transcripts/${encodeURIComponent(item.transcript_document_id)}`}
        >
          Open automated transcript
        </Link>
      ) : null}

      {process.data ? <TerminalResult result={process.data} /> : null}
      {localError ? (
        <p className="error-message" role="alert">
          {localError}
        </p>
      ) : null}
      {upload.isError ? (
        <p className="error-message" role="alert">
          {errorMessage(upload.error, "upload")}
        </p>
      ) : null}
      {process.isError ? (
        <p className="error-message" role="alert">
          {errorMessage(process.error, "process")}
        </p>
      ) : null}
    </section>
  );
}

function CitationDocumentCard({
  item,
  projectionId,
}: {
  item: CitationDocumentItem;
  projectionId: string;
}) {
  return (
    <article className="citation-document-card">
      <header>
        <div>
          <p className="eyebrow">Literal manuscript citekey</p>
          <h2>
            <code>{item.literal_citekey}</code>
          </h2>
        </div>
        <span>{item.occurrence_ids.length} occurrences</span>
      </header>
      <CitationStatusGrid item={item} />
      <ItemEvidence item={item} />
      <CitationDocumentActions item={item} projectionId={projectionId} />
    </article>
  );
}

function SourceGaps({ gaps }: { gaps: CitationDocumentSourceGap[] }) {
  if (gaps.length === 0) return null;
  return (
    <section className="citation-source-gaps" aria-labelledby="source-gaps-heading">
      <div className="review-section-heading">
        <div>
          <p className="eyebrow">Separate from citation keys</p>
          <h2 id="source-gaps-heading">No-key source gaps</h2>
        </div>
        <span>{gaps.length} placeholders</span>
      </div>
      <p>
        These source requests have no literal citation key. They are not undefined
        bibliography entries and cannot receive a PDF from this catalog.
      </p>
      <ol>
        {gaps.map((gap) => (
          <li key={gap.source_gap_id}>
            <strong>{gap.placeholder_identifier}</strong>
            <span>
              Manuscript location {gap.source_gap_index + 1}: include index{" "}
              {gap.locator.include_index}, line {gap.locator.line}, column{" "}
              {gap.locator.column}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function CatalogProvenance({ catalog }: { catalog: CitationDocumentCatalog }) {
  const projection = catalog.projection;
  return (
    <DisclosurePanel
      className="citation-document-provenance"
      summary="Catalog provenance and limitations"
    >
      <dl>
        <div>
          <dt>Catalog result</dt>
          <dd>
            <code>{catalog.result_id}</code>
          </dd>
        </div>
        <div>
          <dt>Citation projection</dt>
          <dd>
            <code>{projection.projection_id}</code>
          </dd>
        </div>
        <div>
          <dt>Target snapshot</dt>
          <dd>
            <code>{projection.target_snapshot_id}</code>
          </dd>
        </div>
        <div>
          <dt>Identity projection</dt>
          <dd>
            <code>{projection.identity_projection_id}</code>
          </dd>
        </div>
        <div>
          <dt>Processing registry projection</dt>
          <dd>
            <code>{catalog.processing_registry_projection_id}</code>
          </dd>
        </div>
      </dl>
      {projection.limitations.length > 0 ? (
        <ul>
          {projection.limitations.map((limitation, index) => (
            <li key={`${projection.projection_id}-limitation-${index}`}>
              {limitation}
            </li>
          ))}
        </ul>
      ) : (
        <p>No catalog limitations were supplied.</p>
      )}
    </DisclosurePanel>
  );
}

export function CitationDocumentsPage() {
  usePageMetadata(
    "Citation documents",
    "Inspect manuscript citation-document coverage and perform bounded local/private source receipt and processing actions.",
  );
  const [search, setSearch] = useState("");
  const [documentStatus, setDocumentStatus] =
    useState<FilterValue<DocumentStatus>>("ALL");
  const [bibliographyStatus, setBibliographyStatus] =
    useState<FilterValue<BibliographyStatus>>("ALL");
  const [keyResolutionStatus, setKeyResolutionStatus] =
    useState<FilterValue<KeyResolutionStatus>>("ALL");
  const query = useQuery({
    queryKey: ["citation-documents"],
    queryFn: ({ signal }) => apiClient.citationDocuments(signal),
    retry: false,
  });

  const items = query.data?.projection.items ?? [];
  const visibleItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        (!needle || item.literal_citekey.toLowerCase().includes(needle)) &&
        (documentStatus === "ALL" || item.document_status === documentStatus) &&
        (bibliographyStatus === "ALL" ||
          item.bibliography_membership_status === bibliographyStatus) &&
        (keyResolutionStatus === "ALL" ||
          item.key_resolution_status === keyResolutionStatus),
    );
  }, [bibliographyStatus, documentStatus, items, keyResolutionStatus, search]);

  const transcriptCount = items.filter(
    (item) => item.transcript_status === "AUTOMATED_UNREVIEWED",
  ).length;
  const hasFilters = Boolean(
    search ||
    documentStatus !== "ALL" ||
    bibliographyStatus !== "ALL" ||
    keyResolutionStatus !== "ALL",
  );

  return (
    <div className="citation-documents-page">
      <ReviewPageHeader
        eyebrow="Control center · Local/private citation control"
        title="Citation documents"
        description="Inspect every owner-projected literal manuscript citekey, receive a missing PDF into private custody, and invoke separately authorized synchronous processing without inferring review or acceptance."
        aside={
          query.data ? (
            <ReviewProgress
              ariaLabel="Automated transcript availability"
              current={transcriptCount}
              total={items.length}
              summary="automated transcripts available"
            />
          ) : undefined
        }
      />

      <section
        className="citation-document-authority"
        aria-label="Control authority warning"
      >
        <strong>
          Local/private control only · no remote-user authentication proof
        </strong>
        <p>
          Actions rely on configured local-operator authority and admission decisions.
          Do not expose this control surface on an untrusted network. Uploading,
          processing, or reading a transcript does not establish rights, citation
          support, indexing, human review, or scientific acceptance.
        </p>
      </section>

      {query.isPending ? (
        <div className="review-loading" role="status">
          Loading citation-document catalog…
        </div>
      ) : null}

      {query.isError && !query.data ? (
        <CitationCatalogError error={query.error} />
      ) : null}

      {query.data ? (
        <>
          {query.isError ? (
            <div className="citation-document-refresh-error" role="alert">
              The latest catalog refresh failed. The last successful projection remains
              visible.
            </div>
          ) : null}

          <CatalogProvenance catalog={query.data} />

          <section
            className="citation-document-filters"
            aria-labelledby="citation-document-filters-heading"
          >
            <div>
              <h2 id="citation-document-filters-heading">Filter citations</h2>
              <p>
                Filters change only this presentation and preserve owner item order.
              </p>
            </div>
            <div className="citation-document-filter-grid">
              <label>
                <span>Literal citekey</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Filter exact citation keys"
                />
              </label>
              <label>
                <span>Document availability</span>
                <select
                  value={documentStatus}
                  onChange={(event) =>
                    setDocumentStatus(event.target.value as FilterValue<DocumentStatus>)
                  }
                >
                  <option value="ALL">All document states</option>
                  {documentOptions.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Bibliography membership</span>
                <select
                  value={bibliographyStatus}
                  onChange={(event) =>
                    setBibliographyStatus(
                      event.target.value as FilterValue<BibliographyStatus>,
                    )
                  }
                >
                  <option value="ALL">All bibliography states</option>
                  {bibliographyOptions.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>Key resolution</span>
                <select
                  value={keyResolutionStatus}
                  onChange={(event) =>
                    setKeyResolutionStatus(
                      event.target.value as FilterValue<KeyResolutionStatus>,
                    )
                  }
                >
                  <option value="ALL">All key-resolution states</option>
                  {keyResolutionOptions.map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="citation-document-filter-summary" aria-live="polite">
              <span>
                {visibleItems.length} of {items.length} citation keys shown
              </span>
              {hasFilters ? (
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setDocumentStatus("ALL");
                    setBibliographyStatus("ALL");
                    setKeyResolutionStatus("ALL");
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </section>

          {items.length === 0 ? (
            <div className="empty-state">
              <h2>No citation keys in this catalog</h2>
              <p>The owner returned a valid empty citation inventory.</p>
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="empty-state">
              <h2>No citations match these filters</h2>
              <p>Clear or change a filter to return to the owner-ordered catalog.</p>
            </div>
          ) : (
            <section className="citation-document-list" aria-label="Citation documents">
              {visibleItems.map((item) => (
                <CitationDocumentCard
                  item={item}
                  projectionId={query.data.projection.projection_id}
                  key={item.item_id}
                />
              ))}
            </section>
          )}

          <SourceGaps gaps={query.data.projection.source_gaps} />
        </>
      ) : null}
    </div>
  );
}
