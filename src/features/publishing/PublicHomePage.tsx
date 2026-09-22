import { Link } from "react-router-dom";

const principles = [
  {
    title: "Scope stays bounded",
    description:
      "Each record separates available capabilities, review candidates, development work, and explicit exclusions.",
  },
  {
    title: "Status stays visible",
    description:
      "Projects and courses report their current review state instead of implying that identified work is published work.",
  },
  {
    title: "Evidence stays attached",
    description:
      "Public records retain stable source revisions, review dates, verification links, and limitations.",
  },
];

export function PublicHomePage() {
  return (
    <div className="public-home-page">
      <section className="hero hero--public">
        <div>
          <p className="eyebrow">Research infrastructure · Courses · Evidence</p>
          <h1>Scientific work needs inspectable context.</h1>
          <p className="hero__summary">
            Project Koios is building evidence-connected infrastructure for scientific
            teaching and research. This public record shows what exists, what remains in
            development, and the evidence behind each reviewed claim.
          </p>
          <div className="hero__actions">
            <Link className="button button--primary" to="/projects">
              Explore Project Koios
            </Link>
            <Link className="button button--secondary" to="/courses">
              Browse courses
            </Link>
            <a
              className="button button--secondary"
              href="https://github.com/eragasa/projectkoios/issues"
              rel="noreferrer"
            >
              Follow development ↗
            </a>
          </div>
        </div>
        <div className="publication-signal" aria-label="Publication lifecycle">
          <span>Identify</span>
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
          <p className="eyebrow">Public record standard</p>
          <h2 id="standards-title">Readable scope, inspectable evidence.</h2>
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
