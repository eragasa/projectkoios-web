import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { PublicationsPage } from "./PublicationsPage";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <PublicationsPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders an explicit empty publication state", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ schema_version: "1", publications: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );

  renderPage();

  expect(
    await screen.findByRole("heading", { name: "No public records yet" }),
  ).toBeInTheDocument();
});

test("renders reviewed scope and limitations from a public record", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            schema_version: "1",
            publications: [
              {
                id: "software.example",
                slug: "example",
                kind: "software",
                title: "Example software",
                summary: "A bounded software publication.",
                authors: ["Project Koios"],
                published_on: "2026-09-22",
                version: "1.0.0",
                citation: "Project Koios (2026). Example software.",
                topics: ["research software"],
                claims: ["Portable software checks passed."],
                limitations: ["No scientific validation is claimed."],
                links: [
                  {
                    label: "Repository",
                    url: "https://example.test/repository",
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
    await screen.findByRole("heading", { name: "Example software" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Portable software checks passed.")).toBeInTheDocument();
  expect(screen.getByText("No scientific validation is claimed.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Repository/ })).toHaveAttribute(
    "href",
    "https://example.test/repository",
  );
});

test("shows an unavailable state when the catalog request fails", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response("unavailable", { status: 503 }))),
  );

  renderPage();

  expect(
    await screen.findByRole("heading", { name: "Publication catalog unavailable" }),
  ).toBeInTheDocument();
});
