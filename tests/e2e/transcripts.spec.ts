import { expect, test } from "@playwright/test";

import type { TranscriptCatalog, TranscriptDocument } from "../../src/api/client";

const documentId = "document:fixture-001";

const catalog = {
  documents: [
    {
      document_id: documentId,
      display_name: "Sanitized fixture document",
      status: "AUTOMATED_UNREVIEWED",
      physical_page_count: 2,
    },
  ],
} satisfies TranscriptCatalog;

const transcript = {
  ...catalog.documents[0],
  pages: [
    {
      page_id: "page:fixture-001:0",
      page_index: 0,
      physical_page: 1,
      printed_page_label: "i",
      text: "  Exact first line\nSecond <literal> line  ",
    },
    {
      page_id: "page:fixture-001:1",
      page_index: 1,
      physical_page: 2,
      printed_page_label: null,
      text: "Final page.",
    },
  ],
} satisfies TranscriptDocument;

test("opens one automated transcript and preserves exact owner page order", async ({
  page,
}) => {
  await page.route("**/health", (route) => route.fulfill({ json: { status: "ok" } }));
  await page.route(/\/transcripts$/, (route) => {
    if (new URL(route.request().url()).pathname !== "/transcripts") {
      return route.fallback();
    }
    return route.fulfill({ json: catalog });
  });
  await page.route(/\/transcripts\/document%3Afixture-001$/i, (route) => {
    if (
      new URL(route.request().url()).pathname !== "/transcripts/document%3Afixture-001"
    ) {
      return route.fallback();
    }
    return route.fulfill({ json: transcript });
  });

  await page.goto("/control/transcripts");

  await expect(
    page.getByRole("heading", { name: "Sanitized fixture document" }),
  ).toBeVisible();
  await expect(page.getByText("Automated · unreviewed")).toBeVisible();
  await page.getByRole("link", { name: "Open exact transcript" }).click();

  await expect(page).toHaveURL(
    new RegExp("/control/transcripts/document%3Afixture-001$", "i"),
  );
  await expect(page.getByText("Automated and unreviewed")).toBeVisible();
  const transcriptPages = page.getByRole("article");
  await expect(transcriptPages).toHaveCount(2);
  await expect(transcriptPages.nth(0)).toContainText("page:fixture-001:0");
  await expect(transcriptPages.nth(1)).toContainText("page:fixture-001:1");
  await expect(page.getByLabel("Exact transcript text for physical page 1")).toHaveText(
    "  Exact first line\nSecond <literal> line  ",
    { useInnerText: false },
  );
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /approve|accept|review|edit|save/i }),
  ).toHaveCount(0);
});
