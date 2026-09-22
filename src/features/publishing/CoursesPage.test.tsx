import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CoursesPage } from "./CoursesPage";

const catalog = {
  schema_version: "1",
  reviewed_on: "2026-09-22",
  source: {
    repository: "eragasa/projectkoios-courses",
    revision: "7bd6ce797d10381d436b89dbc12b226a95719d42",
    url: "https://github.com/eragasa/projectkoios-courses/blob/7bd6ce797d10381d436b89dbc12b226a95719d42/docs/migration/course-source-inventory.md",
  },
  publication_boundary: ["This catalog publishes course identity only."],
  institutions: [
    {
      id: "pacific",
      name: "University of the Pacific",
      courses: [
        {
          id: "pacific.engr219",
          code: "ENGR219",
          title: "Numerical Methods for Engineering",
          materials_status: "review-candidate",
        },
        {
          id: "pacific.phys181",
          code: "PHYS181",
          title: null,
          materials_status: "inventory-only",
        },
      ],
    },
    {
      id: "uf",
      name: "University of Florida",
      courses: [
        {
          id: "uf.ema6114",
          code: "EMA6114",
          title: null,
          materials_status: "inventory-only",
        },
      ],
    },
  ],
  unresolved_collections: ["Historical collections without course codes."],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CoursesPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders course identities without claiming materials are published", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(catalog), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );

  renderPage();

  expect(
    await screen.findByRole("heading", { name: "Numerical Methods for Engineering" }),
  ).toBeInTheDocument();
  expect(screen.getByText("3", { selector: "dd" })).toBeInTheDocument();
  expect(screen.getByText("Review candidate")).toBeInTheDocument();
  expect(screen.getAllByText("Inventory only")).toHaveLength(2);
  expect(screen.getByText("Published materials").nextSibling).toHaveTextContent("0");
  expect(
    screen.getByRole("link", { name: /Inspect the source inventory/ }),
  ).toHaveAttribute("href", catalog.source.url);
});

test("filters courses by search text and institution", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(catalog), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );

  renderPage();
  await screen.findByText("ENGR219");

  await user.type(screen.getByRole("searchbox", { name: "Search courses" }), "EMA");
  expect(screen.getByText("EMA6114")).toBeInTheDocument();
  expect(screen.queryByText("ENGR219")).not.toBeInTheDocument();

  await user.clear(screen.getByRole("searchbox", { name: "Search courses" }));
  await user.selectOptions(
    screen.getByRole("combobox", { name: "Institution" }),
    "pacific",
  );
  expect(screen.getByText("ENGR219")).toBeInTheDocument();
  expect(screen.queryByText("EMA6114")).not.toBeInTheDocument();
});
