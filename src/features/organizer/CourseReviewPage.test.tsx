import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { CourseReviewPage } from "./CourseReviewPage";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CourseReviewPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((request: RequestInfo | URL) => {
      const url = String(request);
      let body: object;
      if (url === "/api/courses") {
        body = {
          schema_version: "1",
          reviewed_on: "2026-09-22",
          source: null,
          publication_boundary: ["Metadata only."],
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
                  id: "pacific.math157",
                  code: "MATH157",
                  title: "Applied Differential Equations II",
                  materials_status: "review-candidate",
                },
              ],
            },
          ],
          unresolved_collections: [],
        };
      } else if (url === "/organizer/status") {
        body = {
          desired_mode: "on",
          activity: "idle",
          discovered_roots: 2,
          observed_files: 100,
          local_files: 90,
          placeholder_files: 10,
          proposed_files: 2,
          last_event_sequence: 4,
          current_root_id: null,
          current_relative_path: null,
          last_error: null,
        };
      } else if (url.startsWith("/organizer/proposals?")) {
        body = {
          total: 2,
          complete: true,
          proposals: [
            proposal("1", "Courses/ENGR219/Homework/example.m", "ENGR219"),
            proposal("2", "Teaching/uncategorized/notes.txt", "Course notes"),
          ],
        };
      } else {
        return Promise.resolve(new Response("not found", { status: 404 }));
      }
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

test("starts course review from read-only organizer proposals", async () => {
  renderPage();

  expect(
    await screen.findByRole("heading", { name: "Numerical Methods for Engineering" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Courses/ENGR219/Homework/example.m")).toBeInTheDocument();
  expect(
    screen.getByText(
      "This catalog review candidate has no matching organizer proposal yet.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Unmatched proposals" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Teaching/uncategorized/notes.txt")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: /Inspect organization agent/ }),
  ).toHaveAttribute("href", "/control/organizer");
  expect(screen.queryByRole("button", { name: /publish/i })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
});

function proposal(id: string, relativePath: string, suggestedGroup: string) {
  return {
    file_id: id.repeat(64),
    root_id: "a".repeat(64),
    relative_path: relativePath,
    name: relativePath.split("/").at(-1),
    extension: ".txt",
    byte_size: 10,
    availability: "local",
    para_category: "resource",
    life_domain: "teaching",
    confidence: 0.9,
    suggested_group: suggestedGroup,
    rationale: "Metadata suggests teaching material.",
    model: "fixture",
    model_digest: "b".repeat(64),
    proposed_at: "2026-09-22 12:00:00",
  };
}
