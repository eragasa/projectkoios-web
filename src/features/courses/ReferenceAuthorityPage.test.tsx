import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import type { CourseReferenceQueue } from "../../api/client";
import { ReferenceAuthorityPage } from "./ReferenceAuthorityPage";

const COURSE_ID = "dlsu.phy627m.gs1";
const QUEUE_PATH = `/courses/${COURSE_ID}/references`;

function authorityQueue(withAssetAuthority = false): CourseReferenceQueue {
  const selectionIds = Array.from(
    { length: 14 },
    (_, index) => `selection:${index + 1}`,
  );
  const authority = withAssetAuthority
    ? {
        active_citekey: "Ashcroft1976",
        alias_citekeys: ["ashcroft-mermin"],
        authority_binding_id: "authority-binding:1",
        bibliographic_work_id: "work:1",
        candidate_id: "candidate:1",
        canonical_asset_decision_id: null,
        identity_decision_id: "identity-decision:1",
        source_asset_id: null,
        state_projection_id: "state-projection:1",
      }
    : null;
  return {
    contract_id: "projectkoios.references.course-reference-authority@0.1.0",
    control_class: "CONTROL",
    request_id: "queue-request:1",
    queue_id: "queue:1",
    render_result_id: "render-result:1",
    review_projection_id: "review-projection:1",
    source_export_result_id: "source-export:1",
    state_projection_ids: authority ? [authority.state_projection_id] : [],
    active_authorities: authority ? [authority] : [],
    scope: {
      course_id: COURSE_ID,
      course_title: "Solid State Physics II",
      inventory_id: "inventory:1",
      manifest_id: "manifest:1",
      manifest_sha256: "a".repeat(64),
      ordered_selection_ids: selectionIds,
      scope_id: "scope:1",
      total: 14,
    },
    items: selectionIds.map((selectionId, index) => ({
      active_authority: index === 0 ? authority : null,
      allowed_asset_actions:
        index === 0 && authority ? ["AUTHORIZE", "REJECT", "DEFER"] : [],
      allowed_identity_actions:
        index === 0 && !authority
          ? ["ACCEPT_EXISTING", "ACCEPT_NEW", "MERGE", "REJECT", "DEFER"]
          : [],
      assets:
        index === 0
          ? [
              {
                asset_observation_id: "asset:1",
                asset_status: "received-unreviewed",
                byte_size: 2048,
                candidate_id: "candidate:1",
                document_binding_ids: ["document-binding:1"],
                ingestion_artifact_links: [],
                ingestion_evidence_ids: ["ingestion-evidence:1"],
                rights_status: "operator-supplied",
                runtime_availability: "available",
                runtime_evidence_id: "runtime-evidence:1",
                sha256: "b".repeat(64),
              },
              {
                asset_observation_id: "asset:2",
                asset_status: "candidate",
                byte_size: 1024,
                candidate_id: "candidate:1",
                document_binding_ids: [],
                ingestion_artifact_links: [],
                ingestion_evidence_ids: ["ingestion-evidence:2"],
                rights_status: "unknown",
                runtime_availability: "unavailable",
                runtime_evidence_id: null,
                sha256: "c".repeat(64),
              },
            ]
          : [],
      candidate:
        index === 0
          ? {
              authors: ["N. W. Ashcroft", "N. D. Mermin"],
              candidate_id: "candidate:1",
              citekey_status: "proposed",
              doi: null,
              entry_type: "book",
              eprint: null,
              identity_status: "unresolved",
              isbn: "9780030839931",
              proposed_citekey: "Ashcroft1976",
              source_observation_ids: ["observation:1"],
              title: "Solid State Physics",
              url: null,
              year: "1976",
            }
          : null,
      current_asset_decision: null,
      current_identity_decisions: [],
      item_revision_id: `item-revision:${index + 1}`,
      observations:
        index === 0
          ? [
              {
                asserted_source_revision: "source-revision:1",
                bibliography_byte_size: 800,
                bibliography_sha256: "d".repeat(64),
                entry_byte_size: 180,
                entry_index: 0,
                entry_sha256: "e".repeat(64),
                observation_id: "observation:1",
                observed_citekey: "ashcroft_mermin",
                source_id: "source:1",
              },
            ]
          : [],
      record_matches:
        index === 0
          ? [
              {
                authority_status: "non-authoritative-discrepancy-observation",
                bibtex_byte_size: 180,
                bibtex_sha256: "e".repeat(64),
                citekey: "ashcroft_mermin",
                kind: "exact-observed-key-and-bytes",
                record_id: "record:1",
              },
            ]
          : [],
      rendered_entry:
        index === 0
          ? {
              citekey: "Ashcroft1976",
              entry_id: "rendered-entry:1",
              entry_type: "book",
              normalized_fields: [["title", "Solid State Physics"]],
              rendered_byte_size: 190,
              rendered_sha256: "f".repeat(64),
              source_observation_ids: ["observation:1"],
            }
          : null,
      resolution: index === 0 ? "ready" : "candidate-unavailable",
      selection: {
        course_id: COURSE_ID,
        display_citekey: index === 0 ? "ashcroft_mermin" : `unresolved_${index + 1}`,
        display_citekey_status: "observed",
        inventory_id: "inventory:1",
        locator_binding_id: `locator-binding:${index + 1}`,
        manifest_id: "manifest:1",
        next_selection_id: selectionIds[index + 1] ?? null,
        ordinal: index + 1,
        origin: "preserved-manuscript",
        previous_selection_id: selectionIds[index - 1] ?? null,
        reference_locator: `references.bib#${index + 1}`,
        role: "manuscript-bibliography",
        scope_id: "scope:1",
        selection_id: selectionId,
      },
    })),
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/control/courses/references"]}>
        <ReferenceAuthorityPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function response(body: unknown, status = 200) {
  return Promise.resolve(Response.json(body, { status }));
}

const identityPreview = {
  request_id: "preview-request:1",
  result_id: "preview-result:1",
  preview_id: "preview:1",
  queue_id: "queue:1",
  item_revision_id: "item-revision:1",
  selection_id: "selection:1",
  disposition: "ACCEPT_NEW",
  target_state_projection_id: null,
  canonical_citekey: "Ashcroft1976",
  alias_citekeys: [],
  selected_record_match_ids: ["record:1"],
  expected_current_decision_id: null,
} as const;

const identityReceipt = {
  current_decision_id: "identity-decision:2",
  current_state_projection_id: "state-projection:2",
  decision_append_request_id: "append-request:1",
  decision_id: "identity-decision:2",
  dimension: "reference-identity",
  disposition: "ACCEPT_NEW",
  preview_id: "preview:1",
  put_request_id: "put-request:1",
  receipt_id: "receipt:1",
  refreshed_item_revision_id: "item-revision:2",
  refreshed_queue_id: "queue:2",
  result_id: "put-result:1",
  state_projection_id: "state-projection:2",
} as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("renders the exact owner order including unresolved left-projection items", async () => {
  const fetchMock = vi.fn(() => response(authorityQueue()));
  vi.stubGlobal("fetch", fetchMock);

  renderPage();

  expect(await screen.findByText("Reference 1 of 14")).toBeInTheDocument();
  expect(
    screen.getByRole("button", {
      name: /Select reference 14 of 14: unresolved_14, Candidate unavailable/,
    }),
  ).toBeInTheDocument();
  expect(screen.getByText("13. unresolved_13")).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Solid State Physics" }),
  ).toBeInTheDocument();
  for (const action of [
    "Accept existing authority",
    "Accept as new authority",
    "Merge with existing authority",
    "Reject candidate",
    "Defer identity decision",
  ]) {
    expect(screen.getByLabelText(action)).toBeInTheDocument();
  }
  expect(screen.getByText("Evidence and assets remain separate")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    QUEUE_PATH,
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});

test("fails closed when the bounded queue is not the exact 14-item projection", async () => {
  const incomplete = authorityQueue();
  incomplete.items = incomplete.items.slice(0, 13);
  vi.stubGlobal(
    "fetch",
    vi.fn(() => response(incomplete)),
  );

  renderPage();

  expect(
    await screen.findByRole("heading", {
      name: "Course reference queue failed integrity checks",
    }),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Accept as new authority")).not.toBeInTheDocument();
});

test("invalidates an owner preview after a consequence edit", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn((request: RequestInfo | URL) => {
      const path = String(request);
      return path.endsWith("/decision-preview")
        ? response(identityPreview)
        : response(authorityQueue());
    }),
  );

  renderPage();
  await screen.findByText("Reference 1 of 14");
  await user.click(screen.getByLabelText("Accept as new authority"));
  await user.click(screen.getByRole("checkbox", { name: /ashcroft_mermin/ }));
  await user.click(
    screen.getByRole("button", { name: "Preview identity consequences" }),
  );

  expect(
    await screen.findByLabelText("Owner-generated identity preview"),
  ).toBeInTheDocument();
  await user.type(screen.getByLabelText("Canonical citekey"), "Edited");
  expect(
    screen.queryByLabelText("Owner-generated identity preview"),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Confirm identity decision" }),
  ).toBeDisabled();
});

test("freezes the complete identity PUT for an exact transport retry", async () => {
  const user = userEvent.setup();
  let putCount = 0;
  const fetchMock = vi.fn((request: RequestInfo | URL, init?: RequestInit) => {
    const path = String(request);
    if (path.endsWith("/decision-preview")) return response(identityPreview);
    if (path.endsWith("/decision") && init?.method === "PUT") {
      putCount += 1;
      return putCount === 1
        ? response({ code: "OWNER_UNAVAILABLE", detail: "temporary" }, 503)
        : response(identityReceipt);
    }
    return response(authorityQueue());
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
    "123e4567-e89b-42d3-a456-426614174000",
  );

  renderPage();
  await screen.findByText("Reference 1 of 14");
  await user.click(screen.getByLabelText("Accept as new authority"));
  await user.click(screen.getByRole("checkbox", { name: /ashcroft_mermin/ }));
  await user.type(
    screen.getByLabelText("Decision rationale"),
    "Reviewed owner evidence and exact source bytes.",
  );
  await user.click(
    screen.getByRole("button", { name: "Preview identity consequences" }),
  );
  await screen.findByLabelText("Owner-generated identity preview");
  await user.click(screen.getByRole("button", { name: "Confirm identity decision" }));

  const retry = await screen.findByRole("button", {
    name: "Retry exact identity request",
  });
  await user.click(retry);
  expect(await screen.findByLabelText("Recorded owner receipt")).toBeInTheDocument();

  const putCalls = fetchMock.mock.calls.filter(
    ([request, init]) =>
      String(request).endsWith("/decision") && init?.method === "PUT",
  );
  expect(putCalls).toHaveLength(2);
  expect(putCalls[0]?.[1]?.body).toBe(putCalls[1]?.[1]?.body);
  const body = JSON.parse(String(putCalls[0]?.[1]?.body));
  expect(body).toMatchObject({
    expected_preview_id: "preview:1",
    expected_preview_result_id: "preview-result:1",
    expected_queue_id: "queue:1",
    expected_item_revision_id: "item-revision:1",
    idempotency_key: "123e4567-e89b-42d3-a456-426614174000",
  });
  expect(body.decided_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u);
  expect(body).not.toHaveProperty("actor_id");
  expect(body).not.toHaveProperty("actor_verification_record_id");
});

test("discards a preview and reports a typed stale decision", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn((request: RequestInfo | URL, init?: RequestInit) => {
      const path = String(request);
      if (path.endsWith("/decision-preview")) return response(identityPreview);
      if (path.endsWith("/decision") && init?.method === "PUT") {
        return response({ code: "REVISION_STALE", detail: "internal detail" }, 409);
      }
      return response(authorityQueue());
    }),
  );
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
    "123e4567-e89b-42d3-a456-426614174001",
  );

  renderPage();
  await screen.findByText("Reference 1 of 14");
  await user.click(screen.getByLabelText("Accept as new authority"));
  await user.click(screen.getByRole("checkbox", { name: /ashcroft_mermin/ }));
  await user.type(screen.getByLabelText("Decision rationale"), "Reviewed evidence.");
  await user.click(
    screen.getByRole("button", { name: "Preview identity consequences" }),
  );
  await screen.findByLabelText("Owner-generated identity preview");
  await user.click(screen.getByRole("button", { name: "Confirm identity decision" }));

  expect(await screen.findByText(/A newer item revision exists/)).toBeInTheDocument();
  expect(
    screen.queryByLabelText("Owner-generated identity preview"),
  ).not.toBeInTheDocument();
  expect(screen.queryByText("internal detail")).not.toBeInTheDocument();
});

test("binds the complete owner asset plan after identity authority exists", async () => {
  const user = userEvent.setup();
  const queue = authorityQueue(true);
  const assetPreview = {
    request_id: "asset-preview-request:1",
    result_id: "asset-preview-result:1",
    preview_id: "asset-preview:1",
    queue_id: "queue:1",
    item_revision_id: "item-revision:1",
    selection_id: "selection:1",
    identity_state_projection_id: "state-projection:1",
    disposition: "AUTHORIZE",
    competitors: [
      {
        asset_observation_id: "asset:1",
        disposition: "AUTHORIZE",
        rationale: "Verified canonical source bytes.",
      },
      {
        asset_observation_id: "asset:2",
        disposition: "REJECT",
        rationale: "Runtime evidence is unavailable.",
      },
    ],
    selected_asset_observation_id: "asset:1",
    plan_id: "asset-plan:1",
    expected_current_decision_id: null,
  } as const;
  const assetReceipt = {
    ...identityReceipt,
    current_decision_id: "asset-decision:1",
    current_state_projection_id: "state-projection:3",
    decision_id: "asset-decision:1",
    dimension: "canonical-asset",
    disposition: "AUTHORIZE",
    preview_id: "asset-preview:1",
    receipt_id: "asset-receipt:1",
    state_projection_id: "state-projection:3",
  } as const;
  let assetPut: RequestInit | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn((request: RequestInfo | URL, init?: RequestInit) => {
      const path = String(request);
      if (path.endsWith("/asset-decision-preview")) return response(assetPreview);
      if (path.endsWith("/asset-decision") && init?.method === "PUT") {
        assetPut = init;
        return response(assetReceipt);
      }
      return response(queue);
    }),
  );
  vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
    "123e4567-e89b-42d3-a456-426614174002",
  );

  renderPage();
  await screen.findByText("Reference 1 of 14");
  await user.click(screen.getByLabelText("Authorize canonical asset"));
  const assetFieldset = screen.getByRole("group", {
    name: "Explicit disposition for every asset competitor",
  });
  const dispositions = within(assetFieldset).getAllByLabelText(
    "Competitor disposition",
  );
  const rationales = within(assetFieldset).getAllByLabelText("Competitor rationale");
  await user.selectOptions(dispositions[0]!, "AUTHORIZE");
  await user.type(rationales[0]!, "Verified canonical source bytes.");
  await user.selectOptions(dispositions[1]!, "REJECT");
  await user.type(rationales[1]!, "Runtime evidence is unavailable.");
  await user.type(
    screen.getByLabelText("Overall asset-decision rationale"),
    "Bind the only reviewed available source asset.",
  );
  await user.click(screen.getByRole("button", { name: "Preview asset consequences" }));
  expect(
    await screen.findByLabelText("Owner-generated asset preview"),
  ).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Confirm asset decision" }));

  expect(await screen.findByLabelText("Recorded owner receipt")).toBeInTheDocument();
  const body = JSON.parse(String(assetPut?.body));
  expect(body).toMatchObject({
    expected_preview_id: "asset-preview:1",
    expected_preview_result_id: "asset-preview-result:1",
    expected_asset_plan_id: "asset-plan:1",
    expected_identity_state_projection_id: "state-projection:1",
    idempotency_key: "123e4567-e89b-42d3-a456-426614174002",
  });
  expect(body.competitors).toEqual(assetPreview.competitors);
  expect(body).not.toHaveProperty("actor_id");
});

test("guards queue navigation while a draft is dirty", async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => response(authorityQueue())),
  );

  renderPage();
  await screen.findByText("Reference 1 of 14");
  await user.click(screen.getByLabelText("Defer identity decision"));
  await user.click(
    screen.getByRole("button", {
      name: /Select reference 2 of 14: unresolved_2/,
    }),
  );

  expect(
    screen.getByRole("heading", { name: "Discard unsubmitted decision changes?" }),
  ).toBeInTheDocument();
  expect(
    screen.getAllByText("ashcroft_mermin", { selector: "code" }).length,
  ).toBeGreaterThan(0);
  await user.click(
    screen.getByRole("button", { name: "Discard changes and continue" }),
  );
  await waitFor(() =>
    expect(screen.getByText("Reference 2 of 14")).toBeInTheDocument(),
  );
});
