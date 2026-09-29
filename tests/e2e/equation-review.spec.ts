import { expect, test } from "@playwright/test";

const candidateId = "equation:pizzi2020:page-7:region-1";
const proposalSha256 =
  "7b2cea6aedc049b92dd9b87e7ee46f9d7e9906287e8172d052773d6881ad8bce";
const proposalLatex =
  "$\\psi_{n\\mathbf{k}}(\\mathbf{r}) = u_{n\\mathbf{k}}(\\mathbf{r})\\mathrm{e}^{i\\mathbf{k}\\cdot\\mathbf{r}},$";
const proposalBody =
  "\\psi_{n\\mathbf{k}}(\\mathbf{r}) = u_{n\\mathbf{k}}(\\mathbf{r})\\mathrm{e}^{i\\mathbf{k}\\cdot\\mathbf{r}},";
const latexSha256 = "2a26209ba3aa7d6b6879964255f07e22177811566ce5e830c434ea7230b6e0d5";
const markdownSha256 =
  "4d4ac48f44bc211c728fa23b72b696228455dcb72fc327e4c4735a6ba0cbc777";

const legacyDecision = {
  schema_version: 2,
  status: "LEGACY_ACCEPTANCE",
  disposition: "ACCEPT_TRANSCRIPTION",
  assistance_proposal_sha256: proposalSha256,
  reviewer_latex: null,
  reviewer_latex_sha256: null,
  display_mode: null,
  obsidian_markdown: null,
  obsidian_markdown_sha256: null,
  render_confirmation: null,
  note: "Legacy acceptance",
  revision: 1,
  revision_id: "equation-review-revision:sha256:legacy",
  recorded_at_utc: "2026-09-28T17:00:00Z",
};

function queue(decision = legacyDecision) {
  return {
    document_id: "pizzi2020",
    total: 1,
    decided: 1,
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
          proposed_latex: proposalLatex,
          attempt_id: "attempt-007",
          model_provenance: {
            model_name: "equation-reader",
            model_sha256: "e".repeat(64),
            prompt_version: "equation-review-v3",
            request_id: "request-007",
            result_id: "result-007",
          },
        },
        display_mode: "DISPLAY",
        status: decision.status,
        current_revision: decision.revision,
        expected_previous_revision: decision.revision,
        decision,
      },
    ],
  };
}

test("renders and records an exact schema-3 correction without browser Markdown authority", async ({
  page,
}) => {
  let currentDecision = legacyDecision;

  await page.route("**/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("**/equation-reviews?document_id=pizzi2020", (route) =>
    route.fulfill({ json: queue(currentDecision) }),
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
      reviewer_latex: proposalBody,
      display_mode: "DISPLAY",
      render_confirmation: {
        renderer_id: "katex",
        renderer_version: "0.16.47",
        rendered_reviewer_latex_sha256: latexSha256,
        rendered_obsidian_markdown_sha256: markdownSha256,
      },
      note: "Region and notation checked.",
      expected_previous_revision: 1,
    });
    currentDecision = {
      schema_version: 3,
      status: "ACCEPTED",
      disposition: "ACCEPT_TRANSCRIPTION",
      assistance_proposal_sha256: proposalSha256,
      reviewer_latex: proposalBody,
      reviewer_latex_sha256: latexSha256,
      display_mode: "DISPLAY",
      obsidian_markdown: `$$\n${proposalBody}\n$$`,
      obsidian_markdown_sha256: markdownSha256,
      render_confirmation: {
        renderer_id: "katex",
        renderer_version: "0.16.47",
        rendered_reviewer_latex_sha256: latexSha256,
        rendered_obsidian_markdown_sha256: markdownSha256,
      },
      note: "Region and notation checked.",
      revision: 2,
      revision_id: "equation-review-revision:sha256:schema3",
      recorded_at_utc: "2026-09-29T04:00:00Z",
    };
    await route.fulfill({ json: { candidate_id: candidateId, ...currentDecision } });
  });

  await page.goto("/control/equation-review");
  await expect(page.getByText("Unaccepted assisted proposal")).toBeVisible();
  await expect(page.getByText(/Schema 2 · revision 1/)).toBeVisible();
  await expect(page.getByLabel("Proposed LaTeX", { exact: true })).toHaveText(
    proposalLatex,
  );
  await expect(page.getByLabel("Canonical proposed Obsidian Markdown")).toHaveValue(
    `$$\n${proposalBody}\n$$`,
  );
  await expect(
    page.getByLabel("Rendered proposed LaTeX").locator(".katex"),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Reviewer LaTeX" })).toHaveValue(
    proposalBody,
  );

  const accept = page.getByRole("button", { name: "Accept reviewed transcription" });
  await expect(accept).toBeDisabled();
  await page.getByRole("button", { name: "Render current correction" }).click();
  await expect(
    page.getByLabel("Rendered reviewer LaTeX").locator(".katex"),
  ).toBeVisible();
  await expect(accept).toBeEnabled();
  await page.getByLabel("Reviewer note").fill("Region and notation checked.");
  await accept.click();

  await expect(
    page.getByText(/Owner recorded schema 3 review revision 2/),
  ).toContainText("2026-09-29T04:00:00Z");
  await expect(page.getByText(/Schema 3 · revision 2/)).toBeVisible();
});

test("editing after rendering immediately clears previews and disables acceptance", async ({
  page,
}) => {
  await page.route("**/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route("**/equation-reviews?document_id=pizzi2020", (route) =>
    route.fulfill({ json: queue() }),
  );
  await page.route(/\/equation-reviews\/.*\/region$/, (route) =>
    route.fulfill({ contentType: "image/png", body: Buffer.from("") }),
  );

  await page.goto("/control/equation-review");
  await page.getByRole("button", { name: "Render current correction" }).click();
  const accept = page.getByRole("button", { name: "Accept reviewed transcription" });
  await expect(accept).toBeEnabled();

  await page
    .getByRole("textbox", { name: "Reviewer LaTeX" })
    .fill(`${proposalBody} + V`);
  await expect(accept).toBeDisabled();
  await expect(page.getByLabel("Rendered reviewer LaTeX")).toHaveCount(0);
  await expect(
    page.getByText(/Render the current correction to create this preview/),
  ).toHaveCount(2);
});
