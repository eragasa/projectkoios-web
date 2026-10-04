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
      if (path.includes("/equation-reviews?")) {
        return Promise.resolve(Response.json({ detail: "not found" }, { status: 404 }));
      }
      if (path.endsWith("/project-reference-intake/ksdft2effmass/missing-pdfs")) {
        return Promise.resolve(
          Response.json({
            project_id: "ksdft2effmass",
            total_references: 107,
            required_pdf_count: 103,
            bound_pdf_count: 23,
            missing_pdf_count: 80,
            not_applicable_count: 4,
            max_pdf_bytes: 100_000_000,
            media_type: "application/pdf",
            items: [],
          }),
        );
      }
      if (path.endsWith("/citation-documents")) {
        return Promise.resolve(
          Response.json({
            request_id: "catalog-request:empty",
            result_id: "catalog-result:empty",
            processing_registry_projection_id: "processing-registry:empty",
            projection: {
              contract_id: "projectkoios.references.citation-document-projection",
              target_snapshot_id: "target-snapshot:empty",
              target_projection_id: "target-projection:empty",
              bibliography_binding_ids: [],
              identity_projection_id: "identity-projection:empty",
              document_observation_ids: [],
              source_document_link_ids: [],
              source_documents: [],
              items: [],
              source_gaps: [],
              limitations: [],
              projection_id: "citation-projection:empty",
            },
          }),
        );
      }
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
            : path.endsWith("/transcripts")
              ? { documents: [] }
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
  expect(screen.getByRole("link", { name: /Open ksdft2effmass/ })).toHaveAttribute(
    "href",
    "/control/projects/ksdft2effmass",
  );
  expect(screen.getByRole("link", { name: /Open search/ })).toHaveAttribute(
    "href",
    "/control/search",
  );
  expect(screen.getByRole("link", { name: /Open note review/ })).toHaveAttribute(
    "href",
    "/control/note-review",
  );
  expect(screen.getByRole("link", { name: /Open equation review/ })).toHaveAttribute(
    "href",
    "/control/equation-review",
  );
  expect(screen.getByRole("link", { name: /Open parsed transcripts/ })).toHaveAttribute(
    "href",
    "/control/transcripts",
  );
  expect(screen.getByRole("link", { name: /Open citation documents/ })).toHaveAttribute(
    "href",
    "/control/citation-documents",
  );
});

test("control profile exposes the ksdft2effmass project workspace", async () => {
  renderApp("control", "/control/projects/ksdft2effmass");

  expect(screen.getByRole("heading", { name: "ksdft2effmass" })).toBeInTheDocument();
  expect(
    await screen.findByText("80 of 103 required PDFs remain missing."),
  ).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Open Missing PDFs/ })).toHaveAttribute(
    "href",
    "/control/projects/ksdft2effmass/missing-pdfs",
  );
});

test("public profile rejects the ksdft2effmass control workspace", () => {
  renderApp("public", "/control/projects/ksdft2effmass");

  expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
});

test("control profile exposes the citation-document catalog", async () => {
  renderApp("control", "/control/citation-documents");

  expect(
    await screen.findByRole("heading", { name: "Citation documents" }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { name: "No citation keys in this catalog" }),
  ).toBeInTheDocument();
});

test("public profile rejects the citation-document catalog", () => {
  renderApp("public", "/control/citation-documents");

  expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
});

test("control profile exposes the read-only parsed transcript catalog", async () => {
  renderApp("control", "/control/transcripts");

  expect(
    screen.getByRole("heading", { name: "Parsed transcripts" }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { name: "No parsed documents available" }),
  ).toBeInTheDocument();
});

test("public profile rejects parsed transcript routes", () => {
  renderApp("public", "/control/transcripts/document%3Afixture-001");

  expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
});

test("control profile exposes the equation-review API boundary", async () => {
  renderApp("control", "/control/equation-review");

  expect(
    await screen.findByRole("heading", { name: "Equation review is unavailable" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("pizzi2020 is not configured for equation review on this API."),
  ).toBeInTheDocument();
});

test("public profile rejects the equation-review route", () => {
  renderApp("public", "/control/equation-review");

  expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
});

test("control profile exposes the note-review prototype", () => {
  renderApp("control", "/control/note-review");

  expect(screen.getByRole("heading", { name: "Note review" })).toBeInTheDocument();
  expect(screen.getByText("No write capability")).toBeInTheDocument();
});
