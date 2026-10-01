import { expect, test } from "@playwright/test";

const identityItem = {
  item_id: "identity:item:alpha",
  requested_identity_id: "identity:requested:alpha",
  projection_id: "identity-projection:1",
  status: "accepted-active-canonical",
  canonical_citekey: "alpha2024",
  proposed_citekey: null,
  reference_id: "reference:alpha",
  successor_reference_ids: [],
};

const receipt = {
  receipt_id: "citation-document-receipt:1",
  source_document: {
    source_document_id: "citation-source-document:1",
    sha256: "a".repeat(64),
    byte_size: 16,
    media_type: "application/pdf",
    descriptor_id: "citation-source-document-descriptor:1",
  },
  allowed_actions: ["PROCESS_PRIVATELY"],
};

const baseItem = {
  item_id: "citation-item:alpha",
  target_snapshot_id: "target-snapshot:1",
  identity_projection_id: "identity-projection:1",
  literal_citekey: "alpha2024",
  occurrence_ids: ["occurrence:alpha:1", "occurrence:alpha:2"],
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

const processResult = {
  request_id: "citation-document-request:1",
  intent_id: "citation-document-intent:1",
  link_result_id: "citation-link-result:1",
  source_document_link: {
    creating_request_id: "citation-document-request:1",
    prior_projection_id: "citation-projection:1",
    prior_item_id: baseItem.item_id,
    target_snapshot_id: baseItem.target_snapshot_id,
    identity_projection_id: baseItem.identity_projection_id,
    literal_citekey: baseItem.literal_citekey,
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
  physical_page_count: 1,
  publication_action: "create",
  result_id: "citation-document-result:1",
};

function catalog(processed: boolean) {
  const item = processed
    ? {
        ...baseItem,
        document_status: "available-linked",
        source_document_ids: [receipt.source_document.source_document_id],
        source_document_link_ids: [processResult.source_document_link.link_id],
        private_receipt_status: "RECEIVED",
        private_processing_admission_status: "AUTHORIZED",
        technical_ingestion_status: "SUCCEEDED",
        technical_ingestion_statuses: ["SUCCEEDED"],
        processing_results: [
          {
            request_id: processResult.request_id,
            result_id: processResult.result_id,
            receipt_id: processResult.receipt_id,
            source_document_descriptor_id: processResult.source_document_descriptor_id,
            source_document_link_id: processResult.source_document_link.link_id,
            document_id: processResult.document_id,
            status: "SUCCEEDED",
            failure_code: null,
            transcript_projection_id: processResult.transcript_projection_id,
          },
        ],
        transcript_status: "AUTOMATED_UNREVIEWED",
        transcript_document_id: processResult.document_id,
        allowed_actions: ["OPEN_TRANSCRIPT"],
      }
    : baseItem;
  return {
    request_id: "catalog-request:1",
    result_id: "catalog-result:1",
    processing_registry_projection_id: "processing-registry:1",
    projection: {
      contract_id: "projectkoios.references.citation-document-projection",
      target_snapshot_id: "target-snapshot:1",
      target_projection_id: "target-projection:1",
      bibliography_binding_ids: ["bibliography:1"],
      identity_projection_id: "identity-projection:1",
      document_observation_ids: ["observation:1"],
      source_document_link_ids: processed
        ? [processResult.source_document_link.link_id]
        : [],
      source_documents: processed ? [receipt.source_document] : [],
      items: [item],
      source_gaps: [],
      limitations: [],
      projection_id: "citation-projection:1",
    },
  };
}

test("receives and processes one missing citation before opening its automated transcript", async ({
  page,
}) => {
  let processed = false;
  await page.route("**/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route(/\/citation-documents$/, (route) => {
    if (new URL(route.request().url()).pathname !== "/citation-documents") {
      return route.fallback();
    }
    return route.fulfill({ json: catalog(processed) });
  });
  await page.route(
    "**/citation-documents/citation-item%3Aalpha/source",
    async (route) => {
      expect(route.request().method()).toBe("POST");
      expect(route.request().headers()["content-type"]).toContain("application/pdf");
      expect(route.request().postDataBuffer()?.toString()).toContain("%PDF-1.7");
      await route.fulfill({ json: receipt });
    },
  );
  await page.route(
    "**/citation-documents/citation-item%3Aalpha/process-private",
    async (route) => {
      expect(route.request().postDataJSON()).toEqual({
        expected_projection_id: "citation-projection:1",
        identity_item_id: identityItem.item_id,
        receipt,
      });
      processed = true;
      await route.fulfill({ json: processResult });
    },
  );
  await page.route("**/transcripts/document%3Acitation-alpha", (route) =>
    route.fulfill({
      json: {
        document_id: "document:citation-alpha",
        display_name: "Citation source alpha2024",
        status: "AUTOMATED_UNREVIEWED",
        physical_page_count: 1,
        pages: [
          {
            page_id: "page:citation-alpha:0",
            page_index: 0,
            physical_page: 1,
            printed_page_label: null,
            text: "Exact <unsafe> automated transcript.",
          },
        ],
      },
    }),
  );

  await page.goto("/control/citation-documents");
  await expect(page.getByRole("heading", { name: "alpha2024" })).toBeVisible();
  await expect(
    page
      .getByLabel("Orthogonal status for alpha2024")
      .getByText("Missing", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("PDF for alpha2024").setInputFiles({
    name: "private.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\nprivate"),
  });
  await page.getByRole("button", { name: "Provide PDF" }).click();
  await expect(page.getByText("PDF received privately.")).toBeVisible();
  await page.getByRole("button", { name: "Process privately" }).click();
  const transcriptLink = page.getByRole("link", { name: "Open automated transcript" });
  await expect(transcriptLink).toBeVisible();
  await transcriptLink.click();

  await expect(page).toHaveURL(/\/control\/transcripts\/document%3Acitation-alpha$/i);
  await expect(page.getByText("Automated and unreviewed")).toBeVisible();
  await expect(page.getByLabel("Exact transcript text for physical page 1")).toHaveText(
    "Exact <unsafe> automated transcript.",
    { useInnerText: false },
  );
});
