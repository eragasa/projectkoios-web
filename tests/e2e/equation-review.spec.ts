import { expect, test } from "@playwright/test";

const candidateId = "equation:pizzi2020:page-7:region-1";
const unassistedId = "equation:pizzi2020:page-8:region-1";
const sourceSha256 = "a".repeat(64);
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

function deterministicEvidence(index: number) {
  return {
    candidate_sha256: (index + 1).toString(16).padStart(64, "0"),
    evidence_sha256: (index + 2).toString(16).padStart(64, "0"),
    raw_text: `deterministic equation evidence ${index}`,
    source_label: "pizzi2020.pdf",
    confidence: 0.9,
    evidence_status: "READY",
    source_block_id: `source-block-${index}`,
    detection_input_id: `detection-input-${index}`,
    warning_ids: [],
    processor_name: "pdf-operator-detector",
    processor_version: "1.0.0",
    configuration_digest: `configuration-${index}`,
  };
}

function assistedCandidate(decision = legacyDecision) {
  return {
    candidate_id: candidateId,
    source: {
      document_id: "pizzi2020",
      source_sha256: sourceSha256,
      page_index: 6,
      physical_page: 7,
      printed_page_label: "6",
    },
    region: {
      coordinate_space: "PDF_POINTS",
      x: 72,
      y: 188,
      width: 420,
      height: 96,
      image_sha256: "b".repeat(64),
    },
    deterministic_evidence: deterministicEvidence(6),
    assistance: {
      status: "AUTOMATED_UNREVIEWED",
      method: "local-equation-transcriber@1",
      proposal_sha256: proposalSha256,
      proposed_latex: proposalLatex,
      attempt_id: "attempt-007",
    },
    display_mode: "DISPLAY",
    status: decision.status,
    current_revision: decision.revision,
    expected_previous_revision: decision.revision,
    decision,
  };
}

function unassistedCandidate() {
  return {
    candidate_id: unassistedId,
    source: {
      document_id: "pizzi2020",
      source_sha256: sourceSha256,
      page_index: 7,
      physical_page: 8,
      printed_page_label: "7",
    },
    region: {
      coordinate_space: "PDF_POINTS",
      x: 80,
      y: 220,
      width: 400,
      height: 80,
      image_sha256: "c".repeat(64),
    },
    deterministic_evidence: deterministicEvidence(7),
    assistance: {
      status: "NOT_STARTED",
      attempt_id: null,
      method: null,
      proposal_sha256: null,
      proposed_latex: null,
    },
    display_mode: "DISPLAY",
    status: "UNREVIEWED",
    current_revision: 0,
    expected_previous_revision: 0,
    decision: null,
  };
}

function queue(decision = legacyDecision, projection = "projection-1") {
  return {
    contract_id: "projectkoios.api.equation-review",
    schema_version: 1,
    projection_id: `equation-review-queue:sha256:${projection}`,
    package_id: "equation-review-package:sha256:package-1",
    document_id: "pizzi2020",
    source_sha256: sourceSha256,
    total: 2,
    decided: 1,
    pending: 1,
    items: [assistedCandidate(decision), unassistedCandidate()],
  };
}

async function routeMixedQueue(page: import("@playwright/test").Page) {
  await page.route("**/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route(/\/equation-reviews\/.*\/region(?:\?.*)?$/, (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
}

test("navigates a mixed queue and records an exact schema-3 correction", async ({
  page,
}) => {
  let currentDecision = legacyDecision;
  let projection = "projection-1";

  await routeMixedQueue(page);
  await page.route("**/equation-reviews?document_id=pizzi2020", (route) =>
    route.fulfill({ json: queue(currentDecision, projection) }),
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
    projection = "projection-2";
    await route.fulfill({ json: { candidate_id: candidateId, ...currentDecision } });
  });

  await page.goto(
    `/control/equation-review?candidate=${encodeURIComponent(candidateId)}`,
  );
  await expect(page.getByText("2 total · 1 decided · 1 pending")).toBeVisible();
  await expect(page.getByText("Unaccepted assisted proposal")).toBeVisible();
  await expect(page.getByText(/Schema 2 · revision 1/)).toBeVisible();
  await expect(page.getByLabel("Deterministic raw equation text")).toContainText(
    "deterministic equation evidence 6",
  );
  await expect(page.getByLabel("Proposed LaTeX", { exact: true })).toHaveText(
    proposalLatex,
  );
  await expect(page.getByLabel("Canonical proposed Obsidian Markdown")).toHaveValue(
    `$$\n${proposalBody}\n$$`,
  );
  await expect(
    page.getByLabel("Rendered proposed LaTeX").locator(".katex"),
  ).toBeVisible();

  const accept = page.getByRole("button", { name: "Accept reviewed transcription" });
  await expect(accept).toBeDisabled();
  await page.getByRole("button", { name: "Render current correction" }).click();
  await expect(accept).toBeEnabled();
  await page.getByLabel("Reviewer note").fill("Region and notation checked.");
  await accept.click();

  await expect(
    page.getByText(/Owner recorded schema 3 review revision 2/),
  ).toContainText("2026-09-29T04:00:00Z");
  await expect(page.getByText(/Schema 3 · revision 2/)).toBeVisible();
  await expect(page).toHaveURL(
    new RegExp(`candidate=${encodeURIComponent(candidateId)}`),
  );

  await page.getByRole("button", { name: "Next candidate" }).click();
  await expect(page.getByRole("heading", { name: unassistedId })).toBeVisible();
  await expect(page.getByText("No proposal available")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Accept reviewed transcription" }),
  ).toBeDisabled();
});

test("guards mixed-queue navigation after an editor mutation and discards explicitly", async ({
  page,
}) => {
  await routeMixedQueue(page);
  await page.route("**/equation-reviews?document_id=pizzi2020", (route) =>
    route.fulfill({ json: queue() }),
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

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("alertdialog")).toContainText(
    "Discard unsubmitted changes?",
  );
  await expect(page.getByRole("heading", { name: candidateId })).toBeVisible();

  await page.getByRole("button", { name: "Discard changes and continue" }).click();
  await expect(page.getByRole("heading", { name: unassistedId })).toBeVisible();
  await expect(page).toHaveURL(
    new RegExp(`candidate=${encodeURIComponent(unassistedId)}`),
  );
  await expect(page.getByLabel("Reviewer LaTeX")).toBeDisabled();
});
