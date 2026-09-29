import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EquationReviewPage } from "./EquationReviewPage";

const decisionUrl =
  "/equation-reviews/equation%3Apizzi2020%3Apage-7%3Aregion-1/decision";
const candidate = {
  candidate_id: "equation:pizzi2020:page-7:region-1",
  source: {
    document_id: "pizzi2020",
    source_name: "pizzi2020.pdf",
    source_sha256: "a".repeat(64),
    physical_page: 7,
  },
  region: {
    coordinate_space: "PDF_POINTS" as const,
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
    status: "PROPOSED" as const,
    method: "local-equation-transcriber@1",
    proposal_sha256: "d".repeat(64),
    proposed_latex: "E = E_0 + \\frac{k^2}{2m}",
  },
  decision: null,
};

const queue = {
  document_id: "pizzi2020",
  total: 1,
  decided: 0,
  items: [candidate],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <EquationReviewPage />
    </QueryClientProvider>,
  );
}

function stubQueueAndDecision(response: Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/equation-reviews?document_id=pizzi2020") {
        return Promise.resolve(Response.json(queue));
      }
      if (url === decisionUrl && init?.method === "PUT") {
        return Promise.resolve(response);
      }
      return Promise.resolve(Response.json({ detail: "not found" }, { status: 404 }));
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("shows evidence and records explicit proposal acceptance at revision zero", async () => {
  const user = userEvent.setup();
  stubQueueAndDecision(
    Response.json({
      candidate_id: candidate.candidate_id,
      disposition: "ACCEPT_TRANSCRIPTION",
      assistance_proposal_sha256: candidate.assistance.proposal_sha256,
      note: "Region and notation checked.",
      revision: 1,
      updated_at_utc: "2026-09-28T18:00:00Z",
    }),
  );

  renderPage();

  expect(
    await screen.findByRole("heading", { name: "Equation review" }),
  ).toBeInTheDocument();
  expect(screen.getAllByText(candidate.candidate_id)).toHaveLength(2);
  expect(screen.getByText("Unaccepted assisted proposal")).toBeInTheDocument();
  expect(
    screen.getByAltText("Equation candidate region from pizzi2020.pdf, page 7"),
  ).toHaveAttribute(
    "src",
    "/equation-reviews/equation%3Apizzi2020%3Apage-7%3Aregion-1/region",
  );
  expect(screen.getByRole("button", { name: "Save human review" })).toBeDisabled();

  await user.click(
    screen.getByRole("radio", { name: "Accept this assisted transcription" }),
  );
  await user.type(
    screen.getByLabelText("Reviewer note"),
    "Region and notation checked.",
  );
  await user.click(screen.getByRole("button", { name: "Save human review" }));

  expect(
    await screen.findByText(/Owner recorded human review revision 1 at/),
  ).toHaveTextContent("2026-09-28T18:00:00Z");
  await waitFor(() => {
    expect(fetch).toHaveBeenCalledWith(
      decisionUrl,
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          disposition: "ACCEPT_TRANSCRIPTION",
          assistance_proposal_sha256: candidate.assistance.proposal_sha256,
          note: "Region and notation checked.",
          expected_previous_revision: 0,
        }),
      }),
    );
  });
});

test("uses the displayed owner revision as the write precondition", async () => {
  const user = userEvent.setup();
  const decidedQueue = {
    ...queue,
    decided: 1,
    items: [
      {
        ...candidate,
        decision: {
          disposition: "REJECT_CANDIDATE" as const,
          assistance_proposal_sha256: null,
          note: "Not an equation.",
          revision: 2,
          updated_at_utc: "2026-09-28T17:00:00Z",
        },
      },
    ],
  };
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/equation-reviews?document_id=pizzi2020") {
        return Promise.resolve(Response.json(decidedQueue));
      }
      if (url === decisionUrl && init?.method === "PUT") {
        return Promise.resolve(
          Response.json({
            candidate_id: candidate.candidate_id,
            disposition: "REVISION_REQUIRED",
            assistance_proposal_sha256: null,
            note: "Correct the denominator.",
            revision: 3,
            updated_at_utc: "2026-09-28T19:00:00Z",
          }),
        );
      }
      return Promise.resolve(Response.json({ detail: "not found" }, { status: 404 }));
    }),
  );

  renderPage();
  expect(await screen.findByText(/Existing human decision/)).toHaveTextContent(
    "2026-09-28T17:00:00Z",
  );
  await user.click(
    screen.getByRole("radio", { name: "Request a corrected transcription" }),
  );
  await user.clear(screen.getByLabelText("Reviewer note"));
  await user.type(screen.getByLabelText("Reviewer note"), "Correct the denominator.");
  await user.click(screen.getByRole("button", { name: "Save human review" }));

  await waitFor(() => {
    expect(fetch).toHaveBeenCalledWith(
      decisionUrl,
      expect.objectContaining({
        body: JSON.stringify({
          disposition: "REVISION_REQUIRED",
          assistance_proposal_sha256: null,
          note: "Correct the denominator.",
          expected_previous_revision: 2,
        }),
      }),
    );
  });
});

const failureCases = [
  [409, "EQUATION_REVIEW_PROPOSAL_STALE", "The assisted proposal changed."],
  [409, "EQUATION_REVIEW_EVIDENCE_STALE", "The immutable source evidence changed."],
  [409, "EQUATION_REVIEW_REVISION_STALE", "A newer human revision exists."],
  [
    409,
    "EQUATION_REVIEW_CONCURRENT_DECISION",
    "A different decision won concurrently.",
  ],
  [
    503,
    "EQUATION_REVIEW_PARTIAL_OUTPUT",
    "The equation-review owner returned partial output.",
  ],
  [
    503,
    "EQUATION_REVIEW_OWNER_UNAVAILABLE",
    "The equation-review owner is unavailable.",
  ],
] as const;

test.each(failureCases)(
  "handles %s %s without implying a save",
  async (status, code, message) => {
    const user = userEvent.setup();
    stubQueueAndDecision(
      Response.json({ code, detail: "safe API detail" }, { status }),
    );

    renderPage();
    await screen.findByRole("heading", { name: "Equation review" });
    await user.click(
      screen.getByRole("radio", { name: "Reject this equation candidate" }),
    );
    await user.click(screen.getByRole("button", { name: "Save human review" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(
      screen.getByRole("button", { name: "Reload candidate evidence" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Owner recorded human review/)).not.toBeInTheDocument();
  },
);

test("reports an unconfigured identity without inventing corpus data", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(Response.json({ detail: "not found" }, { status: 404 })),
    ),
  );

  renderPage();

  expect(
    await screen.findByRole("heading", { name: "Equation review unavailable" }),
  ).toBeInTheDocument();
  expect(screen.getByText("pizzi2020 not loaded")).toBeInTheDocument();
  expect(
    screen.getByText("No filesystem or corpus fallback is attempted by the browser."),
  ).toBeInTheDocument();
  expect(screen.queryByText(candidate.candidate_id)).not.toBeInTheDocument();
});

test("classifies typed owner-unavailable queue responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        Response.json(
          {
            code: "EQUATION_REVIEW_OWNER_UNAVAILABLE",
            detail: "equation review owner is unavailable",
          },
          { status: 503 },
        ),
      ),
    ),
  );

  renderPage();

  expect(
    await screen.findByRole("heading", {
      name: "Equation review owner unavailable",
    }),
  ).toBeInTheDocument();
  expect(screen.getByText(/No saved decision has been confirmed/)).toBeInTheDocument();
});
