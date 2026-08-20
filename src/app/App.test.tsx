import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { App } from "./App";

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders the overview and navigates to search", async () => {
  const user = userEvent.setup();
  renderApp();

  expect(
    screen.getByRole("heading", {
      name: "Knowledge that remains connected to its evidence.",
    }),
  ).toBeInTheDocument();

  await user.click(screen.getByRole("link", { name: "Search" }));

  expect(
    screen.getByRole("heading", {
      name: "Search the knowledge workspace",
    }),
  ).toBeInTheDocument();
});
