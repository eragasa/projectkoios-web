import { useQuery } from "@tanstack/react-query";

import {
  apiClient,
  type GitHubRepositoryTaskProjection,
  type GitHubTaskSequence,
} from "../../api/client";

function statusTone(status: string, conclusion: string | null | undefined): string {
  if (conclusion === "success") return "success";
  if (conclusion === "failure" || conclusion === "cancelled") return "failure";
  if (status === "in_progress" || status === "queued") return "active";
  return "neutral";
}

function shortSha(value: string): string {
  return value.slice(0, 8);
}

function TaskSequence({ sequence }: { sequence: GitHubTaskSequence }) {
  const tone = statusTone(sequence.status, sequence.conclusion);

  return (
    <section className="github-sequence" aria-labelledby={`run-${sequence.run_id}`}>
      <header>
        <div>
          <p className="eyebrow">Latest GitHubTask sequence</p>
          <h3 id={`run-${sequence.run_id}`}>{sequence.workflow_name}</h3>
        </div>
        <span className={`github-status github-status--${tone}`}>
          {sequence.conclusion ?? sequence.status}
        </span>
      </header>

      <dl className="github-sequence__metadata">
        <div>
          <dt>Event</dt>
          <dd>{sequence.event}</dd>
        </div>
        <div>
          <dt>Branch</dt>
          <dd>{sequence.branch}</dd>
        </div>
        <div>
          <dt>Commit</dt>
          <dd>
            <code>{shortSha(sequence.commit_sha)}</code>
          </dd>
        </div>
        <div>
          <dt>Tasks</dt>
          <dd>
            {sequence.tasks.length}
            {sequence.tasks_complete === false ? "+" : ""}
          </dd>
        </div>
      </dl>

      {sequence.tasks_complete === false ? (
        <p className="github-collection-boundary">
          Showing GitHubTasks from the first 20 jobs; the authoritative run contains
          additional jobs.
        </p>
      ) : null}

      {sequence.tasks.length > 0 ? (
        <ol className="github-task-list">
          {sequence.tasks.map((task) => {
            const taskTone = statusTone(task.status, task.conclusion);
            return (
              <li key={`${task.sequence_index}-${task.job_name}-${task.name}`}>
                <span
                  className={`github-task-marker github-task-marker--${taskTone}`}
                  aria-hidden="true"
                />
                <span className="github-task-index">
                  {String(task.sequence_index).padStart(2, "0")}
                </span>
                <div>
                  <strong>{task.name}</strong>
                  <small>{task.job_name}</small>
                </div>
                <span className={`github-status github-status--${taskTone}`}>
                  {task.conclusion ?? task.status}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="github-sequence__empty">
          This run has no steps named as GitHubTasks.
        </p>
      )}

      <a className="github-run-link" href={sequence.url} rel="noreferrer">
        Inspect authoritative run on GitHub ↗
      </a>
    </section>
  );
}

function RepositoryCard({
  repository,
}: {
  repository: GitHubRepositoryTaskProjection;
}) {
  return (
    <article className="github-repository-card">
      <header>
        <div>
          <p className="eyebrow">Repository</p>
          <h2>{repository.repository}</h2>
        </div>
        <span
          className={`github-status github-status--${repository.state === "ok" ? "success" : "failure"}`}
        >
          {repository.state === "ok" ? "Live" : "Unavailable"}
        </span>
      </header>

      {repository.state === "error" ? (
        <div className="github-repository-error" role="status">
          <strong>GitHub projection unavailable</strong>
          <span>{repository.error_kind ?? "unknown_error"}</span>
        </div>
      ) : (
        <>
          <div className="github-repository-summary">
            <span>
              Default branch <code>{repository.default_branch}</code>
            </span>
            <span>
              {repository.open_pull_requests.length}
              {repository.open_pull_requests_complete === false ? "+" : ""} open pull
              requests
            </span>
          </div>

          {repository.open_pull_requests_complete === false ? (
            <p className="github-collection-boundary">
              Showing the first 20 open pull requests. Inspect GitHub for the complete
              collection.
            </p>
          ) : null}

          {repository.open_pull_requests.length > 0 ? (
            <section className="github-pull-requests" aria-label="Open pull requests">
              <h3>Open pull requests</h3>
              <ul>
                {repository.open_pull_requests.map((pullRequest) => (
                  <li key={pullRequest.number}>
                    <a href={pullRequest.url} rel="noreferrer">
                      <span>#{pullRequest.number}</span>
                      <strong>{pullRequest.title}</strong>
                    </a>
                    <small>
                      {pullRequest.head_branch} → {pullRequest.base_branch}
                      {pullRequest.is_draft ? " · draft" : ""}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {repository.latest_sequence ? (
            <TaskSequence sequence={repository.latest_sequence} />
          ) : (
            <div className="github-sequence__empty">No workflow run is available.</div>
          )}
        </>
      )}
    </article>
  );
}

export function GitHubTasksPage() {
  const dashboard = useQuery({
    queryKey: ["github-tasks"],
    queryFn: ({ signal }) => apiClient.githubTasks(signal),
  });

  return (
    <div className="github-tasks-page">
      <header className="review-page-header">
        <div>
          <p className="eyebrow">Control center · Read only</p>
          <h1>GitHub tasks</h1>
          <p>
            Inspect live pull requests and ordered CI tasks without copying GitHub
            authority or exposing mutation controls.
          </p>
        </div>
        <div className="github-authority-card">
          <span>Authority</span>
          <strong>GitHub live</strong>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void dashboard.refetch()}
            disabled={dashboard.isFetching}
          >
            {dashboard.isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {dashboard.isPending ? (
        <div className="review-loading" role="status">
          Reading GitHub task state…
        </div>
      ) : null}

      {dashboard.isError ? (
        <div className="empty-state" role="alert">
          <h2>GitHub tasks unavailable</h2>
          <p>The control API could not return its bounded live projection.</p>
        </div>
      ) : null}

      {dashboard.data?.repositories.length === 0 ? (
        <div className="empty-state">
          <h2>No repositories configured</h2>
          <p>Configure the control API repository allowlist to inspect GitHub tasks.</p>
        </div>
      ) : null}

      {dashboard.data && dashboard.data.repositories.length > 0 ? (
        <div className="github-repository-list">
          {dashboard.data.repositories.map((repository) => (
            <RepositoryCard repository={repository} key={repository.repository} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
