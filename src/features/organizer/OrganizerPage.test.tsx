import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { OrganizerPage } from "./OrganizerPage";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/organizer/status") {
        return Promise.resolve(
          Response.json({
            desired_mode: "pause",
            activity: "paused",
            discovered_roots: 1,
            observed_files: 4,
            local_files: 3,
            placeholder_files: 1,
            proposed_files: 1,
            last_event_sequence: 8,
            current_root_id: null,
            current_relative_path: null,
            last_error: null,
          }),
        );
      }
      if (url === "/organizer/proposals?limit=200") {
        return Promise.resolve(
          Response.json({
            total: 1,
            complete: true,
            proposals: [
              {
                file_id: "file-1",
                root_id: "root-1",
                relative_path: "teaching/lecture-01.pdf",
                name: "lecture-01.pdf",
                extension: ".pdf",
                byte_size: 100,
                availability: "local",
                life_domain: "teaching",
                course_code: "PHYS101",
                para_category: "resource",
                suggested_group: "Lectures",
                confidence: 0.9,
                rationale: "Teaching material",
                model: "local-model",
                model_digest: "sha256:abc",
                proposed_at: "2026-09-29T04:00:00Z",
              },
            ],
          }),
        );
      }
      return Promise.resolve(Response.json({ detail: "not found" }, { status: 404 }));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("polls bounded organizer status and proposal snapshots without an event stream", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <OrganizerPage />
    </QueryClientProvider>,
  );

  expect(await screen.findByText("Requested mode: pause")).toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { name: "Latest proposals" }),
  ).toBeInTheDocument();
  expect(screen.getByText("lecture-01.pdf")).toBeInTheDocument();
  expect(screen.getByText(/PHYS101/)).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(
    "/organizer/proposals?limit=200",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});
