import { expect, test } from "@playwright/test";

test("offers useful public next actions and page metadata", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Project Koios");
  await expect(page.getByRole("link", { name: "Browse courses" })).toHaveAttribute(
    "href",
    "/courses",
  );
  await expect(page.getByRole("link", { name: /Follow development/ })).toHaveAttribute(
    "href",
    "https://github.com/eragasa/projectkoios/issues",
  );
  await expect(page.getByRole("link", { name: /Apache-2.0 license/ })).toBeVisible();
});

test("presents course identities without publishing course materials", async ({
  page,
}) => {
  await page.route("**/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("**/api/courses", (route) =>
    route.fulfill({
      json: {
        schema_version: "1",
        reviewed_on: "2026-09-22",
        source: {
          repository: "eragasa/projectkoios-courses",
          revision: "7bd6ce797d10381d436b89dbc12b226a95719d42",
          url: "https://github.com/eragasa/projectkoios-courses",
        },
        publication_boundary: ["Course identity is public; materials are not."],
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
            ],
          },
        ],
        unresolved_collections: [],
      },
    }),
  );

  await page.goto("/courses");

  await expect(
    page.getByRole("heading", { name: "Numerical Methods for Engineering" }),
  ).toBeVisible();
  await expect(page.getByText("Review candidate", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Published materials").locator("..").getByText("0"),
  ).toBeVisible();
});

test("presents a bounded public project overview", async ({ page }) => {
  await page.route("**/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("**/api/projects", (route) =>
    route.fulfill({
      json: {
        schema_version: "1",
        projects: [
          {
            id: "projectkoios",
            slug: "projectkoios",
            name: "Project Koios",
            tagline: "Evidence-connected scientific work.",
            summary: "A local-first platform under active development.",
            status: "active-development",
            review: {
              record_version: "1.0.0",
              reviewed_on: "2026-09-22",
              review_url: "https://github.com/eragasa/projectkoios/pull/6",
            },
            source_revisions: [
              {
                repository: "eragasa/projectkoios",
                revision: "fc551cf841199c219df76f672e37f2c5e494b282",
                url: "https://github.com/eragasa/projectkoios/commit/fc551cf841199c219df76f672e37f2c5e494b282",
              },
            ],
            evidence: [
              {
                label: "Public overview review",
                url: "https://github.com/eragasa/projectkoios/pull/6",
              },
            ],
            topics: ["research software"],
            purposes: ["Keep outputs connected to evidence."],
            principles: ["Explicit provenance"],
            capabilities: [
              {
                name: "Public publishing foundation",
                status: "available",
                summary: "Presents explicitly configured public records.",
              },
            ],
            limitations: ["No scientific validation is implied."],
            links: [],
          },
        ],
      },
    }),
  );

  await page.goto("/projects");

  await expect(page.getByRole("heading", { name: "Project Koios" })).toBeVisible();
  await expect(page.getByText("Public publishing foundation")).toBeVisible();
  await expect(page.getByText("No scientific validation is implied.")).toBeVisible();
  await expect(page.getByText("fc551cf84119")).toBeVisible();
});

test("presents a bounded public publication record", async ({ page }) => {
  await page.route("**/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("**/api/publications", (route) =>
    route.fulfill({
      json: {
        schema_version: "1",
        publications: [
          {
            id: "software.example",
            slug: "example",
            kind: "software",
            title: "Example research software",
            summary: "A reviewed software record.",
            authors: ["Project Koios"],
            published_on: "2026-09-22",
            version: "1.0.0",
            citation: null,
            topics: ["research software"],
            claims: ["The package passes its declared software checks."],
            limitations: ["Scientific validation is outside this record."],
            links: [],
          },
        ],
      },
    }),
  );

  await page.goto("/publications");

  await expect(
    page.getByRole("heading", { name: "Example research software" }),
  ).toBeVisible();
  await expect(
    page.getByText("Scientific validation is outside this record."),
  ).toBeVisible();
});
