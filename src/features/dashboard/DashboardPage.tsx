import { Link } from "react-router-dom";

const capabilities = [
  {
    eyebrow: "Available now",
    title: "Search your indexed knowledge",
    description:
      "Query Project Koios through the local API and inspect source paths, types, and relevance scores.",
    action: "Open search",
    to: "/search",
  },
  {
    eyebrow: "Next",
    title: "Trace every answer to its source",
    description:
      "Provenance views will connect retrieved passages to documents, pages, equations, and figures.",
  },
  {
    eyebrow: "Planned",
    title: "Review ingestion and vault changes",
    description:
      "JIT extraction and vault migrations will remain inspectable and require explicit approval.",
  },
];

export function DashboardPage() {
  return (
    <div className="dashboard-page">
      <section className="hero">
        <div>
          <p className="eyebrow">Research · Teaching · Technical work</p>
          <h1>Knowledge that remains connected to its evidence.</h1>
          <p className="hero__summary">
            Project Koios is a local-first workspace for finding, preparing, and reusing
            technical knowledge without losing provenance.
          </p>
          <div className="hero__actions">
            <Link className="button button--primary" to="/search">
              Search the workspace
            </Link>
            <a className="button button--secondary" href="/docs">
              View API
            </a>
          </div>
        </div>
        <div className="hero__signal" aria-label="Project Koios workflow">
          <span>Sources</span>
          <i aria-hidden="true" />
          <span>Evidence</span>
          <i aria-hidden="true" />
          <span>Knowledge</span>
        </div>
      </section>

      <section className="capability-grid" aria-label="Capabilities">
        {capabilities.map((capability) => (
          <article className="capability-card" key={capability.title}>
            <p className="eyebrow">{capability.eyebrow}</p>
            <h2>{capability.title}</h2>
            <p>{capability.description}</p>
            {capability.to ? (
              <Link to={capability.to}>{capability.action} →</Link>
            ) : (
              <span className="muted-link">In development</span>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
