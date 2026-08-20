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
