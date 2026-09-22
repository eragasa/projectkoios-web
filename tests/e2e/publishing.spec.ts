import { expect, test } from "@playwright/test";

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
