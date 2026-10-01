import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import type {
  CitationDocumentCatalog,
  CitationDocumentItem,
  CitationDocumentProcessResponse,
  CitationDocumentReceipt,
} from "../../api/client";
import { CitationDocumentsPage } from "./CitationDocumentsPage";

const identityItem = {
  item_id: "identity:item:alpha",
  requested_identity_id: "identity:requested:alpha",
  projection_id: "identity-projection:1",
  status: "accepted-active-canonical" as const,
  canonical_citekey: "alpha2024",
  proposed_citekey: null,
  reference_id: "reference:alpha",
  successor_reference_ids: [],
};

const missingItem: CitationDocumentItem = {
  item_id: "citation-item:alpha",
  target_snapshot_id: "target-snapshot:1",
  identity_projection_id: "identity-projection:1",
  literal_citekey: "alpha2024",
  occurrence_ids: ["occurrence:<unsafe>:1", "occurrence:alpha:2"],
  bibliography_membership_status: "defined",
  key_resolution_status: "resolved",
  identity_items: [identityItem],
  document_status: "not-observed",
  source_document_ids: [],
  source_document_link_ids: [],
  private_receipt_status: "NOT_RECEIVED",
  private_processing_admission_status: "NOT_AUTHORIZED",
  technical_ingestion_status: "NOT_REQUESTED",
  technical_ingestion_statuses: ["NOT_REQUESTED"],
  processing_results: [],
  transcript_status: "NOT_AVAILABLE",
  transcript_document_id: null,
  search_indexing_status: "NOT_EVALUATED",
  human_scientific_acceptance_status: "NOT_EVALUATED",
  allowed_actions: ["PROVIDE_PDF"],
};

const unresolvedItem: CitationDocumentItem = {
  ...missingItem,
  item_id: "citation-item:beta",
  literal_citekey: "beta2025",
  occurrence_ids: ["occurrence:beta:1"],
  bibliography_membership_status: "undefined",
  key_resolution_status: "unresolved",
  identity_items: [],
  document_status: "not-evaluated",
  allowed_actions: [],
};

const receipt: CitationDocumentReceipt = {
  receipt_id: "citation-document-receipt:sha256:receipt",
  source_document: {
    source_document_id: "citation-source-document:sha256:source",
    sha256: "a".repeat(64),
    byte_size: 15,
    media_type: "application/pdf",
    descriptor_id: "citation-source-document-descriptor:sha256:descriptor",
  },
  allowed_actions: ["PROCESS_PRIVATELY"],
};

const processResponse: CitationDocumentProcessResponse = {
  request_id: "citation-document-request:1",
  intent_id: "citation-document-intent:1",
  link_result_id: "citation-link-result:1",
  source_document_link: {
    creating_request_id: "citation-document-request:1",
    prior_projection_id: "citation-projection:1",
    prior_item_id: missingItem.item_id,
    target_snapshot_id: missingItem.target_snapshot_id,
    identity_projection_id: missingItem.identity_projection_id,
    literal_citekey: missingItem.literal_citekey,
    identity_item_id: identityItem.item_id,
    requested_identity_id: identityItem.requested_identity_id,
    source_document: receipt.source_document,
    availability_observation_ids: ["observation:1"],
    pre_effect_intent_id: "citation-document-intent:1",
    linkage_basis: "explicit-upload-for-requested-citation",
    limitations: [],
    link_id: "citation-source-document-link:1",
  },
  receipt_id: receipt.receipt_id,
  source_document_descriptor_id: receipt.source_document.descriptor_id,
  document_id: "document:citation-alpha",
  status: "SUCCEEDED",
  failure_code: null,
  extraction_bundle_id: "extraction-bundle:1",
  package_id: "package:1",
  transcript_projection_id: "transcript-projection:1",
  physical_page_count: 2,
  publication_action: "create",
  result_id: "citation-document-result:1",
};

function itemAfter(result: CitationDocumentProcessResponse): CitationDocumentItem {
  return {
    ...missingItem,
    document_status: "available-linked",
    source_document_ids: [receipt.source_document.source_document_id],
    source_document_link_ids: [result.source_document_link.link_id],
    private_receipt_status: "RECEIVED",
    private_processing_admission_status: "AUTHORIZED",
    technical_ingestion_status: result.status,
    technical_ingestion_statuses: [result.status],
    processing_results: [
      {
        request_id: result.request_id,
        result_id: result.result_id,
        receipt_id: result.receipt_id,
        source_document_descriptor_id: result.source_document_descriptor_id,
        source_document_link_id: result.source_document_link.link_id,
        document_id: result.document_id,
        status: result.status,
        failure_code: result.failure_code,
        transcript_projection_id: result.transcript_projection_id,
      },
    ],
    transcript_status:
      result.status === "SUCCEEDED" ? "AUTOMATED_UNREVIEWED" : "NOT_AVAILABLE",
    transcript_document_id: result.status === "SUCCEEDED" ? result.document_id : null,
    allowed_actions: result.status === "SUCCEEDED" ? ["OPEN_TRANSCRIPT"] : [],
  };
}

function catalog(
  items: CitationDocumentItem[] = [missingItem, unresolvedItem],
): CitationDocumentCatalog {
  return {
    request_id: "catalog-request:1",
    result_id: "catalog-result:1",
    processing_registry_projection_id: "processing-registry:1",
    projection: {
      contract_id: "projectkoios.references.citation-document-projection",
      target_snapshot_id: "target-snapshot:1",
      target_projection_id: "target-projection:1",
      bibliography_binding_ids: ["bibliography-binding:1"],
      identity_projection_id: "identity-projection:1",
      document_observation_ids: ["document-observation:1"],
      source_document_link_ids: items.flatMap((item) => item.source_document_link_ids),
      source_documents: [],
      items,
      source_gaps: [
        {
          source_gap_id: "source-gap:1",
          source_gap_index: 0,
          locator: {
            source_path: "private/manuscript/path.tex",
            source_content_identity: {
              algorithm: "sha256",
              digest: "b".repeat(64),
              byte_count: 100,
            },
            include_index: 2,
            byte_start: 10,
            byte_end: 20,
            line: 14,
            column: 3,
          },
          reason: "placeholder_identifier",
          placeholder_identifier: "<script>unsafe placeholder</script>",
        },
      ],
      limitations: ["<img src=x onerror=alert(1)>"],
      projection_id: "citation-projection:1",
    },
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CitationDocumentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function response(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("preserves owner order and occurrences while keeping every status axis separate", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(response(catalog()))),
  );

  const { container } = renderPage();

  expect(
    await screen.findByRole("heading", { name: "Citation documents" }),
  ).toBeInTheDocument();
  const cards = await screen.findAllByRole("article");
  expect(
    within(cards[0]).getByRole("heading", { name: "alpha2024" }),
  ).toBeInTheDocument();
  expect(
    within(cards[1]).getByRole("heading", { name: "beta2025" }),
  ).toBeInTheDocument();

  const alphaStatuses = within(cards[0]).getByLabelText(
    "Orthogonal status for alpha2024",
  );
  expect(within(alphaStatuses).getByText("Missing")).toBeInTheDocument();
  expect(within(alphaStatuses).getAllByText("Not evaluated")).toHaveLength(2);
  expect(within(alphaStatuses).getByText("Not requested")).toBeInTheDocument();
  expect(within(alphaStatuses).getByText("Not available")).toBeInTheDocument();
  expect(
    within(alphaStatuses).getByText("Accepted active canonical identity"),
  ).toBeInTheDocument();

  await userEvent.click(within(cards[0]).getByText("2 manuscript occurrences"));
  const occurrences = within(cards[0]).getByRole("list", {
    name: "Manuscript occurrences for alpha2024",
  });
  expect(within(occurrences).getAllByRole("listitem")).toHaveLength(2);
  expect(within(occurrences).getByText("occurrence:<unsafe>:1")).toBeInTheDocument();

  expect(
    screen.getByRole("heading", { name: "No-key source gaps" }),
  ).toBeInTheDocument();
  expect(screen.getByText("<script>unsafe placeholder</script>")).toBeInTheDocument();
  expect(screen.queryByText("private/manuscript/path.tex")).not.toBeInTheDocument();
  expect(container.querySelector("script")).not.toBeInTheDocument();
  expect(container.querySelector("img")).not.toBeInTheDocument();
  expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
});

test("filters by literal key and orthogonal owner statuses without reordering", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(response(catalog()))),
  );
  const user = userEvent.setup();
  renderPage();
  await screen.findByRole("heading", { name: "alpha2024" });

  await user.selectOptions(
    screen.getByLabelText("Document availability"),
    "not-evaluated",
  );
  expect(screen.queryByRole("heading", { name: "alpha2024" })).not.toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "beta2025" })).toBeInTheDocument();
  expect(screen.getByText("1 of 2 citation keys shown")).toBeInTheDocument();

  await user.type(screen.getByLabelText("Literal citekey"), "nothing");
  expect(
    screen.getByRole("heading", { name: "No citations match these filters" }),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByRole("heading", { name: "alpha2024" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "beta2025" })).toBeInTheDocument();
});

test("sends a raw PDF receipt then an exact separate synchronous process command", async () => {
  let catalogReads = 0;
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/citation-documents") {
      catalogReads += 1;
      const body =
        catalogReads === 1
          ? catalog([missingItem])
          : catalog([itemAfter(processResponse)]);
      return Promise.resolve(response(body));
    }
    if (url === "/citation-documents/citation-item%3Aalpha/source") {
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({ "Content-Type": "application/pdf" });
      expect(init?.body).toBeInstanceOf(File);
      expect(init?.body).not.toBeInstanceOf(FormData);
      return Promise.resolve(response(receipt));
    }
    if (url === "/citation-documents/citation-item%3Aalpha/process-private") {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        expected_projection_id: "citation-projection:1",
        identity_item_id: identityItem.item_id,
        receipt,
      });
      return Promise.resolve(response(processResponse));
    }
    return Promise.resolve(response({ detail: "not found" }, 404));
  });
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  renderPage();
  await screen.findByRole("heading", { name: "alpha2024" });

  const file = new File(["%PDF-1.7\nprivate"], "never-render-this-name.pdf", {
    type: "application/pdf",
  });
  await user.upload(screen.getByLabelText("PDF for alpha2024"), file);
  await user.click(screen.getByRole("button", { name: "Provide PDF" }));

  expect(await screen.findByText("PDF received privately.")).toBeInTheDocument();
  expect(screen.queryByText("never-render-this-name.pdf")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Process privately" })).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Process privately" }));
  expect(
    await screen.findByRole("link", { name: "Open automated transcript" }),
  ).toHaveAttribute("href", "/control/transcripts/document%3Acitation-alpha");
  expect(screen.getByText("Private processing succeeded.")).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Process privately" }),
  ).not.toBeInTheDocument();
  expect(catalogReads).toBeGreaterThanOrEqual(2);
});

test("renders indeterminate processing as reconciliation-only with no inferred action", async () => {
  const indeterminate: CitationDocumentProcessResponse = {
    ...processResponse,
    status: "INDETERMINATE",
    failure_code: "PUBLICATION_INDETERMINATE",
    extraction_bundle_id: null,
    package_id: null,
    transcript_projection_id: null,
    physical_page_count: null,
    publication_action: null,
    result_id: "citation-document-result:indeterminate",
  };
  let catalogReads = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/citation-documents") {
        catalogReads += 1;
        return Promise.resolve(
          response(
            catalogReads === 1
              ? catalog([missingItem])
              : catalog([itemAfter(indeterminate)]),
          ),
        );
      }
      if (url.endsWith("/source")) return Promise.resolve(response(receipt));
      if (url.endsWith("/process-private")) {
        return Promise.resolve(response(indeterminate));
      }
      return Promise.resolve(response({}, 404));
    }),
  );
  const user = userEvent.setup();
  renderPage();
  await screen.findByRole("heading", { name: "alpha2024" });
  await user.upload(
    screen.getByLabelText("PDF for alpha2024"),
    new File(["%PDF-indeterminate"], "source.pdf", { type: "application/pdf" }),
  );
  await user.click(screen.getByRole("button", { name: "Provide PDF" }));
  await user.click(await screen.findByRole("button", { name: "Process privately" }));

  expect(
    await screen.findByText(
      "Processing outcome indeterminate · reconciliation required.",
    ),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("link", { name: "Open automated transcript" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /retry|repair|overwrite/i }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Process privately" }),
  ).not.toBeInTheDocument();
});

test("retains a failed terminal result without transcript or retry controls", async () => {
  const failed: CitationDocumentProcessResponse = {
    ...processResponse,
    status: "FAILED",
    failure_code: "EXTRACTION_FAILED",
    extraction_bundle_id: null,
    package_id: null,
    transcript_projection_id: null,
    physical_page_count: null,
    publication_action: null,
    result_id: "citation-document-result:failed",
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(response(catalog([itemAfter(failed)])))),
  );
  renderPage();

  const card = await screen.findByRole("article");
  expect(within(card).getAllByText("Failed").length).toBeGreaterThan(0);
  expect(within(card).getByText("Not available")).toBeInTheDocument();
  expect(
    within(card).queryByRole("link", { name: "Open automated transcript" }),
  ).not.toBeInTheDocument();
  expect(
    within(card).queryByRole("button", {
      name: /retry|repair|overwrite|process privately/i,
    }),
  ).not.toBeInTheDocument();
});

test("shows fixed safe owner failure text instead of reflecting API detail", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        response(
          {
            detail: {
              code: "CITATION_DOCUMENT_OWNER_UNAVAILABLE",
              detail: "private owner path /secret/should-not-render",
            },
          },
          503,
        ),
      ),
    ),
  );
  renderPage();

  expect(
    await screen.findByRole("heading", {
      name: "Citation-document catalog unavailable",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByText("The citation-document owner is currently unavailable."),
  ).toBeInTheDocument();
  expect(screen.queryByText(/secret\/should-not-render/)).not.toBeInTheDocument();
});
