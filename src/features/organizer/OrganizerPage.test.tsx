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
      if (url === "/organizer/events?after=0") {
        return Promise.resolve(
          Response.json({
            events: [
              {
                sequence: 8,
                kind: "proposal-created",
                message: "A local categorization proposal is ready for review.",
                occurred_at: "2026-09-29T04:00:00Z",
                root_id: "root-1",
                file_id: "file-1",
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

test("polls bounded organizer status and event snapshots without opening the stream", async () => {
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
    await screen.findByRole("heading", { name: "Latest organizer events" }),
  ).toBeInTheDocument();
  expect(screen.getByText("proposal-created")).toBeInTheDocument();
  expect(screen.getByText(/Sequence 8/)).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith(
    "/organizer/events?after=0",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});
