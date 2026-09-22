import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { OrganizerPage } from "./OrganizerPage";

class StubEventSource {
  onerror: (() => void) | null = null;

  addEventListener() {}

  close() {}
}

beforeEach(() => {
  vi.stubGlobal("EventSource", StubEventSource);
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            desired_mode: "off",
            activity: "off",
            discovered_roots: 0,
            observed_files: 0,
            local_files: 0,
            placeholder_files: 0,
            proposed_files: 0,
            last_event_sequence: 0,
            current_root_id: null,
            current_relative_path: null,
            last_error: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("shows bounded organizer observation controls", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <OrganizerPage />
    </QueryClientProvider>,
  );

  expect(await screen.findByText("Requested mode: off")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Turn off" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: /move/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
});
