import { expect, test } from "@playwright/test";

test("inspects a live read-only GitHubTask sequence", async ({ page }) => {
  await page.route("**/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("**/github/tasks", (route) =>
    route.fulfill({
      json: {
        source: "github-live",
        repositories: [
          {
            repository: "eragasa/projectkoios-web",
            state: "ok",
            error_kind: null,
            default_branch: "main",
            open_pull_requests: [],
            latest_sequence: {
              run_id: 42,
              workflow_name: "CI",
              event: "push",
              status: "completed",
              conclusion: "success",
              branch: "main",
              commit_sha: "b".repeat(40),
              url: "https://github.com/eragasa/projectkoios-web/actions/runs/42",
              created_at: "2026-09-22T09:46:05Z",
              tasks: [
                {
                  sequence_index: 1,
                  job_name: "Node.js 22 task sequence",
                  name: "GitHubTask 01 · Checkout",
                  status: "completed",
                  conclusion: "success",
                  started_at: "2026-09-22T09:46:05Z",
                  completed_at: "2026-09-22T09:46:06Z",
                },
              ],
            },
          },
        ],
      },
    }),
  );

  await page.goto("/control/github");

  await expect(
    page.getByRole("heading", { name: "eragasa/projectkoios-web" }),
  ).toBeVisible();
  await expect(page.getByText("GitHubTask 01 · Checkout")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
  await expect(page.getByRole("button", { name: /merge|retry|dispatch/i })).toHaveCount(
    0,
  );
});
