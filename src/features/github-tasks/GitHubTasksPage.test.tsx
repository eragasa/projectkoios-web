import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { GitHubTasksPage } from "./GitHubTasksPage";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <GitHubTasksPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders live pull requests and an ordered GitHubTask sequence", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            source: "github-live",
            repositories: [
              {
                repository: "eragasa/projectkoios-api",
                state: "ok",
                error_kind: null,
                default_branch: "master",
                open_pull_requests: [
                  {
                    number: 3,
                    title: "Add GitHub task dashboard",
                    url: "https://github.com/eragasa/projectkoios-api/pull/3",
                    is_draft: false,
                    head_branch: "work/dashboard",
                    head_sha: "a".repeat(40),
                    base_branch: "master",
                  },
                ],
                latest_sequence: {
                  run_id: 42,
                  workflow_name: "CI",
                  event: "pull_request",
                  status: "completed",
                  conclusion: "success",
                  branch: "work/dashboard",
                  commit_sha: "a".repeat(40),
                  url: "https://github.com/eragasa/projectkoios-api/actions/runs/42",
                  created_at: "2026-09-22T09:45:19Z",
                  tasks: [
                    {
                      sequence_index: 1,
                      job_name: "Python 3.14 task sequence",
                      name: "GitHubTask 01 · Checkout",
                      status: "completed",
                      conclusion: "success",
                      started_at: "2026-09-22T09:45:19Z",
                      completed_at: "2026-09-22T09:45:20Z",
                    },
                    {
                      sequence_index: 2,
                      job_name: "Python 3.14 task sequence",
                      name: "GitHubTask 02 · Test",
                      status: "completed",
                      conclusion: "success",
                      started_at: "2026-09-22T09:45:20Z",
                      completed_at: "2026-09-22T09:45:22Z",
                    },
                  ],
                },
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    ),
  );

  renderPage();

  expect(
    await screen.findByRole("heading", { name: "eragasa/projectkoios-api" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /Add GitHub task dashboard/ }),
  ).toHaveAttribute("href", "https://github.com/eragasa/projectkoios-api/pull/3");
  expect(screen.getByText("GitHubTask 01 · Checkout")).toBeInTheDocument();
  expect(screen.getByText("GitHubTask 02 · Test")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /merge|retry|dispatch/i }),
  ).not.toBeInTheDocument();
});

test("renders a bounded per-repository failure", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            source: "github-live",
            repositories: [
              {
                repository: "eragasa/projectkoios-web",
                state: "error",
                error_kind: "authentication",
                default_branch: null,
                open_pull_requests: [],
                latest_sequence: null,
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    ),
  );

  renderPage();

  expect(await screen.findByText("GitHub projection unavailable")).toBeInTheDocument();
  expect(screen.getByText("authentication")).toBeInTheDocument();
});
