# Web GitHubTask sequence

`.github/workflows/ci.yml` expresses hosted verification as an ordered sequence of
bounded `GitHubTask` steps. In this first use, `GitHubTask` is a workflow naming and
review convention, not a new workflow engine, persisted task model, or authorization
record.

The sequence:

1. checks out the web candidate;
2. installs Node.js 22;
3. installs the exact `package-lock.json` dependency graph with `npm ci`;
4. checks formatting;
5. runs TypeScript checking;
6. runs component tests;
7. builds the public deployment;
8. builds the control deployment; and
9. installs Chromium and runs browser acceptance tests.

The job has read-only repository permission, disables checkout credential persistence,
does not upload artifacts, and cancels an obsolete run for the same pull request or
branch. A failed task stops later tasks through normal GitHub Actions behavior.

These tasks produce technical verification only. They do not authorize a commit,
push, pull request, merge, deployment, publication, release, or architecture decision.
GitHub remains authoritative for the workflow run and pull-request status; the
repository does not copy mutable run state.
