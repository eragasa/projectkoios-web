import { expect, test } from "@playwright/test";

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
