import { useQuery } from "@tanstack/react-query";

import { apiClient, type PublicationRecord } from "../../api/client";

function publicationDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function PublicationCard({ publication }: { publication: PublicationRecord }) {
  return (
    <article className="publication-card">
      <header>
        <div className="publication-card__identity">
          <span className="type-badge">{publication.kind}</span>
          {publication.version ? <code>{publication.version}</code> : null}
        </div>
        <time dateTime={publication.published_on}>
          {publicationDate(publication.published_on)}
        </time>
      </header>

      <h2>{publication.title}</h2>
      <p className="publication-card__authors">{publication.authors.join(" · ")}</p>
      <p className="publication-card__summary">{publication.summary}</p>

      {publication.topics.length > 0 ? (
        <ul className="topic-list" aria-label="Topics">
          {publication.topics.map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      ) : null}

      {publication.claims.length > 0 || publication.limitations.length > 0 ? (
        <div className="publication-boundaries">
          {publication.claims.length > 0 ? (
            <section>
              <h3>Reviewed scope</h3>
              <ul>
                {publication.claims.map((claim) => (
                  <li key={claim}>{claim}</li>
                ))}
              </ul>
            </section>
          ) : null}
          {publication.limitations.length > 0 ? (
            <section>
              <h3>Limitations</h3>
              <ul>
                {publication.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      {publication.citation ? (
        <details className="publication-citation">
          <summary>Citation</summary>
          <p>{publication.citation}</p>
        </details>
      ) : null}

      {publication.links.length > 0 ? (
        <footer>
          {publication.links.map((link) => (
            <a key={`${link.label}-${link.url}`} href={link.url} rel="noreferrer">
              {link.label} ↗
            </a>
          ))}
        </footer>
      ) : null}
    </article>
  );
}

export function PublicationsPage() {
  const publications = useQuery({
    queryKey: ["publications"],
    queryFn: ({ signal }) => apiClient.publications(signal),
  });

  return (
    <div className="publications-page">
      <header className="section-heading">
        <p className="eyebrow">Public record</p>
        <h1>Publications</h1>
        <p>
          Reviewed software, papers, datasets, and technical reports published through
          Project Koios.
        </p>
      </header>

      {publications.isPending ? (
        <div className="publication-status" role="status">
          Loading publications…
        </div>
      ) : null}

      {publications.isError ? (
        <div className="empty-state" role="alert">
          <h2>Publication catalog unavailable</h2>
          <p>The public catalog could not be loaded. Please try again later.</p>
        </div>
      ) : null}

      {publications.data?.publications.length === 0 ? (
        <div className="empty-state">
          <h2>No public records yet</h2>
          <p>Draft and internal work is never displayed as published output.</p>
        </div>
      ) : null}

      {publications.data && publications.data.publications.length > 0 ? (
        <div className="publication-list">
          {publications.data.publications.map((publication) => (
            <PublicationCard publication={publication} key={publication.id} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
