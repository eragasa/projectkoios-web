import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { apiClient, ApiError, type TranscriptPage } from "../../api/client";
import { usePageMetadata } from "../../app/usePageMetadata";
import { ReviewPageHeader } from "../../components/ReviewPageHeader";

const AUTOMATED_STATUS_LABEL = "Automated · unreviewed";

function pageCountLabel(count: number): string {
  return `${count} ${count === 1 ? "page" : "pages"}`;
}

function TranscriptStatus() {
  return (
    <span className="transcript-status">
      <span aria-hidden="true" />
      {AUTOMATED_STATUS_LABEL}
    </span>
  );
}

function TranscriptError({ error }: { error: Error }) {
  const notFound = error instanceof ApiError && error.status === 404;
  let detail = "The control API could not return this parsed transcript.";

  if (error instanceof ApiError && error.status === 502) {
    detail = "The transcript provider returned a malformed projection.";
  } else if (error instanceof ApiError && error.status === 503) {
    detail = "The transcript provider is currently unavailable.";
  }

  return (
    <div className="empty-state" role="alert">
      <h2>{notFound ? "Transcript not found" : "Transcript unavailable"}</h2>
      <p>{notFound ? "No parsed document has that opaque identity." : detail}</p>
    </div>
  );
}

function PageIdentity({ page }: { page: TranscriptPage }) {
  return (
    <dl className="transcript-page__identity" aria-label="Page identity">
      <div>
        <dt>Page ID</dt>
        <dd>
          <code>{page.page_id}</code>
        </dd>
      </div>
      <div>
        <dt>Page index</dt>
        <dd>{page.page_index}</dd>
      </div>
      <div>
        <dt>Physical page</dt>
        <dd>{page.physical_page}</dd>
      </div>
      <div>
        <dt>Printed label</dt>
        <dd className="transcript-page__printed-label">
          {page.printed_page_label ?? "Not supplied"}
        </dd>
      </div>
    </dl>
  );
}

function TranscriptText({ page }: { page: TranscriptPage }) {
  return (
    <div className="transcript-page__text">
      {page.text.length === 0 ? (
        <p className="transcript-page__empty-note">
          This page has empty transcript text.
        </p>
      ) : null}
      <pre aria-label={`Exact transcript text for physical page ${page.physical_page}`}>
        {page.text}
      </pre>
    </div>
  );
}

export function TranscriptCatalogPage() {
  usePageMetadata(
    "Parsed transcripts",
    "Open a parsed document and read its exact automated, unreviewed transcript in owner-provided page order.",
  );
  const query = useQuery({
    queryKey: ["transcripts"],
    queryFn: ({ signal }) => apiClient.transcripts(signal),
    retry: false,
  });

  return (
    <div className="transcript-page">
      <ReviewPageHeader
        eyebrow="Control center · Read only"
        title="Parsed transcripts"
        description="Open one parsed document to read its exact transcript in the page order supplied by the document owner. No review or acceptance capability is available here."
        aside={
          <div className="transcript-authority-card" aria-label="Transcript boundary">
            <span>Authority</span>
            <strong>Parsed document owner</strong>
            <small>Read only</small>
          </div>
        }
      />

      {query.isPending ? (
        <div className="review-loading" role="status">
          Loading parsed documents…
        </div>
      ) : null}

      {query.isError ? <TranscriptError error={query.error} /> : null}

      {query.data?.documents.length === 0 ? (
        <div className="empty-state">
          <h2>No parsed documents available</h2>
          <p>The transcript provider returned an empty document catalog.</p>
        </div>
      ) : null}

      {query.data && query.data.documents.length > 0 ? (
        <div className="transcript-document-list" aria-label="Parsed documents">
          {query.data.documents.map((document) => (
            <article className="transcript-document-card" key={document.document_id}>
              <header>
                <TranscriptStatus />
                <span>{pageCountLabel(document.physical_page_count)}</span>
              </header>
              <h2>{document.display_name}</h2>
              <p>
                Document ID <code>{document.document_id}</code>
              </p>
              <Link
                className="button button--primary"
                to={`/control/transcripts/${encodeURIComponent(document.document_id)}`}
              >
                Open exact transcript
              </Link>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TranscriptDocumentPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const query = useQuery({
    queryKey: ["transcript", documentId],
    queryFn: ({ signal }) => apiClient.transcript(documentId!, signal),
    enabled: documentId !== undefined,
    retry: false,
  });
  const title = query.data?.display_name ?? "Parsed transcript";
  usePageMetadata(
    title,
    "Exact page-ordered text from an automated, unreviewed parsed document.",
  );

  return (
    <div className="transcript-page transcript-document-page">
      <nav className="transcript-back" aria-label="Transcript navigation">
        <Link to="/control/transcripts">← All parsed documents</Link>
      </nav>

      {query.isPending ? (
        <div className="review-loading" role="status">
          Loading exact transcript…
        </div>
      ) : null}

      {query.isError ? <TranscriptError error={query.error} /> : null}

      {query.data ? (
        <>
          <ReviewPageHeader
            eyebrow="Exact page-ordered transcript"
            title={query.data.display_name}
            description={
              <>
                Document ID <code>{query.data.document_id}</code>
              </>
            }
            aside={
              <div className="transcript-document-summary">
                <TranscriptStatus />
                <strong>{pageCountLabel(query.data.physical_page_count)}</strong>
                <small>Owner order preserved</small>
              </div>
            }
          />

          <section
            className="transcript-readonly-notice"
            aria-label="Transcript status"
          >
            <strong>Automated and unreviewed</strong>
            <p>
              Text is shown exactly as returned by the parsed-document owner. Reading
              this page does not review, approve, accept, or change evidence.
            </p>
          </section>

          {query.data.pages.length === 0 ? (
            <div className="empty-state" role="alert">
              <h2>Transcript pages unavailable</h2>
              <p>The response did not include the expected complete page sequence.</p>
            </div>
          ) : (
            <ol className="transcript-pages" aria-label="Transcript pages">
              {query.data.pages.map((page) => (
                <li id={`transcript-page-${page.page_index}`} key={page.page_id}>
                  <article className="transcript-page-card" data-page-id={page.page_id}>
                    <header>
                      <div>
                        <p className="eyebrow">
                          Page {page.page_index + 1} of {query.data.physical_page_count}
                        </p>
                        <h2>Physical page {page.physical_page}</h2>
                      </div>
                      <TranscriptStatus />
                    </header>
                    <PageIdentity page={page} />
                    <TranscriptText page={page} />
                  </article>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : null}
    </div>
  );
}
