import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { TranscriptCatalogPage, TranscriptDocumentPage } from "./TranscriptsPage";

const documentSummary = {
  document_id: "document:fixture-001",
  display_name: "Sanitized fixture document",
  status: "AUTOMATED_UNREVIEWED",
  physical_page_count: 2,
};

const detail = {
  ...documentSummary,
  pages: [
    {
      page_id: "page:fixture-001:0",
      page_index: 0,
      physical_page: 1,
      printed_page_label: "i",
      text: "  First line\nSecond <unsafe> line  ",
    },
    {
      page_id: "page:fixture-001:1",
      page_index: 1,
      physical_page: 2,
      printed_page_label: null,
      text: "",
    },
  ],
};

function renderRoute(initialEntry = "/control/transcripts") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/control/transcripts" element={<TranscriptCatalogPage />} />
          <Route
            path="/control/transcripts/:documentId"
            element={<TranscriptDocumentPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("shows a loading state while the transcript catalog is pending", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => undefined)),
  );

  renderRoute();

  expect(screen.getByRole("status")).toHaveTextContent("Loading parsed documents…");
});

test("shows a loading state while one exact transcript is pending", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => undefined)),
  );

  renderRoute("/control/transcripts/document%3Afixture-001");

  expect(screen.getByRole("status")).toHaveTextContent("Loading exact transcript…");
});

test("shows a successful empty transcript catalog", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(Response.json({ documents: [] }))),
  );

  renderRoute();

  expect(
    await screen.findByRole("heading", { name: "No parsed documents available" }),
  ).toBeInTheDocument();
});

test("lists automated documents and links to an encoded control-only detail route", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(Response.json({ documents: [documentSummary] }))),
  );

  renderRoute();

  expect(
    await screen.findByRole("heading", { name: "Sanitized fixture document" }),
  ).toBeInTheDocument();
  expect(screen.getByText("Automated · unreviewed")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open exact transcript" })).toHaveAttribute(
    "href",
    "/control/transcripts/document%3Afixture-001",
  );
});

test("renders exact text in owner page order with visible page identities", async () => {
  const fetchMock = vi.fn(() => Promise.resolve(Response.json(detail)));
  vi.stubGlobal("fetch", fetchMock);

  const { container } = renderRoute("/control/transcripts/document%3Afixture-001");

  expect(
    await screen.findByRole("heading", { name: "Sanitized fixture document" }),
  ).toBeInTheDocument();
  const pages = screen.getAllByRole("article");
  expect(pages).toHaveLength(2);
  expect(within(pages[0]).getByText("page:fixture-001:0")).toBeInTheDocument();
  expect(within(pages[1]).getByText("page:fixture-001:1")).toBeInTheDocument();
  const identities = screen.getAllByLabelText("Page identity");
  expect(within(identities[0]).getByText("0")).toBeInTheDocument();
  expect(within(identities[0]).getByText("1")).toBeInTheDocument();
  expect(within(identities[1]).getByText("1")).toBeInTheDocument();
  expect(within(identities[1]).getByText("2")).toBeInTheDocument();
  expect(within(pages[0]).getByText("i")).toBeInTheDocument();
  expect(within(pages[1]).getByText("Not supplied")).toBeInTheDocument();
  expect(
    screen.getByLabelText("Exact transcript text for physical page 1").textContent,
  ).toBe("  First line\nSecond <unsafe> line  ");
  expect(
    screen.getByLabelText("Exact transcript text for physical page 2").textContent,
  ).toBe("");
  expect(screen.getByText("This page has empty transcript text.")).toBeInTheDocument();
  expect(screen.getAllByText("Automated · unreviewed")).toHaveLength(3);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(container.querySelector("script")).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    "/transcripts/document%3Afixture-001",
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});

test.each([
  [404, "Transcript not found", "No parsed document has that opaque identity."],
  [503, "Transcript unavailable", "transcript provider is currently unavailable"],
  [502, "Transcript unavailable", "provider returned a malformed projection"],
  [500, "Transcript unavailable", "control API could not return"],
])(
  "renders the %i transcript failure without leaking provider detail",
  async (status, heading, message) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json({ detail: "sanitized owner failure" }, { status }),
        ),
      ),
    );

    renderRoute("/control/transcripts/missing-document");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { name: heading })).toBeInTheDocument();
    expect(within(alert).getByText(new RegExp(message, "i"))).toBeInTheDocument();
    expect(screen.queryByText("sanitized owner failure")).not.toBeInTheDocument();
  },
);
