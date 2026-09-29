import { expect, test } from "@playwright/test";

const candidateId = "equation:pizzi2020:page-7:region-1";
const proposalSha256 = "d".repeat(64);

test("records an owner-bound equation decision without a browser timestamp", async ({
  page,
}) => {
  await page.route("**/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("**/equation-reviews?document_id=pizzi2020", (route) =>
    route.fulfill({
      json: {
        document_id: "pizzi2020",
        total: 1,
        decided: 0,
        items: [
          {
            candidate_id: candidateId,
            source: {
              document_id: "pizzi2020",
              source_name: "pizzi2020.pdf",
              source_sha256: "a".repeat(64),
              physical_page: 7,
            },
            region: {
              coordinate_space: "PDF_POINTS",
              x: 72,
              y: 188,
              width: 420,
              height: 96,
              image_sha256: "b".repeat(64),
            },
            deterministic_evidence: {
              detector: "pdf-operator-detector",
              detector_version: "1.0.0",
              evidence_sha256: "c".repeat(64),
              extracted_text: "E = E_0 + k^2 / 2m",
            },
            assistance: {
              status: "PROPOSED",
              method: "local-equation-transcriber@1",
              proposal_sha256: proposalSha256,
              proposed_latex: "E = E_0 + \\frac{k^2}{2m}",
            },
            decision: null,
          },
        ],
      },
    }),
  );
  await page.route(/\/equation-reviews\/.*\/region$/, (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.route(/\/equation-reviews\/.*\/decision$/, async (route) => {
    expect(route.request().method()).toBe("PUT");
    expect(route.request().postDataJSON()).toEqual({
      disposition: "ACCEPT_TRANSCRIPTION",
      assistance_proposal_sha256: proposalSha256,
      note: "Region and notation checked.",
      expected_previous_revision: 0,
    });
    await route.fulfill({
      json: {
        candidate_id: candidateId,
        disposition: "ACCEPT_TRANSCRIPTION",
        assistance_proposal_sha256: proposalSha256,
        note: "Region and notation checked.",
        revision: 1,
        updated_at_utc: "2026-09-29T04:00:00Z",
      },
    });
  });

  await page.goto("/control/equation-review");
  await expect(page.getByText("Unaccepted assisted proposal")).toBeVisible();
  await page.getByRole("radio", { name: "Accept this assisted transcription" }).check();
  await page.getByLabel("Reviewer note").fill("Region and notation checked.");
  await page.getByRole("button", { name: "Save human review" }).click();

  await expect(page.getByText(/Owner recorded human review revision 1/)).toContainText(
    "2026-09-29T04:00:00Z",
  );
});
