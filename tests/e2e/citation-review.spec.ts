import { expect, test } from "@playwright/test";

const summary = {
  claim_id: "appendix-g-001",
  lines: "34-45",
  claim: "Localized models require a checked citation.",
  recommendation_relationship: "DIRECT_SUPPORT",
  recommended_keys: ["source2024"],
  evaluation_status: "HIT",
  decision: null,
};

test("reviews citation evidence without editing the manuscript", async ({ page }) => {
  await page.route("**/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("**/citation-reviews", (route) =>
    route.fulfill({
      json: {
        assessment: "AI_REVIEWED_UNVERIFIED",
        manuscript_sha256: "a".repeat(64),
        total: 1,
        decided: 0,
        items: [summary],
      },
    }),
  );
  await page.route("**/citation-reviews/appendix-g-001", (route) =>
    route.fulfill({
      json: {
        ...summary,
        query: "localized model citation",
        manuscript_excerpt_latex: "Energy is $E=mc^2$.",
        manuscript_equations: [{ latex: "E=mc^2", display: false }],
        expected_keys: ["source2024"],
        expected_keys_available: ["source2024"],
        expected_outcome: "candidate_source",
        recommendation: "Inspect the candidate passage before accepting it.",
        candidates: [
          {
            rank: 1,
            citation_key: "source2024",
            bibtex_entry_present: true,
            score: 9.25,
            file: "source2024.pdf",
            physical_page: 3,
            printed_page: "2",
            passage_id: "passage:1",
            passage: "Evidence supporting the manuscript claim.",
          },
        ],
      },
    }),
  );
  await page.route("**/citation-reviews/appendix-g-001/decision", async (route) => {
    expect(route.request().method()).toBe("PUT");
    expect(route.request().postDataJSON()).toEqual({
      disposition: "ACCEPT_CITATION",
      selected_citation_keys: ["source2024"],
      note: "Passage checked.",
    });
    await route.fulfill({
      json: {
        claim_id: "appendix-g-001",
        disposition: "ACCEPT_CITATION",
        selected_citation_keys: ["source2024"],
        note: "Passage checked.",
        revision: 1,
        updated_at_utc: "2026-09-20T22:00:00+00:00",
      },
    });
  });

  await page.goto("/control/citation-review");
  await expect(
    page.getByText("Evidence supporting the manuscript claim."),
  ).toBeVisible();
  await expect(page.locator(".katex")).toBeVisible();
  await expect(page.getByRole("button", { name: "Preview PDF page" })).toBeVisible();
  await page.getByRole("radio", { name: "Accept citation" }).check();
  await page.getByRole("checkbox", { name: /source2024/ }).check();
  await page.getByLabel("Reviewer note").fill("Passage checked.");
  await page.getByRole("button", { name: "Save review decision" }).click();

  await expect(page.getByText("Decision saved privately.")).toBeVisible();
});
