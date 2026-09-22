import { useQuery } from "@tanstack/react-query";

import { apiClient, type PublicProjectRecord } from "../../api/client";

function capabilityTone(status: string): string {
  if (status === "available") return "available";
  if (status === "in-development") return "development";
  return "planned";
}

function ProjectRecord({ project }: { project: PublicProjectRecord }) {
  return (
    <article className="project-record" id={project.slug}>
      <header className="project-record__header">
        <div>
          <div className="project-record__identity">
            <span className="type-badge">Project</span>
            <span className="project-status">{project.status}</span>
          </div>
          <h2>{project.name}</h2>
          <p className="project-record__tagline">{project.tagline}</p>
        </div>
        {project.links.length > 0 ? (
          <nav className="project-links" aria-label={`${project.name} links`}>
            {project.links.map((link) => (
              <a key={`${link.label}-${link.url}`} href={link.url} rel="noreferrer">
                {link.label} ↗
              </a>
            ))}
          </nav>
        ) : null}
      </header>

      <p className="project-record__summary">{project.summary}</p>

      {project.topics.length > 0 ? (
        <ul className="topic-list" aria-label="Topics">
          {project.topics.map((topic) => (
            <li key={topic}>{topic}</li>
          ))}
        </ul>
      ) : null}

      <div className="project-record__columns">
        <section>
          <p className="eyebrow">Purpose</p>
          <ul>
            {project.purposes.map((purpose) => (
              <li key={purpose}>{purpose}</li>
            ))}
          </ul>
        </section>
        <section>
          <p className="eyebrow">Principles</p>
          <ul>
            {project.principles.map((principle) => (
              <li key={principle}>{principle}</li>
            ))}
          </ul>
        </section>
      </div>

      {project.capabilities.length > 0 ? (
        <section
          className="project-capabilities"
          aria-labelledby={`${project.slug}-capabilities`}
        >
          <header>
            <p className="eyebrow">Current boundary</p>
            <h3 id={`${project.slug}-capabilities`}>Capabilities</h3>
          </header>
          <div>
            {project.capabilities.map((capability) => (
              <article key={capability.name}>
                <span
                  className={`capability-status capability-status--${capabilityTone(capability.status)}`}
                >
                  {capability.status}
                </span>
                <h4>{capability.name}</h4>
                <p>{capability.summary}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {project.limitations.length > 0 ? (
        <section className="project-limitations">
          <p className="eyebrow">Explicit limitations</p>
          <ul>
            {project.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

export function ProjectsPage() {
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: ({ signal }) => apiClient.projects(signal),
  });

  return (
    <div className="projects-page">
      <header className="section-heading">
        <p className="eyebrow">Public record</p>
        <h1>Projects</h1>
        <p>
          Human-reviewed overviews of Project Koios work, with available capabilities,
          development status, and limitations kept visible.
        </p>
      </header>

      {projects.isPending ? (
        <div className="publication-status" role="status">
          Loading projects…
        </div>
      ) : null}

      {projects.isError ? (
        <div className="empty-state" role="alert">
          <h2>Project catalog unavailable</h2>
          <p>The public project catalog could not be loaded. Please try again later.</p>
        </div>
      ) : null}

      {projects.data?.projects.length === 0 ? (
        <div className="empty-state">
          <h2>No public project records yet</h2>
          <p>Private and draft project state is never inferred as public content.</p>
        </div>
      ) : null}

      {projects.data && projects.data.projects.length > 0 ? (
        <div className="project-record-list">
          {projects.data.projects.map((project) => (
            <ProjectRecord project={project} key={project.id} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
