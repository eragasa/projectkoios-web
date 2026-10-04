import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { apiClient } from "../../api/client";
import { MissingPdfsPage } from "./Ksdft2EffmassProjectPage";

const missing = {
  project_id: "ksdft2effmass" as const,
  total_references: 3,
  required_pdf_count: 2,
  bound_pdf_count: 1,
  missing_pdf_count: 1,
  not_applicable_count: 1,
  max_pdf_bytes: 1_000_000,
  media_type: "application/pdf" as const,
  items: [
    {
      citekey: "example2026",
      entry_type: "article",
      title: "Sanitized title",
      authors: ["Example, Alice"],
      year: "2026",
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MissingPdfsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

test("reviews one selected PDF before sending the raw file", async () => {
  const user = userEvent.setup();
  vi.spyOn(apiClient, "projectMissingPdfs").mockResolvedValue(missing);
  const provide = vi.spyOn(apiClient, "provideProjectMissingPdf").mockResolvedValue({
    project_id: "ksdft2effmass",
    citekey: "example2026",
    byte_size: 27,
    receipt_disposition: "received",
    binding_disposition: "bound",
    document_status: "received-unreviewed",
  });
  renderPage();

  await user.click(await screen.findByRole("radio", { name: /Sanitized title/ }));
  const file = new File(["%PDF-1.7\nsanitized\n%%EOF\n"], "example.pdf", {
    type: "application/pdf",
  });
  await user.upload(screen.getByLabelText("PDF for example2026"), file);
  await user.click(screen.getByRole("button", { name: "Review upload" }));

  expect(provide).not.toHaveBeenCalled();
  expect(
    screen.getByRole("heading", { name: "Confirm private PDF receipt" }),
  ).toBeInTheDocument();
  expect(screen.getByText("example.pdf")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Upload PDF for example2026" }));

  expect(provide).toHaveBeenCalledWith("example2026", file);
  expect(await screen.findByText(/PDF received for example2026/)).toBeInTheDocument();
});

test("reports received-unbound custody and refreshes the missing list", async () => {
  const user = userEvent.setup();
  const list = vi.spyOn(apiClient, "projectMissingPdfs").mockResolvedValue(missing);
  vi.spyOn(apiClient, "provideProjectMissingPdf").mockResolvedValue({
    project_id: "ksdft2effmass",
    citekey: "example2026",
    byte_size: 27,
    receipt_disposition: "received",
    binding_status: "received-unbound",
    document_status: "received-unreviewed",
    detail: "PDF was received but could not be bound",
  });
  renderPage();

  await user.click(await screen.findByRole("radio", { name: /Sanitized title/ }));
  const file = new File(["%PDF-1.7\nsanitized\n%%EOF\n"], "example.pdf", {
    type: "application/pdf",
  });
  await user.upload(screen.getByLabelText("PDF for example2026"), file);
  await user.click(screen.getByRole("button", { name: "Review upload" }));
  await user.click(screen.getByRole("button", { name: "Upload PDF for example2026" }));

  expect(
    await screen.findByText(/PDF received for example2026, but it could not be bound/),
  ).toBeInTheDocument();
  expect(screen.getByText(/Missing PDFs list was refreshed/)).toBeInTheDocument();
  expect(list).toHaveBeenCalledTimes(2);
});

test("rejects a non-PDF locally without calling the API", async () => {
  const user = userEvent.setup();
  vi.spyOn(apiClient, "projectMissingPdfs").mockResolvedValue(missing);
  const provide = vi.spyOn(apiClient, "provideProjectMissingPdf");
  renderPage();

  await user.click(await screen.findByRole("radio", { name: /Sanitized title/ }));
  await user.upload(
    screen.getByLabelText("PDF for example2026"),
    new File(["not a pdf"], "notes.pdf", { type: "text/plain" }),
  );
  await user.click(screen.getByRole("button", { name: "Review upload" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Choose a PDF file");
  expect(provide).not.toHaveBeenCalled();
});
