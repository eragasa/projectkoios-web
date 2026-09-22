import { Link } from "react-router-dom";

const workspaces = [
  {
    eyebrow: "Repositories",
    title: "Inspect GitHub tasks",
    description:
      "Read live pull requests, workflow runs, and ordered CI tasks without exposing mutation controls.",
    action: "Open GitHub tasks",
    to: "/control/github",
  },
  {
    eyebrow: "Knowledge",
    title: "Search the workspace",
    description:
      "Query indexed private sources and inspect paths, object types, relevance, and provenance cues.",
    action: "Open search",
    to: "/control/search",
  },
  {
    eyebrow: "Local agent",
    title: "Organize cloud drives",
    description:
      "Watch the read-only catalog and local categorization agent before approving any organization plan.",
    action: "Open life organizer",
    to: "/control/organizer",
  },
  {
    eyebrow: "Teaching archive",
    title: "Review course candidates",
    description:
      "Compare organization-agent teaching proposals with known course identities without publishing private materials.",
    action: "Open course review",
    to: "/control/courses",
  },
  {
    eyebrow: "Human review",
    title: "Review citation claims",
    description:
      "Compare manuscript claims with candidate evidence and save explicit operator decisions.",
    action: "Open citation review",
    to: "/control/citation-review",
  },
  {
    eyebrow: "Research operations",
    title: "Monitor literature review",
    description:
      "Inspect review progress and provide missing references without silently changing manuscripts.",
    action: "Open literature review",
    to: "/control/literature-review",
  },
];

export function DashboardPage() {
  return (
    <div className="control-dashboard">
      <header className="control-heading">
        <div>
          <p className="eyebrow">Private workspace · Single operator</p>
          <h1>Control center</h1>
          <p>
            Inspect Project Koios, resolve review queues, and initiate bounded work from
            one private operational surface.
          </p>
        </div>
        <div className="operator-card" aria-label="Access boundary">
          <span className="operator-card__status">Local control profile</span>
          <strong>One human operator</strong>
          <p>Protected capabilities are unavailable from the public deployment.</p>
        </div>
      </header>

      <section className="control-notice" aria-label="Control boundary">
        <strong>Human authority remains explicit.</strong>
        <span>
          Review decisions and protected operations require visible targets, validation,
          and confirmation. Agent output is never publication authority.
        </span>
      </section>

      <section className="control-grid" aria-label="Control workspaces">
        {workspaces.map((workspace) => (
          <article className="control-card" key={workspace.title}>
            <p className="eyebrow">{workspace.eyebrow}</p>
            <h2>{workspace.title}</h2>
            <p>{workspace.description}</p>
            <Link to={workspace.to}>{workspace.action} →</Link>
          </article>
        ))}
      </section>
    </div>
  );
}
