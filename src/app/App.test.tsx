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
      const body = path.endsWith("/api/courses")
        ? {
            schema_version: "1",
            reviewed_on: null,
            source: null,
            publication_boundary: [],
            institutions: [],
            unresolved_collections: [],
          }
        : path.endsWith("/api/projects")
          ? { schema_version: "1", projects: [] }
          : path.endsWith("/api/publications")
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
      name: "Scientific work needs inspectable context.",
    }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Control center" }),
  ).not.toBeInTheDocument();
  expect(document.title).toBe("Project Koios");
  expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
    "content",
    expect.stringContaining("course inventories"),
  );
  expect(screen.getByRole("link", { name: /Architecture/ })).toHaveAttribute(
    "href",
    "https://github.com/eragasa/projectkoios/blob/main/docs/architecture.md",
  );
});

test("public profile exposes the project catalog route", async () => {
  const user = userEvent.setup();
  renderApp("public");

  await user.click(screen.getByRole("link", { name: "Projects" }));

  expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
  expect(document.title).toBe("Projects · Project Koios");
  expect(
    await screen.findByRole("heading", { name: "No public project records yet" }),
  ).toBeInTheDocument();
});

test("public profile exposes public-safe course metadata", async () => {
  const user = userEvent.setup();
  renderApp("public");

  await user.click(screen.getByRole("link", { name: "Courses" }));

  expect(screen.getByRole("heading", { name: "Courses" })).toBeInTheDocument();
  expect(document.title).toBe("Courses · Project Koios");
  expect(
    await screen.findByRole("heading", { name: "No public course metadata yet" }),
  ).toBeInTheDocument();
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
  expect(screen.getByRole("link", { name: /Open GitHub tasks/ })).toHaveAttribute(
    "href",
    "/control/github",
  );
  expect(screen.getByRole("link", { name: /Open search/ })).toHaveAttribute(
    "href",
    "/control/search",
  );
  expect(screen.getByRole("link", { name: /Open life organizer/ })).toHaveAttribute(
    "href",
    "/control/organizer",
  );
  expect(screen.getByRole("link", { name: /Open course review/ })).toHaveAttribute(
    "href",
    "/control/courses",
  );
});
