import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CitationReviewPage } from "./CitationReviewPage";

const queue = {
  assessment: "AI_REVIEWED_UNVERIFIED",
  manuscript_sha256: "a".repeat(64),
  total: 1,
  decided: 0,
  items: [
    {
      claim_id: "appendix-g-001",
      lines: "34-45",
      claim: "Localized models require a checked citation.",
      recommendation_relationship: "DIRECT_SUPPORT",
      recommended_keys: ["source2024"],
      evaluation_status: "HIT",
      decision: null,
    },
  ],
};

const detail = {
  ...queue.items[0],
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
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CitationReviewPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/citation-reviews" && init?.method === undefined) {
        return Promise.resolve(Response.json(queue));
      }
      if (url === "/citation-reviews/appendix-g-001") {
        return Promise.resolve(Response.json(detail));
      }
      if (
        url === "/citation-reviews/appendix-g-001/decision" &&
        init?.method === "PUT"
      ) {
        return Promise.resolve(
          Response.json({
            claim_id: "appendix-g-001",
            disposition: "ACCEPT_CITATION",
            selected_citation_keys: ["source2024"],
            note: "Passage checked.",
            revision: 1,
            updated_at_utc: "2026-09-20T22:00:00+00:00",
          }),
        );
      }
      return Promise.resolve(Response.json({ detail: "not found" }, { status: 404 }));
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("shows page-linked evidence and persists an explicit decision", async () => {
  const user = userEvent.setup();
  renderPage();

  expect(
    await screen.findByRole("heading", { name: "Citation evidence queue" }),
  ).toBeInTheDocument();
  expect(await screen.findByText(detail.candidates[0].passage)).toBeInTheDocument();
  expect(document.querySelector(".katex")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open source at page" })).toHaveAttribute(
    "href",
    "/citation-reviews/sources/source2024.pdf#page=3",
  );
  await user.click(screen.getByRole("button", { name: "Preview PDF page" }));
  expect(screen.getByTitle("source2024.pdf, physical page 3")).toHaveAttribute(
    "src",
    "/citation-reviews/sources/source2024.pdf#page=3",
  );

  await user.click(screen.getByRole("radio", { name: "Accept citation" }));
  await user.click(screen.getByRole("checkbox", { name: /source2024/ }));
  await user.type(screen.getByLabelText("Reviewer note"), "Passage checked.");
  await user.click(screen.getByRole("button", { name: "Save review decision" }));

  expect(await screen.findByText("Decision saved privately.")).toBeInTheDocument();
  await waitFor(() => {
    expect(fetch).toHaveBeenCalledWith(
      "/citation-reviews/appendix-g-001/decision",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          disposition: "ACCEPT_CITATION",
          selected_citation_keys: ["source2024"],
          note: "Passage checked.",
        }),
      }),
    );
  });
});
