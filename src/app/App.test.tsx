import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { App } from "./App";
import type { DeploymentProfile } from "./deploymentProfile";

function renderApp(profile: DeploymentProfile, initialEntry = "/") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <App profile={profile} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((request: RequestInfo | URL) => {
      const path = String(request);
      const body = path.endsWith("/api/publications")
        ? { schema_version: "1", publications: [] }
        : { status: "ok" };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("public profile presents publishing without control routes", () => {
  renderApp("public");

  expect(
    screen.getByRole("heading", {
      name: "Work worth publishing. Evidence worth preserving.",
    }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Control center" }),
  ).not.toBeInTheDocument();
});

test("public profile rejects a control-center route", () => {
  renderApp("public", "/control");

  expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
});

test("control profile opens the single-operator dashboard", async () => {
  const user = userEvent.setup();
  renderApp("control");

  await user.click(screen.getByRole("link", { name: "Control center" }));

  expect(screen.getByRole("heading", { name: "Control center" })).toBeInTheDocument();
  expect(screen.getByText("One human operator")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Open search/ })).toHaveAttribute(
    "href",
    "/control/search",
  );
});
