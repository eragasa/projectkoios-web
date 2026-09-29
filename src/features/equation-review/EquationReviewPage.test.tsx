import { webcrypto } from "node:crypto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type {
  EquationReviewCandidate,
  EquationReviewQueueResponse,
} from "../../api/client";
import { EquationReviewPage } from "./EquationReviewPage";

const candidateId = "equation-candidate:sha256:review-1";
const sourceSha256 = "a".repeat(64);
const proposalLatex =
  "$\\psi_{n\\mathbf{k}}(\\mathbf{r}) = u_{n\\mathbf{k}}(\\mathbf{r})\\mathrm{e}^{i\\mathbf{k}\\cdot\\mathbf{r}},$";
const proposalBody =
  "\\psi_{n\\mathbf{k}}(\\mathbf{r}) = u_{n\\mathbf{k}}(\\mathbf{r})\\mathrm{e}^{i\\mathbf{k}\\cdot\\mathbf{r}},";
const proposalSha256 =
  "7b2cea6aedc049b92dd9b87e7ee46f9d7e9906287e8172d052773d6881ad8bce";
const reviewerLatexSha256 =
  "2a26209ba3aa7d6b6879964255f07e22177811566ce5e830c434ea7230b6e0d5";
const reviewerMarkdownSha256 =
  "4d4ac48f44bc211c728fa23b72b696228455dcb72fc327e4c4735a6ba0cbc777";

function candidate(
  overrides: Partial<EquationReviewCandidate> = {},
): EquationReviewCandidate {
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
    deterministic_evidence: {
      candidate_sha256: "c".repeat(64),
      evidence_sha256: "d".repeat(64),
      raw_text: "E = E_0 + k^2 / 2m",
      source_label: "pizzi2020.pdf",
      confidence: 0.91,
      evidence_status: "READY",
      source_block_id: "source-block-7",
      detection_input_id: "detection-input-7",
      warning_ids: [],
      processor_name: "pdf-operator-detector",
      processor_version: "1.0.0",
      configuration_digest: "configuration-sha256-7",
    },
    assistance: {
      status: "AUTOMATED_UNREVIEWED",
      method: "local-equation-transcriber@1",
      proposal_sha256: proposalSha256,
      proposed_latex: proposalLatex,
      attempt_id: "attempt-007",
    },
    display_mode: "DISPLAY",
    status: "UNREVIEWED",
    current_revision: 0,
    expected_previous_revision: 0,
    decision: null,
    ...overrides,
  };
}

function candidateWithIdentity(
  id: string,
  index: number,
  overrides: Partial<EquationReviewCandidate> = {},
): EquationReviewCandidate {
  const base = candidate();
  return {
    ...base,
    candidate_id: id,
    source: {
      ...base.source,
      page_index: index,
      physical_page: index + 1,
      printed_page_label: String(index),
    },
    region: {
      ...base.region,
      y: index * 10,
      image_sha256: index.toString(16).padStart(64, "0"),
    },
    deterministic_evidence: {
      ...base.deterministic_evidence,
      candidate_sha256: (index + 1).toString(16).padStart(64, "0"),
      evidence_sha256: (index + 2).toString(16).padStart(64, "0"),
      raw_text: `deterministic evidence ${index}`,
      source_block_id: `source-block-${index}`,
      detection_input_id: `detection-input-${index}`,
    },
    ...overrides,
  };
}

function unassistedCandidate(id = "equation:unassisted", index = 1) {
  return candidateWithIdentity(id, index, {
    assistance: {
      status: "NOT_STARTED",
      attempt_id: null,
      method: null,
      proposal_sha256: null,
      proposed_latex: null,
    },
  });
}

function candidateWithProposal(rawProposal: string): EquationReviewCandidate {
  const item = candidate();
  if (item.assistance.status !== "AUTOMATED_UNREVIEWED") {
    throw new Error("test candidate must carry proposed assistance");
  }
  return {
    ...item,
    assistance: { ...item.assistance, proposed_latex: rawProposal },
  };
}

function schema2Candidate(id = candidateId, index = 6): EquationReviewCandidate {
  return candidateWithIdentity(id, index, {
    status: "LEGACY_ACCEPTANCE",
    current_revision: 1,
    expected_previous_revision: 1,
    decision: {
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
      note: "Legacy review",
      revision: 1,
      revision_id: "equation-review-revision:sha256:legacy",
      recorded_at_utc: "2026-09-28T17:00:00Z",
    },
  });
}

function schema3Candidate(id = "equation:schema3", index = 2): EquationReviewCandidate {
  const acceptedLatex = "E = mc^2";
  return candidateWithIdentity(id, index, {
    status: "ACCEPTED",
    current_revision: 3,
    expected_previous_revision: 3,
    decision: {
      schema_version: 3,
      status: "ACCEPTED",
      disposition: "ACCEPT_TRANSCRIPTION",
      assistance_proposal_sha256: proposalSha256,
      reviewer_latex: acceptedLatex,
      reviewer_latex_sha256: "1".repeat(64),
      display_mode: "INLINE",
      obsidian_markdown: `$${acceptedLatex}$`,
      obsidian_markdown_sha256: "2".repeat(64),
      render_confirmation: {
        renderer_id: "katex",
        renderer_version: "0.16.47",
        rendered_reviewer_latex_sha256: "1".repeat(64),
        rendered_obsidian_markdown_sha256: "2".repeat(64),
      },
      note: "Accepted source",
      revision: 3,
      revision_id: "equation-review-revision:sha256:accepted",
      recorded_at_utc: "2026-09-30T04:00:00Z",
    },
  });
}

function rejectedCandidate(id = "equation:rejected", index = 4) {
  return candidateWithIdentity(id, index, {
    status: "REJECTED",
    current_revision: 1,
    expected_previous_revision: 1,
    decision: {
      schema_version: 3,
      status: "REJECTED",
      disposition: "REJECT_CANDIDATE",
      assistance_proposal_sha256: null,
      reviewer_latex: null,
      reviewer_latex_sha256: null,
      display_mode: null,
      obsidian_markdown: null,
      obsidian_markdown_sha256: null,
      render_confirmation: null,
      note: "Not an equation",
      revision: 1,
      revision_id: "equation-review-revision:sha256:rejected",
      recorded_at_utc: "2026-09-30T05:00:00Z",
    },
  });
}

function revisionRequiredCandidate(id = "equation:revision", index = 5) {
  return candidateWithIdentity(id, index, {
    status: "REVISION_REQUIRED",
    current_revision: 1,
    expected_previous_revision: 1,
    decision: {
      schema_version: 3,
      status: "REVISION_REQUIRED",
      disposition: "REVISION_REQUIRED",
      assistance_proposal_sha256: null,
      reviewer_latex: null,
      reviewer_latex_sha256: null,
      display_mode: null,
      obsidian_markdown: null,
      obsidian_markdown_sha256: null,
      render_confirmation: null,
      note: "Re-run transcription assistance",
      revision: 1,
      revision_id: "equation-review-revision:sha256:revision-required",
      recorded_at_utc: "2026-09-30T06:00:00Z",
    },
  });
}

function queue(
  items: EquationReviewCandidate[],
  overrides: Partial<EquationReviewQueueResponse> = {},
): EquationReviewQueueResponse {
  const decided = items.filter((item) => item.decision !== null).length;
  return {
    contract_id: "projectkoios.api.equation-review",
    schema_version: 1,
    projection_id: "equation-review-queue:sha256:projection-1",
    package_id: "equation-review-package:sha256:package-1",
    document_id: "pizzi2020",
    source_sha256: sourceSha256,
    total: items.length,
    decided,
    pending: items.length - decided,
    items,
    ...overrides,
  };
}

function responseJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

function renderPage({
  items = [candidate()],
  initialEntry = "/control/equation-review",
  fetchMock,
}: {
  items?: EquationReviewCandidate[];
  initialEntry?: string;
  fetchMock?: typeof fetch;
} = {}) {
  vi.stubGlobal(
    "fetch",
    fetchMock ?? vi.fn().mockResolvedValue(responseJson(queue(items))),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={client}>
        <EquationReviewPage />
        <LocationProbe />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return client;
}

function selectedCandidateFromUrl() {
  return new URLSearchParams(
    screen.getByTestId("location-search").textContent ?? "",
  ).get("candidate");
}

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("EquationReviewPage", () => {
  test("keeps source image first and renders owner-projected deterministic evidence", async () => {
    renderPage();

    const region = await screen.findByRole("heading", { name: "Source region" });
    const evidence = screen.getByRole("heading", { name: "Deterministic evidence" });
    const proposed = screen.getByRole("heading", { name: "Proposed" });
    const reviewer = screen.getByRole("heading", { name: "Reviewer" });

    expect(
      region.compareDocumentPosition(evidence) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      evidence.compareDocumentPosition(proposed) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      proposed.compareDocumentPosition(reviewer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByAltText(/physical page 7/)).toHaveAttribute(
      "src",
      `/equation-reviews/${encodeURIComponent(candidateId)}/region`,
    );
    expect(screen.getByLabelText("Deterministic raw equation text")).toHaveTextContent(
      "E = E_0 + k^2 / 2m",
    );

    expect(screen.getByLabelText("Proposed LaTeX")).toHaveTextContent(proposalLatex);
    expect(screen.getByLabelText("Canonical proposed Obsidian Markdown")).toHaveValue(
      `$$\n${proposalBody}\n$$`,
    );
    expect(
      screen.getByLabelText("Rendered proposed LaTeX").querySelector(".katex"),
    ).not.toBeNull();
    expect(
      screen.getByLabelText("Rendered proposed Markdown").querySelector("math"),
    ).not.toBeNull();
    expect(screen.getByText(/Derivation: STRIPPED_INLINE_DELIMITERS/)).toBeVisible();
  });

  test("preserves owner ordering, statuses, and deterministic Previous/Next navigation", async () => {
    const user = userEvent.setup();
    const items = [
      schema2Candidate("equation:legacy", 0),
      schema3Candidate("equation:schema3", 1),
      unassistedCandidate("equation:unassisted", 2),
      candidateWithIdentity("equation:assisted", 3),
      rejectedCandidate("equation:rejected", 4),
      revisionRequiredCandidate("equation:revision", 5),
    ];
    renderPage({ items });

    const queuePanel = await screen.findByRole("complementary", {
      name: "Equation candidate queue",
    });
    const buttons = within(queuePanel).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      expect.stringContaining("equation:legacy"),
      expect.stringContaining("equation:schema3"),
      expect.stringContaining("equation:unassisted"),
      expect.stringContaining("equation:assisted"),
      expect.stringContaining("equation:rejected"),
      expect.stringContaining("equation:revision"),
    ]);
    expect(
      within(queuePanel).getByText("6 total · 4 decided · 2 pending"),
    ).toBeVisible();
    expect(within(queuePanel).getByText(/Page 6 · revision required/)).toBeVisible();
    expect(
      await screen.findByRole("heading", { name: "equation:legacy" }),
    ).toBeVisible();
    await waitFor(() => expect(selectedCandidateFromUrl()).toBe("equation:legacy"));

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(
      await screen.findByRole("heading", { name: "equation:schema3" }),
    ).toBeVisible();
    expect(selectedCandidateFromUrl()).toBe("equation:schema3");
    expect(screen.getByText("Candidate 2 of 6")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(
      await screen.findByRole("heading", { name: "equation:legacy" }),
    ).toBeVisible();
  });

  test("reloads a stable opaque candidate selection from the URL", async () => {
    const items = [candidateWithIdentity("equation:first", 0), schema3Candidate()];
    renderPage({
      items,
      initialEntry: "/control/equation-review?candidate=equation%3Aschema3",
    });

    expect(
      await screen.findByRole("heading", { name: "equation:schema3" }),
    ).toBeVisible();
    expect(screen.getByText("Candidate 2 of 2")).toBeVisible();
    expect(screen.getByLabelText("Reviewer LaTeX")).toHaveValue("E = mc^2");
    expect(selectedCandidateFromUrl()).toBe("equation:schema3");
  });

  test("shows schema-2 and schema-3 latest decisions with their exact reviewer source", async () => {
    const user = userEvent.setup();
    renderPage({
      items: [schema2Candidate("equation:legacy", 0), schema3Candidate()],
    });

    expect(await screen.findByLabelText("Reviewer LaTeX")).toHaveValue(proposalBody);
    expect(screen.getByText(/Schema 2 · revision 1 · legacy acceptance/)).toBeVisible();
    expect(
      screen.getByText(/legacy acceptance has no canonical accepted reviewer source/i),
    ).toHaveTextContent("saving creates revision 2");

    await user.click(
      screen.getByRole("button", { name: /Select candidate 2 of 2: equation:schema3/ }),
    );
    expect(await screen.findByLabelText("Reviewer LaTeX")).toHaveValue("E = mc^2");
    expect(screen.getByLabelText("Reviewer display mode")).toHaveValue("INLINE");
    expect(screen.getByText(/Schema 3 · revision 3 · accepted/)).toBeVisible();
  });

  test("shows unassisted evidence while gating render and acceptance", async () => {
    renderPage({ items: [unassistedCandidate()] });

    expect(await screen.findByText("No proposal available")).toBeVisible();
    expect(screen.getByLabelText("Deterministic raw equation text")).toHaveTextContent(
      "deterministic evidence 1",
    );
    expect(screen.getByText(/Automated assistance has not started/)).toBeVisible();
    expect(screen.getByLabelText("Reviewer LaTeX")).toBeDisabled();
    expect(screen.getByLabelText("Reviewer display mode")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Render current correction" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Accept reviewed transcription" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Request correction" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reject candidate" })).toBeEnabled();
  });

  test("requires explicit discard before navigating away from an edited draft", async () => {
    const user = userEvent.setup();
    renderPage({
      items: [
        candidateWithIdentity("equation:first", 0),
        candidateWithIdentity("equation:second", 1),
      ],
    });

    const editor = await screen.findByLabelText("Reviewer LaTeX");
    await user.type(editor, " + V");
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "Discard unsubmitted changes?",
    );
    expect(screen.getByRole("heading", { name: "equation:first" })).toBeVisible();
    expect(selectedCandidateFromUrl()).toBe("equation:first");

    await user.click(screen.getByRole("button", { name: "Stay on candidate" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(editor).toHaveValue(`${proposalBody} + V`);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(
      screen.getByRole("button", { name: "Discard changes and continue" }),
    );
    expect(
      await screen.findByRole("heading", { name: "equation:second" }),
    ).toBeVisible();
    expect(selectedCandidateFromUrl()).toBe("equation:second");

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(
      await screen.findByRole("heading", { name: "equation:first" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Reviewer LaTeX")).toHaveValue(proposalBody);
  });

  test.each([
    ["$E = mc^2", "UNMATCHED_DELIMITER"],
    ["$$$E = mc^2$$$", "NESTED_OR_INTERNAL_DELIMITER"],
    ["$ E = mc^2$", "EDGE_WHITESPACE"],
    ["$E\r= mc^2$", "CARRIAGE_RETURN"],
    ["$e\u0301 = 1$", "NON_NFC"],
  ])(
    "preserves but blocks noncanonical proposal %j (%s)",
    async (rawProposal, reason) => {
      const user = userEvent.setup();
      renderPage({ items: [candidateWithProposal(rawProposal)] });

      expect((await screen.findByLabelText("Proposed LaTeX")).textContent).toBe(
        rawProposal,
      );
      expect(screen.getByLabelText("Canonical proposed Obsidian Markdown")).toHaveValue(
        "",
      );
      expect(screen.getByLabelText("Reviewer LaTeX")).toHaveValue("");
      expect(
        screen.getByRole("button", { name: "Render current correction" }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", { name: "Accept reviewed transcription" }),
      ).toBeDisabled();

      const summary = screen.getByText("Debug & Provenance");
      await user.click(summary);
      const details = summary.closest("details") as HTMLElement;
      expect(
        within(details).getAllByText(new RegExp(`INVALID · ${reason}`))[0],
      ).toBeVisible();
    },
  );

  test("enables acceptance only after exact dual rendering and invalidates on edit", async () => {
    const user = userEvent.setup();
    renderPage();

    const accept = await screen.findByRole("button", {
      name: "Accept reviewed transcription",
    });
    expect(accept).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Render current correction" }));
    await waitFor(() => expect(accept).toBeEnabled());
    expect(
      screen.getByLabelText("Rendered reviewer LaTeX").querySelector(".katex"),
    ).not.toBeNull();

    await user.type(screen.getByLabelText("Reviewer LaTeX"), " + V");
    expect(accept).toBeDisabled();
    expect(screen.queryByLabelText("Rendered reviewer LaTeX")).not.toBeInTheDocument();
  });

  test("surfaces real KaTeX errors without an acceptance confirmation", async () => {
    const user = userEvent.setup();
    renderPage();

    const editor = await screen.findByLabelText("Reviewer LaTeX");
    fireEvent.change(editor, { target: { value: "\\notARealKatexCommand{" } });
    await user.click(screen.getByRole("button", { name: "Render current correction" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "KaTeX could not render this source",
    );
    expect(
      screen.getByRole("button", { name: "Accept reviewed transcription" }),
    ).toBeDisabled();
  });

  test("refreshes queue counts after save, remains selected, and offers explicit Next", async () => {
    const user = userEvent.setup();
    const first = candidateWithIdentity("equation:save-me", 0);
    const second = unassistedCandidate("equation:next", 1);
    let currentQueue = queue([first, second]);
    let putBody: unknown;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PUT") {
        putBody = JSON.parse(String(init.body));
        const accepted = schema3Candidate("equation:save-me", 0);
        accepted.current_revision = 1;
        accepted.expected_previous_revision = 1;
        if (accepted.decision) accepted.decision.revision = 1;
        currentQueue = queue([accepted, second], {
          projection_id: "equation-review-queue:sha256:projection-2",
        });
        return responseJson({
          candidate_id: accepted.candidate_id,
          ...accepted.decision,
        });
      }
      expect(url).toContain("/equation-reviews?document_id=pizzi2020");
      return responseJson(currentQueue);
    });
    renderPage({ items: currentQueue.items, fetchMock });

    await screen.findByLabelText("Reviewer LaTeX");
    await user.click(screen.getByRole("button", { name: "Render current correction" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Accept reviewed transcription" }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", { name: "Accept reviewed transcription" }),
    );

    await waitFor(() => expect(putBody).toBeDefined());
    expect(putBody).toEqual({
      disposition: "ACCEPT_TRANSCRIPTION",
      assistance_proposal_sha256: proposalSha256,
      reviewer_latex: proposalBody,
      display_mode: "DISPLAY",
      render_confirmation: {
        renderer_id: "katex",
        renderer_version: "0.16.47",
        rendered_reviewer_latex_sha256: reviewerLatexSha256,
        rendered_obsidian_markdown_sha256: reviewerMarkdownSha256,
      },
      note: "",
      expected_previous_revision: 0,
    });
    expect(
      await screen.findByText(/Owner recorded schema 3 review revision 1/),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "equation:save-me" })).toBeVisible();
    expect(selectedCandidateFromUrl()).toBe("equation:save-me");
    expect(screen.getByText("1 / 2")).toBeVisible();
    expect(screen.getByText("1 pending")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Next candidate" }));
    expect(await screen.findByRole("heading", { name: "equation:next" })).toBeVisible();
  });

  test("keeps queue projection and current status in bounded path-free debug", async () => {
    const user = userEvent.setup();
    renderPage({ items: [schema2Candidate()] });

    const summary = await screen.findByText("Debug & Provenance");
    const details = summary.closest("details") as HTMLElement;
    expect(details).not.toHaveAttribute("open");
    await user.click(summary);

    const debug = within(details);
    expect(
      debug.getAllByText(/equation-review-queue:sha256:projection-1/)[0],
    ).toBeVisible();
    expect(debug.getByText(/1 of 1 · 1 decided · 0 pending/)).toBeVisible();
    expect(debug.getByText(/LEGACY_ACCEPTANCE · LEGACY_ACCEPTANCE/)).toBeVisible();
    expect(debug.getByText("Bounded contract JSON")).toBeVisible();
    expect(details).not.toHaveTextContent("/Users/");
    expect(details).not.toHaveTextContent("proposed_latex");
    expect(details).not.toHaveTextContent("raw_text");
    expect(details).not.toHaveTextContent(proposalLatex);
  });

  test("renders the complete 256-candidate owner bound", async () => {
    const items = Array.from({ length: 256 }, (_, index) =>
      unassistedCandidate(
        `equation:bounded:${index.toString().padStart(3, "0")}`,
        index,
      ),
    );
    renderPage({ items });

    const queuePanel = await screen.findByRole("complementary", {
      name: "Equation candidate queue",
    });
    expect(within(queuePanel).getAllByRole("button")).toHaveLength(256);
    expect(
      within(queuePanel).getByText("256 total · 0 decided · 256 pending"),
    ).toBeVisible();
    expect(screen.getByText("Candidate 1 of 256")).toBeVisible();
  });

  test("fails closed if a response exceeds the 256-candidate bound", async () => {
    const items = Array.from({ length: 257 }, (_, index) =>
      unassistedCandidate(`equation:overflow:${index}`, index),
    );
    renderPage({ items });

    expect(
      await screen.findByRole("heading", {
        name: "Equation queue exceeds the browser safety bound",
      }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Equation candidate queue")).not.toBeInTheDocument();
  });

  test("renders an explicit successful empty queue", async () => {
    renderPage({ items: [] });

    expect(
      await screen.findByRole("heading", { name: "No equation candidates" }),
    ).toBeVisible();
    expect(screen.getByText(/empty queue for pizzi2020/)).toBeVisible();
  });

  test("renders typed queue errors with retry and no candidate", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      responseJson(
        {
          code: "EQUATION_REVIEW_QUEUE_INCOMPLETE",
          detail: "bounded owner detail",
        },
        503,
      ),
    );
    renderPage({ fetchMock });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The owner queue is incomplete",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    expect(screen.queryByLabelText("Equation candidate queue")).not.toBeInTheDocument();
  });

  test.each([
    [
      "EQUATION_REVIEW_REVIEWER_LATEX_NONCANONICAL",
      "The reviewer LaTeX is not a canonical NFC math body",
    ],
    [
      "EQUATION_REVIEW_RENDER_STALE",
      "Stale render: the rendered Markdown no longer matches",
    ],
    [
      "EQUATION_REVIEW_EDIT_AFTER_RENDER",
      "Edit after render: the reviewer LaTeX changed after confirmation",
    ],
  ])("distinguishes typed render failure %s", async (code, message) => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return responseJson({ code, detail: "bounded owner detail" }, 409);
      }
      return responseJson(queue([candidate()]));
    });
    renderPage({ fetchMock });

    await screen.findByLabelText("Reviewer LaTeX");
    await user.click(screen.getByRole("button", { name: "Render current correction" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Accept reviewed transcription" }),
      ).toBeEnabled(),
    );
    await user.click(
      screen.getByRole("button", { name: "Accept reviewed transcription" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText(/Owner recorded schema/)).not.toBeInTheDocument();
  });
});
