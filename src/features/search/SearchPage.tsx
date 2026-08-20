import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import { apiClient, type SearchResult } from "../../api/client";

function ResultCard({ result }: { result: SearchResult }) {
  return (
    <article className="result-card">
      <div className="result-card__header">
        <div>
          <span className="type-badge">{result.object_type}</span>
          <h2>{result.title}</h2>
        </div>
        <span className="score" title="Retrieval score">
          {result.score.toFixed(2)}
        </span>
      </div>
      <p className="result-card__snippet">{result.snippet}</p>
      <footer>
        <code>{result.path}</code>
        <span>Source metadata</span>
      </footer>
    </article>
  );
}

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const search = useMutation({
    mutationFn: (request: { query: string; limit: number }) =>
      apiClient.search(request),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    if (normalizedQuery) {
      search.mutate({ query: normalizedQuery, limit });
    }
  }

  return (
    <div className="search-page">
      <header className="section-heading">
        <p className="eyebrow">Local retrieval</p>
        <h1>Search the knowledge workspace</h1>
        <p>
          Results come from the configured Project Koios API. Source paths and object
          types remain visible for inspection.
        </p>
      </header>

      <form className="search-form" onSubmit={submit}>
        <label className="search-field">
          <span className="sr-only">Search query</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m21 21-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search concepts, equations, sources…"
            autoFocus
          />
        </label>
        <label className="limit-field">
          <span>Results</span>
          <select
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>
        <button
          className="button button--primary"
          type="submit"
          disabled={!query.trim() || search.isPending}
        >
          {search.isPending ? "Searching…" : "Search"}
        </button>
      </form>

      <div className="search-status" aria-live="polite">
        {search.isError ? (
          <p className="error-message">
            Search failed. Confirm that the local Project Koios API is running.
          </p>
        ) : null}
        {search.isSuccess ? (
          <p>
            {search.data.length} result
            {search.data.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      {search.isSuccess && search.data.length === 0 ? (
        <div className="empty-state">
          <h2>No matching material</h2>
          <p>Try a broader term or confirm that sources have been indexed.</p>
        </div>
      ) : null}

      {search.data?.length ? (
        <section className="results-list" aria-label="Search results">
          {search.data.map((result, index) => (
            <ResultCard
              key={`${result.path}-${result.title}-${index}`}
              result={result}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
