import { Link } from "react-router-dom";

const principles = [
  {
    title: "Claims stay bounded",
    description:
      "Every published record separates demonstrated capabilities from provisional work and explicit exclusions.",
  },
  {
    title: "Evidence stays attached",
    description:
      "Software, papers, datasets, and reports retain links to their sources, citations, versions, and review records.",
  },
  {
    title: "Publication is deliberate",
    description:
      "Draft work remains private. Public records appear only after a human-controlled publication decision.",
  },
];

export function PublicHomePage() {
  return (
    <div className="public-home-page">
      <section className="hero hero--public">
        <div>
          <p className="eyebrow">Open research · Software · Evidence</p>
          <h1>Work worth publishing. Evidence worth preserving.</h1>
          <p className="hero__summary">
            Project Koios publishes reviewed research outputs without separating them
            from the provenance, limitations, and citations needed to understand them.
          </p>
          <div className="hero__actions">
            <Link className="button button--primary" to="/projects">
              Explore projects
            </Link>
            <Link className="button button--secondary" to="/publications">
              Browse publications
            </Link>
            <a className="button button--secondary" href="#standards">
              How publication works
            </a>
          </div>
        </div>
        <div className="publication-signal" aria-label="Publication lifecycle">
          <span>Prepare</span>
          <i aria-hidden="true" />
          <span>Review</span>
          <i aria-hidden="true" />
          <span>Publish</span>
        </div>
      </section>

      <section
        id="standards"
        className="public-principles"
        aria-labelledby="standards-title"
      >
        <header className="section-intro">
          <p className="eyebrow">Publication standard</p>
          <h2 id="standards-title">Readable conclusions, inspectable boundaries.</h2>
        </header>
        <div className="capability-grid">
          {principles.map((principle) => (
            <article className="capability-card" key={principle.title}>
              <h3>{principle.title}</h3>
              <p>{principle.description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
