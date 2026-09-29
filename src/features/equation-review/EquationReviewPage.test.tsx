import { webcrypto } from "node:crypto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type {
  EquationReviewCandidate,
  EquationReviewQueueResponse,
} from "../../api/client";
import { EquationReviewPage } from "./EquationReviewPage";

const candidateId = "equation-candidate:sha256:review-1";
const proposalLatex = "E = E_0 + \\frac{k^2}{2m}";
const proposalSha256 = "d".repeat(64);

function candidate(
  overrides: Partial<EquationReviewCandidate> = {},
): EquationReviewCandidate {
  return {
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
    status: "UNREVIEWED",
    current_revision: 0,
    expected_previous_revision: 0,
    decision: null,
    ...overrides,
  };
}

function schema2Candidate(): EquationReviewCandidate {
  return candidate({
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

function queue(item: EquationReviewCandidate): EquationReviewQueueResponse {
  return {
    document_id: "pizzi2020",
    total: 1,
    decided: item.decision ? 1 : 0,
    items: [item],
  };
}

function responseJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function renderPage(item: EquationReviewCandidate = candidate()) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(responseJson(queue(item))));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <EquationReviewPage />
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("EquationReviewPage", () => {
  test("uses the confirmed accessible order and real local KaTeX output", async () => {
    renderPage();

    const region = await screen.findByRole("heading", { name: "Source region" });
    const proposed = screen.getByRole("heading", { name: "Proposed" });
    const reviewer = screen.getByRole("heading", { name: "Reviewer" });

    expect(
      region.compareDocumentPosition(proposed) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      proposed.compareDocumentPosition(reviewer) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByAltText(/physical page 7/)).toHaveAttribute(
      "src",
      `/equation-reviews/${encodeURIComponent(candidateId)}/region`,
    );

    const proposedLatex = screen.getByLabelText("Proposed LaTeX");
    const proposedMarkdown = screen.getByLabelText(
      "Canonical proposed Obsidian Markdown",
    );
    expect(proposedLatex).toHaveAttribute("readonly");
    expect(proposedMarkdown).toHaveValue(`$$\n${proposalLatex}\n$$`);
    expect(proposedMarkdown).toHaveAttribute("readonly");
    expect(
      screen.getByLabelText("Rendered proposed LaTeX").querySelector(".katex"),
    ).not.toBeNull();
    expect(
      screen.getByLabelText("Rendered proposed Markdown").querySelector("math"),
    ).not.toBeNull();
    expect(
      screen.getByText(/Preview only: rendered locally with KaTeX 0.16.47/),
    ).toBeVisible();
  });

  test("shows schema-2 revision 1 as history and prepopulates its proposal for revision 2", async () => {
    renderPage(schema2Candidate());

    expect(await screen.findByLabelText("Reviewer LaTeX")).toHaveValue(proposalLatex);
    expect(screen.getByText(/Schema 2 · revision 1 · legacy acceptance/)).toBeVisible();
    expect(
      screen.getByText(/legacy acceptance has no canonical accepted reviewer source/i),
    ).toHaveTextContent("saving creates revision 2");
    expect(screen.getByText("Next owner revision: 2")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Accept reviewed transcription" }),
    ).toBeDisabled();
  });

  test("enables acceptance only after exact dual rendering and invalidates previews on edit", async () => {
    const user = userEvent.setup();
    renderPage();

    const accept = await screen.findByRole("button", {
      name: "Accept reviewed transcription",
    });
    expect(accept).toBeDisabled();
    expect(
      screen.getAllByText(/Render the current correction to create this preview/),
    ).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Render current correction" }));
    await waitFor(() => expect(accept).toBeEnabled());
    expect(
      screen.getByLabelText("Rendered reviewer LaTeX").querySelector(".katex"),
    ).not.toBeNull();
    expect(
      screen.getByLabelText("Rendered reviewer Markdown").querySelector("math"),
    ).not.toBeNull();

    await user.type(screen.getByLabelText("Reviewer LaTeX"), " + V");
    expect(accept).toBeDisabled();
    expect(screen.queryByLabelText("Rendered reviewer LaTeX")).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/Render the current correction to create this preview/),
    ).toHaveLength(2);
  });

  test("surfaces real KaTeX errors without producing an acceptance confirmation", async () => {
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

  test("sends the exact schema-3 acceptance body and reloads schema 2 to schema 3", async () => {
    const user = userEvent.setup();
    let current = schema2Candidate();
    let putBody: unknown;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PUT") {
        putBody = JSON.parse(String(init.body));
        current = candidate({
          status: "ACCEPTED",
          current_revision: 2,
          expected_previous_revision: 2,
          decision: {
            schema_version: 3,
            status: "ACCEPTED",
            disposition: "ACCEPT_TRANSCRIPTION",
            assistance_proposal_sha256: proposalSha256,
            reviewer_latex: proposalLatex,
            reviewer_latex_sha256:
              "3274bfc231ff33d8751950fe4b6e65020c0714f8cd1939e7c75600915e8687f9",
            display_mode: "DISPLAY",
            obsidian_markdown: `$$\n${proposalLatex}\n$$`,
            obsidian_markdown_sha256:
              "c0f06a5ee6fbde17c456b0706e5a89c50c8019cae2a17a134571885a2fbd5479",
            render_confirmation: {
              renderer_id: "katex",
              renderer_version: "0.16.47",
              rendered_reviewer_latex_sha256:
                "3274bfc231ff33d8751950fe4b6e65020c0714f8cd1939e7c75600915e8687f9",
              rendered_obsidian_markdown_sha256:
                "c0f06a5ee6fbde17c456b0706e5a89c50c8019cae2a17a134571885a2fbd5479",
            },
            note: "Notation checked.",
            revision: 2,
            revision_id: "equation-review-revision:sha256:schema3",
            recorded_at_utc: "2026-09-29T04:00:00Z",
          },
        });
        return responseJson({ candidate_id: candidateId, ...current.decision });
      }
      expect(url).toContain("/equation-reviews?document_id=pizzi2020");
      return responseJson(queue(current));
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <EquationReviewPage />
      </QueryClientProvider>,
    );

    await screen.findByLabelText("Reviewer LaTeX");
    await user.type(screen.getByLabelText("Reviewer note"), "Notation checked.");
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
      reviewer_latex: proposalLatex,
      display_mode: "DISPLAY",
      render_confirmation: {
        renderer_id: "katex",
        renderer_version: "0.16.47",
        rendered_reviewer_latex_sha256:
          "3274bfc231ff33d8751950fe4b6e65020c0714f8cd1939e7c75600915e8687f9",
        rendered_obsidian_markdown_sha256:
          "c0f06a5ee6fbde17c456b0706e5a89c50c8019cae2a17a134571885a2fbd5479",
      },
      note: "Notation checked.",
      expected_previous_revision: 1,
    });
    expect(putBody).not.toHaveProperty("obsidian_markdown");
    expect(putBody).not.toHaveProperty("recorded_at_utc");
    expect(putBody).not.toHaveProperty("updated_at_utc");

    expect(await screen.findByText(/Schema 3 · revision 2 · accepted/)).toBeVisible();
    expect(screen.getByLabelText("Reviewer LaTeX")).toHaveValue(proposalLatex);
    expect(screen.getByText("Next owner revision: 3")).toBeVisible();
  });

  test("prepopulates a stored schema-3 reviewer source on reload", async () => {
    const acceptedLatex = "E = mc^2";
    renderPage(
      candidate({
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
      }),
    );

    expect(await screen.findByLabelText("Reviewer LaTeX")).toHaveValue(acceptedLatex);
    expect(screen.getByLabelText("Reviewer display mode")).toHaveValue("INLINE");
    expect(screen.getByLabelText("Derived reviewer Obsidian Markdown")).toHaveValue(
      `$${acceptedLatex}$`,
    );
  });

  test("keeps bounded path-free provenance collapsed until requested", async () => {
    const user = userEvent.setup();
    renderPage(schema2Candidate());

    const summary = await screen.findByText("Debug & Provenance");
    const details = summary.closest("details");
    expect(details).not.toHaveAttribute("open");
    await user.click(summary);
    expect(details).toHaveAttribute("open");

    const debug = within(details as HTMLElement);
    expect(debug.getAllByText(/attempt-007/)[0]).toBeVisible();
    expect(debug.getAllByText(/equation-reader/)[0]).toBeVisible();
    expect(debug.getByText(/current 1 · expected previous 1/)).toBeVisible();
    expect(debug.getByText("Bounded contract JSON")).toBeVisible();
    expect(details).not.toHaveTextContent("/Users/");
    expect(details).not.toHaveTextContent("proposed_latex");
    expect(details).not.toHaveTextContent("extracted_text");
  });

  test.each([
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
      return responseJson(queue(candidate()));
    });
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <EquationReviewPage />
      </QueryClientProvider>,
    );

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
