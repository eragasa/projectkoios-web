import { expect, test } from "@playwright/test";

test("searches through the Project Koios interface", async ({ page }) => {
  await page.route("**/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("**/search", (route) => {
    if (route.request().method() !== "POST") {
      return route.continue();
    }
    return route.fulfill({
      json: [
        {
          title: "bands.md",
          path: "physics/bands.md",
          snippet: "Bloch states follow lattice translation symmetry.",
          score: 1,
          object_type: "obsidian_note",
        },
      ],
    });
  });

  await page.goto("/search");
  await page
    .getByPlaceholder("Search concepts, equations, sources…")
    .fill("Bloch theorem");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(page.getByRole("heading", { name: "bands.md" })).toBeVisible();
  await expect(page.getByText("physics/bands.md")).toBeVisible();
});
