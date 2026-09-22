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
