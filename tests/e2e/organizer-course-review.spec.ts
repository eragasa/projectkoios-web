import { expect, test } from "@playwright/test";

test("reviews course candidates from organizer metadata", async ({ page }) => {
  await page.route("**/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("**/api/courses", (route) =>
    route.fulfill({
      json: {
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
            ],
          },
        ],
        unresolved_collections: [],
      },
    }),
  );
  await page.route("**/organizer/status", (route) =>
    route.fulfill({
      json: {
        desired_mode: "on",
        activity: "idle",
        discovered_roots: 2,
        observed_files: 100,
        local_files: 90,
        placeholder_files: 10,
        proposed_files: 1,
        last_event_sequence: 4,
        current_root_id: null,
        current_relative_path: null,
        last_error: null,
      },
    }),
  );
  await page.route("**/organizer/proposals?**", (route) =>
    route.fulfill({
      json: {
        total: 1,
        complete: true,
        proposals: [
          {
            file_id: "1".repeat(64),
            root_id: "2".repeat(64),
            relative_path: "Courses/ENGR219/Homework/example.m",
            name: "example.m",
            extension: ".m",
            byte_size: 128,
            availability: "local",
            para_category: "resource",
            life_domain: "teaching",
            confidence: 0.9,
            suggested_group: "ENGR219",
            rationale: "The path names a known course code.",
            model: "fixture",
            model_digest: "3".repeat(64),
            proposed_at: "2026-09-22 12:00:00",
          },
        ],
      },
    }),
  );

  await page.goto("/control/courses");

  await expect(page.getByRole("heading", { name: "Course review" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Numerical Methods for Engineering" }),
  ).toBeVisible();
  await expect(page.getByText("Courses/ENGR219/Homework/example.m")).toBeVisible();
  await expect(page.getByRole("button", { name: /publish/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /approve/i })).toHaveCount(0);
});
