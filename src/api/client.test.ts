import { ApiError, ProjectKoiosApiClient } from "./client";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("health requests the configured API", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  const client = new ProjectKoiosApiClient("http://localhost:8000/");

  await expect(client.health()).resolves.toEqual({ status: "ok" });
  expect(fetchMock).toHaveBeenCalledWith(
    "http://localhost:8000/health",
    expect.objectContaining({ signal: undefined }),
  );
});

test("courses request the public-safe course catalog", async () => {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        schema_version: "1",
        reviewed_on: null,
        source: null,
        publication_boundary: [],
        institutions: [],
        unresolved_collections: [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );
  const client = new ProjectKoiosApiClient();

  await expect(client.courses()).resolves.toEqual({
    schema_version: "1",
    reviewed_on: null,
    source: null,
    publication_boundary: [],
    institutions: [],
    unresolved_collections: [],
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/courses",
    expect.objectContaining({ signal: undefined }),
  );
});

test("projects request the public project catalog", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ schema_version: "1", projects: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  const client = new ProjectKoiosApiClient();

  await expect(client.projects()).resolves.toEqual({
    schema_version: "1",
    projects: [],
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/projects",
    expect.objectContaining({ signal: undefined }),
  );
});

test("publications request the public catalog", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ schema_version: "1", publications: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  const client = new ProjectKoiosApiClient();

  await expect(client.publications()).resolves.toEqual({
    schema_version: "1",
    publications: [],
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/publications",
    expect.objectContaining({ signal: undefined }),
  );
});

test("missing PDFs request the bounded project collection", async () => {
  fetchMock.mockResolvedValue(
    Response.json({
      project_id: "ksdft2effmass",
      total_references: 1,
      required_pdf_count: 1,
      bound_pdf_count: 0,
      missing_pdf_count: 1,
      not_applicable_count: 0,
      max_pdf_bytes: 1_000_000,
      media_type: "application/pdf",
      items: [],
    }),
  );
  const client = new ProjectKoiosApiClient();

  await expect(client.projectMissingPdfs()).resolves.toMatchObject({
    project_id: "ksdft2effmass",
    missing_pdf_count: 1,
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "/project-reference-intake/ksdft2effmass/missing-pdfs",
    expect.objectContaining({ signal: undefined }),
  );
});

test("missing PDF receipt sends one encoded citekey and raw PDF body", async () => {
  fetchMock.mockResolvedValue(
    Response.json({
      project_id: "ksdft2effmass",
      citekey: "example:key",
      byte_size: 12,
      receipt_disposition: "received",
      binding_disposition: "bound",
      document_status: "received-unreviewed",
    }),
  );
  const client = new ProjectKoiosApiClient();
  const file = new File(["%PDF-private"], "private.pdf", {
    type: "application/pdf",
  });

  await expect(
    client.provideProjectMissingPdf("example:key", file),
  ).resolves.toMatchObject({ binding_disposition: "bound" });

  expect(fetchMock).toHaveBeenCalledWith(
    "/project-reference-intake/ksdft2effmass/missing-pdfs/example%3Akey/document",
    expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: file,
    }),
  );
});

test("received-unbound PDF custody remains a typed result", async () => {
  fetchMock.mockResolvedValue(
    Response.json(
      {
        project_id: "ksdft2effmass",
        citekey: "example:key",
        byte_size: 12,
        receipt_disposition: "received",
        binding_status: "received-unbound",
        document_status: "received-unreviewed",
        detail: "PDF was received but could not be bound",
      },
      { status: 409 },
    ),
  );
  const client = new ProjectKoiosApiClient();
  const file = new File(["%PDF-private"], "private.pdf", {
    type: "application/pdf",
  });

  await expect(client.provideProjectMissingPdf("example:key", file)).resolves.toEqual({
    project_id: "ksdft2effmass",
    citekey: "example:key",
    byte_size: 12,
    receipt_disposition: "received",
    binding_status: "received-unbound",
    document_status: "received-unreviewed",
    detail: "PDF was received but could not be bound",
  });
});

test("malformed received-unbound response fails closed", async () => {
  fetchMock.mockResolvedValue(
    Response.json(
      {
        citekey: "example:key",
        binding_status: "received-unbound",
        private_path: "/Users/example/private.pdf",
      },
      { status: 409 },
    ),
  );
  const client = new ProjectKoiosApiClient();
  const file = new File(["%PDF-private"], "private.pdf", {
    type: "application/pdf",
  });

  await expect(client.provideProjectMissingPdf("example:key", file)).rejects.toEqual(
    expect.objectContaining({ status: 502 }),
  );
});

test("GitHub tasks request the live control projection", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ source: "github-live", repositories: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  const client = new ProjectKoiosApiClient();

  await expect(client.githubTasks()).resolves.toEqual({
    source: "github-live",
    repositories: [],
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "/github/tasks",
    expect.objectContaining({ signal: undefined }),
  );
});

test("citation documents request the control-only owner catalog", async () => {
  fetchMock.mockResolvedValue(
    Response.json({
      request_id: "catalog-request:1",
      result_id: "catalog-result:1",
      processing_registry_projection_id: "processing-registry:1",
      projection: { projection_id: "citation-projection:1", items: [] },
    }),
  );
  const client = new ProjectKoiosApiClient();

  await expect(client.citationDocuments()).resolves.toMatchObject({
    projection: { projection_id: "citation-projection:1", items: [] },
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "/citation-documents",
    expect.objectContaining({ signal: undefined }),
  );
});

test("citation source receipt sends the PDF as the raw application/pdf body", async () => {
  fetchMock.mockResolvedValue(
    Response.json({
      receipt_id: "citation-document-receipt:1",
      source_document: {
        source_document_id: "citation-source-document:1",
        sha256: "a".repeat(64),
        byte_size: 12,
        media_type: "application/pdf",
        descriptor_id: "citation-source-document-descriptor:1",
      },
      allowed_actions: ["PROCESS_PRIVATELY"],
    }),
  );
  const client = new ProjectKoiosApiClient();
  const file = new File(["%PDF-private"], "private.pdf", {
    type: "application/pdf",
  });

  await client.provideCitationDocumentSource("citation:item-1", file);

  expect(fetchMock).toHaveBeenCalledWith(
    "/citation-documents/citation%3Aitem-1/source",
    expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/pdf" },
      body: file,
    }),
  );
});

test("private citation processing binds the exact projection, identity item, and receipt", async () => {
  fetchMock.mockResolvedValue(
    Response.json({
      request_id: "request:1",
      intent_id: "intent:1",
      link_result_id: "link-result:1",
      source_document_link: {},
      receipt_id: "receipt:1",
      source_document_descriptor_id: "descriptor:1",
      document_id: "document:1",
      status: "FAILED",
      failure_code: "EXTRACTION_FAILED",
      result_id: "result:1",
    }),
  );
  const client = new ProjectKoiosApiClient();
  const request = {
    expected_projection_id: "projection:1",
    identity_item_id: "identity-item:1",
    receipt: {
      receipt_id: "receipt:1",
      source_document: {
        source_document_id: "source-document:1",
        sha256: "b".repeat(64),
        byte_size: 12,
        media_type: "application/pdf",
        descriptor_id: "descriptor:1",
      },
      allowed_actions: ["PROCESS_PRIVATELY" as const],
    },
  };

  await client.processCitationDocumentPrivately("citation:item-1", request);

  expect(fetchMock).toHaveBeenCalledWith(
    "/citation-documents/citation%3Aitem-1/process-private",
    expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }),
  );
});

test("transcripts request the control-only parsed-document catalog", async () => {
  fetchMock.mockResolvedValue(
    Response.json({
      documents: [
        {
          document_id: "document:fixture-001",
          display_name: "Sanitized fixture document",
          status: "AUTOMATED_UNREVIEWED",
          physical_page_count: 2,
        },
      ],
    }),
  );
  const client = new ProjectKoiosApiClient();

  await expect(client.transcripts()).resolves.toMatchObject({
    documents: [{ document_id: "document:fixture-001" }],
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "/transcripts",
    expect.objectContaining({ signal: undefined }),
  );
});

test("one transcript requests its encoded opaque identity", async () => {
  fetchMock.mockResolvedValue(
    Response.json({
      document_id: "document:fixture-001",
      display_name: "Sanitized fixture document",
      status: "AUTOMATED_UNREVIEWED",
      physical_page_count: 1,
      pages: [
        {
          page_id: "page:fixture-001:0",
          page_index: 0,
          physical_page: 1,
          printed_page_label: null,
          text: "Exact fixture text.",
        },
      ],
    }),
  );
  const client = new ProjectKoiosApiClient();

  await expect(client.transcript("document:fixture-001")).resolves.toMatchObject({
    pages: [{ text: "Exact fixture text." }],
  });
  expect(fetchMock).toHaveBeenCalledWith(
    "/transcripts/document%3Afixture-001",
    expect.objectContaining({ signal: undefined }),
  );
});

test("search sends the API request contract", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  const client = new ProjectKoiosApiClient();

  await client.search({ query: "Bloch theorem", limit: 5 });

  expect(fetchMock).toHaveBeenCalledWith(
    "/search",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ query: "Bloch theorem", limit: 5 }),
    }),
  );
});

test("citation decisions use the private review endpoint", async () => {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        claim_id: "appendix-g-001",
        disposition: "CORPUS_GAP",
        selected_citation_keys: [],
        note: "Source missing.",
        revision: 1,
        updated_at_utc: "2026-09-20T22:00:00+00:00",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );
  const client = new ProjectKoiosApiClient();

  await client.saveCitationDecision("appendix-g-001", {
    disposition: "CORPUS_GAP",
    selected_citation_keys: [],
    note: "Source missing.",
  });

  expect(fetchMock).toHaveBeenCalledWith(
    "/citation-reviews/appendix-g-001/decision",
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({
        disposition: "CORPUS_GAP",
        selected_citation_keys: [],
        note: "Source missing.",
      }),
    }),
  );
});

test("equation reviews request the generated document queue contract", async () => {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        contract_id: "projectkoios.api.equation-review",
        schema_version: 1,
        projection_id: "equation-review-queue:sha256:empty",
        package_id: "equation-review-package:sha256:empty",
        document_id: "pizzi2020",
        source_sha256: "a".repeat(64),
        total: 0,
        decided: 0,
        pending: 0,
        items: [],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );
  const client = new ProjectKoiosApiClient();

  await client.equationReviews("pizzi2020");

  expect(fetchMock).toHaveBeenCalledWith(
    "/equation-reviews?document_id=pizzi2020",
    expect.objectContaining({ signal: undefined }),
  );
});

test("equation review decisions bind acceptance to an assisted proposal", async () => {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        candidate_id: "equation:pizzi2020:1",
        disposition: "ACCEPT_TRANSCRIPTION",
        assistance_proposal_sha256: "d".repeat(64),
        note: "Checked.",
        revision: 1,
        updated_at_utc: "2026-09-28T18:00:00Z",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );
  const client = new ProjectKoiosApiClient();

  const request = {
    disposition: "ACCEPT_TRANSCRIPTION" as const,
    assistance_proposal_sha256: "d".repeat(64),
    reviewer_latex: "E = mc^2",
    display_mode: "DISPLAY" as const,
    render_confirmation: {
      renderer_id: "katex",
      renderer_version: "0.16.47",
      rendered_reviewer_latex_sha256: "e".repeat(64),
      rendered_obsidian_markdown_sha256: "f".repeat(64),
    },
    note: "Checked.",
    expected_previous_revision: 0,
  };
  await client.saveEquationReviewDecision("equation:pizzi2020:1", request);

  expect(fetchMock).toHaveBeenCalledWith(
    "/equation-reviews/equation%3Apizzi2020%3A1/decision",
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify(request),
    }),
  );
  expect(client.equationRegionImageUrl("equation:pizzi2020:1")).toBe(
    "/equation-reviews/equation%3Apizzi2020%3A1/region",
  );
});

test("organizer events use the bounded polling endpoint", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ events: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  const client = new ProjectKoiosApiClient();

  await client.organizerEvents(7);

  expect(fetchMock).toHaveBeenCalledWith(
    "/organizer/events?after=7",
    expect.objectContaining({ signal: undefined }),
  );
});

test("literature review requests the private progress endpoint", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ phase: "ASSESSING" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  const client = new ProjectKoiosApiClient();

  await client.literatureReviewProgress();

  expect(fetchMock).toHaveBeenCalledWith(
    "/literature-review/progress",
    expect.objectContaining({ signal: undefined }),
  );
});

test("provided references send a PDF with bounded metadata", async () => {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        receipt_id: "provided-reference:sha256:abc",
        status: "RECEIVED_NOT_INGESTED",
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );
  const client = new ProjectKoiosApiClient();
  const file = new File(["%PDF-1.7"], "example.pdf", {
    type: "application/pdf",
  });

  await client.provideLiteratureReference({
    claimId: "C-001",
    citationLabel: "ExampleAuthor2024",
    doiOrUrl: "10.0000/example",
    note: "Author copy",
    file,
  });

  expect(fetchMock).toHaveBeenCalledWith(
    "/literature-review/references",
    expect.objectContaining({
      method: "POST",
      body: expect.any(FormData),
    }),
  );
  const request = fetchMock.mock.calls[0][1];
  const body = request?.body as FormData;
  expect(body.get("claim_id")).toBe("C-001");
  expect(body.get("citation_label")).toBe("ExampleAuthor2024");
  expect(body.get("reference_pdf")).toBe(file);
});

test("nested typed API errors preserve citation-document status, code, and detail", async () => {
  fetchMock.mockResolvedValue(
    Response.json(
      {
        detail: {
          code: "CITATION_DOCUMENT_PROJECTION_CONFLICT",
          detail: "the citation-document projection is stale",
        },
      },
      { status: 409 },
    ),
  );
  const client = new ProjectKoiosApiClient();

  await expect(client.citationDocuments()).rejects.toEqual(
    new ApiError(
      409,
      "the citation-document projection is stale",
      "CITATION_DOCUMENT_PROJECTION_CONFLICT",
    ),
  );
});

test("typed API errors preserve status, code, and detail", async () => {
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        code: "EQUATION_REVIEW_REVISION_STALE",
        detail: "equation review revision is stale",
      }),
      {
        status: 409,
        headers: { "Content-Type": "application/json" },
      },
    ),
  );
  const client = new ProjectKoiosApiClient();

  const request = client.equationReviews("pizzi2020");

  await expect(request).rejects.toEqual(
    new ApiError(
      409,
      "equation review revision is stale",
      "EQUATION_REVIEW_REVISION_STALE",
    ),
  );
});

test("API errors preserve status and detail", async () => {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ detail: "Invalid query" }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    }),
  );
  const client = new ProjectKoiosApiClient();

  const request = client.search({ query: "", limit: 10 });

  await expect(request).rejects.toEqual(new ApiError(422, "Invalid query"));
});
