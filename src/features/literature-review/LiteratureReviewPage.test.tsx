import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LiteratureReviewPage } from "./LiteratureReviewPage";

let referenceStored = false;

const storedReference = {
  receipt_id: `provided-reference:sha256:${"a".repeat(64)}`,
  claim_id: "C-001",
  citation_label: "ExampleAuthor2024",
  doi_or_url: null,
  note: "",
  source_sha256: "b".repeat(64),
  byte_length: 12,
  status: "RECEIVED_NOT_INGESTED",
  received_at_utc: "2026-09-22T01:00:00+00:00",
  latest_generation: null,
  duplicate: false,
};

const ingestedReference = {
  ...storedReference,
  status: "INGESTED_AUTOMATED_UNREVIEWED",
  latest_generation: "assessment-generation-02",
};

const response = {
  run_id: "literature-review-test-01",
  phase: "COMPLETE",
  assessment_status: "AUTOMATED_UNREVIEWED",
  claim_count: 1,
  evidence_ready_count: 1,
  assessment_count: 1,
  completion_percent: 100,
  status_counts: {
    supported: 0,
    qualified: 1,
    contradicted: 0,
    unresolved: 0,
  },
  human_disposition: null,
  classifier_implementation_authorized: false,
  scientific_calculation_authorized: false,
  original_submission_markdown: [
    "# Original framework",
    "",
    "## Thermodynamic regime",
    "",
    "$$A = E - TS$$",
  ].join("\n"),
  claims: [
    {
      claim_id: "C-001",
      section: "method_scope",
      claim: "The proposed method applies universally.",
      evidence_count: 4,
      status: "QUALIFIED",
      summary: "The evidence supports only a bounded scope.",
      corrected_claim: "The method applies under the stated assumptions.",
      assumptions: [],
      evidence: [
        {
          label: "E1",
          citation_key: "ExampleAuthor2024",
          physical_page: 2,
          quote: "The method was evaluated under a bounded set of assumptions.",
        },
      ],
      source_requests: ["Provide the primary methodological source."],
      validation_frame: {
        assessment_status: "AUTOMATED_UNREVIEWED",
        finding: "CONTRADICTS_EXACT_WORDING",
        conclusion: "The exact expression differs from the submitted wording.",
        evidence_labels: ["E1"],
        equations: [
          {
            label: "Bounded-domain check",
            latex: "0 < x < 1",
            interpretation: "The endpoints are excluded by the assumptions.",
          },
        ],
      },
    },
  ],
};

beforeEach(() => {
  referenceStored = false;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      let body: object = response;
      let status = 200;
      if (url.includes("/literature-review/references")) {
        body = { items: referenceStored ? [ingestedReference] : [] };
      }
      if (url.endsWith("/literature-review/references") && init?.method === "POST") {
        referenceStored = true;
        status = 201;
        body = storedReference;
      }
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("shows live progress, evidence, and private reference intake", async () => {
  const user = userEvent.setup();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <LiteratureReviewPage />
    </QueryClientProvider>,
  );

  expect(
    await screen.findByRole("heading", {
      name: "Literature review",
    }),
  ).toBeInTheDocument();
  expect(screen.getByText("Assessment complete")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Framework supplied for critical review" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Original framework")).toBeInTheDocument();
  expect(screen.getByText("INTAKE · NOT ACCEPTED EVIDENCE")).toBeInTheDocument();
  expect(screen.getByText("Equation-first checks are available")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Refresh latest updates" }),
  ).toBeInTheDocument();
  expect(screen.getAllByText("AUTOMATED_UNREVIEWED")).toHaveLength(2);
  expect(screen.getByText("Needs narrower wording")).toBeInTheDocument();
  expect(
    screen.getByText(
      /No scientific calculation or classifier implementation is authorized/,
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("progressbar", {
      name: "Literature-review assessment progress",
    }),
  ).toHaveAttribute("aria-valuenow", "100");
  expect(
    screen.getByText("The method was evaluated under a bounded set of assumptions."),
  ).toBeInTheDocument();
  expect(screen.getByText("Equation-first critical check")).toBeInTheDocument();
  expect(
    screen.getByText("The exact expression differs from the submitted wording."),
  ).toBeInTheDocument();

  const citationField = screen.getByLabelText("Provisional citation label");
  await user.type(citationField, "ExampleAuthor2024");
  expect(citationField).toHaveValue("ExampleAuthor2024");

  const doiField = screen.getByLabelText("DOI or source URL (optional)");
  await user.type(doiField, "10.0000/example");
  expect(doiField).toHaveValue("10.0000/example");
  await user.upload(
    screen.getByLabelText("PDF file"),
    new File(["%PDF-1.7 test"], "example.pdf", {
      type: "application/pdf",
    }),
  );
  const submit = screen.getByRole("button", { name: "Provide reference" });
  fireEvent.submit(submit.closest("form")!);

  expect(
    await screen.findByText("Reference stored privately and awaiting ingestion."),
  ).toBeInTheDocument();
  expect(
    await screen.findByText("Reference ingested; automated reassessment available"),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Refresh receipt status" }),
  ).toBeInTheDocument();
});
