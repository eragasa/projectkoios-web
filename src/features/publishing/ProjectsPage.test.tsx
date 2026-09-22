import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { ProjectsPage } from "./ProjectsPage";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectsPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders a bounded public project overview", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            schema_version: "1",
            projects: [
              {
                id: "projectkoios",
                slug: "projectkoios",
                name: "Project Koios",
                tagline: "Evidence-connected scientific work.",
                summary: "A local-first platform under active development.",
                status: "active-development",
                topics: ["research software"],
                purposes: ["Keep outputs connected to evidence."],
                principles: ["Explicit provenance"],
                capabilities: [
                  {
                    name: "Public publishing foundation",
                    status: "available",
                    summary: "Presents explicitly configured public records.",
                  },
                  {
                    name: "Broader workflow operations",
                    status: "in-development",
                    summary: "Remain bounded development work.",
                  },
                ],
                limitations: ["No scientific validation is implied."],
                links: [
                  {
                    label: "Project repository",
                    url: "https://github.com/eragasa/projectkoios",
                  },
                ],
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
    await screen.findByRole("heading", { name: "Project Koios" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Public publishing foundation")).toBeInTheDocument();
  expect(screen.getByText("available")).toBeInTheDocument();
  expect(screen.getByText("in-development")).toBeInTheDocument();
  expect(screen.getByText("No scientific validation is implied.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Project repository/ })).toHaveAttribute(
    "href",
    "https://github.com/eragasa/projectkoios",
  );
});

test("renders an honest empty project state", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ schema_version: "1", projects: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );

  renderPage();

  expect(
    await screen.findByRole("heading", { name: "No public project records yet" }),
  ).toBeInTheDocument();
});
