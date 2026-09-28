import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EquationReviewPage } from "./EquationReviewPage";

const candidate = {
  candidate_id: "equation:pizzi2020:page-7:region-1",
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

afterEach(() => {
  vi.unstubAllGlobals();
});

test("shows source evidence and requires explicit acceptance of assisted text", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/equation-reviews?document_id=pizzi2020") {
        return Promise.resolve(Response.json(queue));
      }
      if (
        url === "/equation-reviews/equation%3Apizzi2020%3Apage-7%3Aregion-1/decision" &&
        init?.method === "PUT"
      ) {
        return Promise.resolve(
          Response.json({
            candidate_id: candidate.candidate_id,
            disposition: "ACCEPT_TRANSCRIPTION",
            assistance_proposal_sha256: candidate.assistance.proposal_sha256,
            note: "Region and notation checked.",
            revision: 1,
            updated_at_utc: "2026-09-28T18:00:00Z",
          }),
        );
      }
      return Promise.resolve(Response.json({ detail: "not found" }, { status: 404 }));
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

  expect(await screen.findByText("Human review saved by the API.")).toBeInTheDocument();
  await waitFor(() => {
    expect(fetch).toHaveBeenCalledWith(
      "/equation-reviews/equation%3Apizzi2020%3Apage-7%3Aregion-1/decision",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          disposition: "ACCEPT_TRANSCRIPTION",
          assistance_proposal_sha256: candidate.assistance.proposal_sha256,
          note: "Region and notation checked.",
        }),
      }),
    );
  });
});

test("reports an unsupported API without inventing corpus data", async () => {
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
