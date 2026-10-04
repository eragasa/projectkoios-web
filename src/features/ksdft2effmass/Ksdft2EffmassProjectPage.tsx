import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  ApiError,
  apiClient,
  type ProjectMissingPdf,
  type ProjectProvidedPdf,
} from "../../api/client";
import { usePageMetadata } from "../../app/usePageMetadata";

const queryKey = ["project-reference-intake", "ksdft2effmass", "missing-pdfs"];

function intakeError(error: Error) {
  if (!(error instanceof ApiError)) {
    return "The Missing PDFs list is currently unavailable.";
  }
  switch (error.status) {
    case 404:
      return "This reference is no longer available for PDF receipt.";
    case 409:
      return "This reference or PDF was bound elsewhere. Refresh before continuing.";
    case 413:
      return "The selected PDF exceeds the configured upload limit.";
    case 415:
      return "The selected file was rejected because it is not a valid PDF.";
    case 422:
      return "The bounded PDF request was rejected.";
    case 502:
      return "The References owner returned invalid project metadata.";
    case 503:
      return "The private References owner is currently unavailable.";
    default:
      return "The private PDF request could not be completed.";
  }
}

function referenceLabel(item: ProjectMissingPdf) {
  return item.title ?? "Title not established";
}

export function Ksdft2EffmassProjectPage() {
  usePageMetadata(
    "ksdft2effmass",
    "Open the local evidence-grounded manuscript workspace.",
  );
  const missing = useQuery({
    queryKey,
    queryFn: ({ signal }) => apiClient.projectMissingPdfs(signal),
    retry: false,
  });

  return (
    <div className="project-intake-page">
      <header className="section-heading">
        <p className="eyebrow">Private project workspace</p>
        <h1>ksdft2effmass</h1>
        <p>
          Prepare evidence for the research manuscript while keeping references,
          document receipt, processing, and scientific acceptance separate.
        </p>
      </header>
      <section className="control-grid" aria-label="Project tools">
        <article className="control-card">
          <p className="eyebrow">Reference collection</p>
          <h2>Missing PDFs</h2>
          <p>
            {missing.data
              ? `${missing.data.missing_pdf_count} of ${missing.data.required_pdf_count} required PDFs remain missing.`
              : "Inspect cited references that do not yet have a bound PDF."}
          </p>
          <Link to="/control/projects/ksdft2effmass/missing-pdfs">
            Open Missing PDFs →
          </Link>
        </article>
      </section>
      {missing.isError ? (
        <p className="error-message" role="alert">
          {intakeError(missing.error)}
        </p>
      ) : null}
    </div>
  );
}

function MissingPdfOption({
  item,
  selected,
  disabled,
  onSelect,
}: {
  item: ProjectMissingPdf;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <label className="missing-pdf-option">
      <input
        type="radio"
        name="missing-reference"
        value={item.citekey}
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
      />
      <span>
        <strong>{referenceLabel(item)}</strong>
        <span>
          <code>{item.citekey}</code> · {item.entry_type} ·{" "}
          {item.year ?? "year not established"}
        </span>
        <span>
          {item.authors.length > 0
            ? item.authors.join("; ")
            : "authors not established"}
        </span>
        <span>No PDF received</span>
      </span>
    </label>
  );
}

export function MissingPdfsPage() {
  usePageMetadata(
    "Missing PDFs · ksdft2effmass",
    "Provide one private PDF for a cited manuscript reference.",
  );
  const queryClient = useQueryClient();
  const [selectedCitekey, setSelectedCitekey] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [result, setResult] = useState<ProjectProvidedPdf | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const reviewRef = useRef<HTMLDivElement>(null);
  const missing = useQuery({
    queryKey,
    queryFn: ({ signal }) => apiClient.projectMissingPdfs(signal),
    retry: false,
  });
  const upload = useMutation({
    mutationFn: ({ citekey, pdf }: { citekey: string; pdf: File }) =>
      apiClient.provideProjectMissingPdf(citekey, pdf),
    onSuccess: async (provided) => {
      setResult(provided);
      setSelectedCitekey(null);
      setFile(null);
      setReviewing(false);
      setFileInputKey((value) => value + 1);
      await queryClient.invalidateQueries({ queryKey });
    },
  });
  const selected = missing.data?.items.find((item) => item.citekey === selectedCitekey);

  useEffect(() => {
    if (reviewing) reviewRef.current?.focus();
  }, [reviewing]);

  function resetSelection(citekey: string) {
    setSelectedCitekey(citekey);
    setFile(null);
    setReviewing(false);
    setLocalError(null);
    setResult(null);
    upload.reset();
    setFileInputKey((value) => value + 1);
  }

  function reviewUpload() {
    setLocalError(null);
    setResult(null);
    upload.reset();
    if (!selected || !file || !missing.data) {
      setLocalError("Select a reference and one PDF before review.");
      return;
    }
    const pdfType = file.type === "" || file.type === "application/pdf";
    const pdfName = file.name.toLowerCase().endsWith(".pdf");
    if (!pdfType || !pdfName) {
      setLocalError("Choose a PDF file.");
      return;
    }
    if (file.size < 5) {
      setLocalError("The PDF must contain at least five bytes.");
      return;
    }
    if (file.size > missing.data.max_pdf_bytes) {
      setLocalError(
        `The PDF exceeds the ${missing.data.max_pdf_bytes.toLocaleString()}-byte limit.`,
      );
      return;
    }
    setReviewing(true);
  }

  return (
    <div className="project-intake-page">
      <nav className="transcript-back" aria-label="Project navigation">
        <Link to="/control/projects/ksdft2effmass">← ksdft2effmass project</Link>
      </nav>
      <header className="section-heading">
        <p className="eyebrow">Private reference intake</p>
        <h1>Missing PDFs</h1>
        <p>
          Select the exact BibTeX citekey, review the local filename and size, then
          explicitly bind one private PDF. Receipt does not verify identity, ingest,
          index, review, accept, or publish the source.
        </p>
      </header>

      {missing.isPending ? (
        <div className="publication-status" role="status">
          Loading missing references…
        </div>
      ) : null}
      {missing.isError ? (
        <div className="empty-state" role="alert">
          <h2>Missing PDFs unavailable</h2>
          <p>{intakeError(missing.error)}</p>
        </div>
      ) : null}
      {missing.data?.items.length === 0 ? (
        <div className="empty-state" role="status">
          <h2>No PDFs currently requested</h2>
          <p>Every PDF-required reference currently has a bound document.</p>
        </div>
      ) : null}

      {missing.data && missing.data.items.length > 0 ? (
        <section aria-labelledby="missing-pdf-list-heading">
          <header>
            <h2 id="missing-pdf-list-heading">
              {missing.data.missing_pdf_count} missing PDFs
            </h2>
            <p>
              {missing.data.bound_pdf_count} of {missing.data.required_pdf_count}{" "}
              required PDFs are currently bound.
            </p>
          </header>
          <fieldset disabled={upload.isPending}>
            <legend>Select one cited reference</legend>
            <div className="missing-pdf-list">
              {missing.data.items.map((item) => (
                <MissingPdfOption
                  item={item}
                  selected={selectedCitekey === item.citekey}
                  disabled={upload.isPending}
                  onSelect={() => resetSelection(item.citekey)}
                  key={item.citekey}
                />
              ))}
            </div>
          </fieldset>
        </section>
      ) : null}

      {selected ? (
        <section
          className="missing-pdf-upload"
          aria-label={`PDF receipt for ${selected.citekey}`}
        >
          <label>
            <span>PDF for {selected.citekey}</span>
            <input
              key={fileInputKey}
              type="file"
              accept="application/pdf,.pdf"
              disabled={reviewing || upload.isPending}
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setReviewing(false);
                setLocalError(null);
                setResult(null);
                upload.reset();
              }}
            />
          </label>
          {!reviewing ? (
            <button
              className="button button--primary"
              type="button"
              disabled={!file || upload.isPending}
              onClick={reviewUpload}
            >
              Review upload
            </button>
          ) : null}
        </section>
      ) : null}

      {reviewing && selected && file ? (
        <section
          ref={reviewRef}
          tabIndex={-1}
          className="missing-pdf-confirmation"
          aria-labelledby="missing-pdf-confirm-heading"
          aria-busy={upload.isPending}
        >
          <h2 id="missing-pdf-confirm-heading">Confirm private PDF receipt</h2>
          <dl>
            <div>
              <dt>Citekey</dt>
              <dd>{selected.citekey}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>{referenceLabel(selected)}</dd>
            </div>
            <div>
              <dt>Local filename</dt>
              <dd>{file.name}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{file.size.toLocaleString()} bytes</dd>
            </div>
          </dl>
          <p>
            This action records private custody and an explicit neutral binding only. It
            does not verify identity, ingest, index, review, accept, or publish.
          </p>
          <button
            className="button button--primary"
            type="button"
            disabled={upload.isPending}
            onClick={() => upload.mutate({ citekey: selected.citekey, pdf: file })}
          >
            {upload.isPending ? "Uploading PDF…" : `Upload PDF for ${selected.citekey}`}
          </button>
          <button
            className="button button--secondary"
            type="button"
            disabled={upload.isPending}
            onClick={() => setReviewing(false)}
          >
            Cancel
          </button>
        </section>
      ) : null}

      {localError ? (
        <p className="error-message" role="alert">
          {localError}
        </p>
      ) : null}
      {upload.isError ? (
        <p className="error-message" role="alert">
          {intakeError(upload.error)}
        </p>
      ) : null}
      {result ? (
        <div className="publication-status" role="status">
          PDF received for {result.citekey}. The document remains unreviewed and is not
          automatically processed or published.
        </div>
      ) : null}
    </div>
  );
}
