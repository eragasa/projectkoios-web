import { expect, test } from "@playwright/test";

const courseId = "dlsu.phy627m.gs1";

function queue() {
  const selectionIds = Array.from(
    { length: 14 },
    (_, index) => `selection:${index + 1}`,
  );
  return {
    contract_id: "projectkoios.references.course-reference-authority@0.1.0",
    control_class: "CONTROL",
    request_id: "queue-request:1",
    queue_id: "queue:1",
    render_result_id: "render-result:1",
    review_projection_id: "review-projection:1",
    source_export_result_id: "source-export:1",
    state_projection_ids: [],
    active_authorities: [],
    scope: {
      course_id: courseId,
      course_title: "Solid State Physics II",
      inventory_id: "inventory:1",
      manifest_id: "manifest:1",
      manifest_sha256: "a".repeat(64),
      ordered_selection_ids: selectionIds,
      scope_id: "scope:1",
      total: 14,
    },
    items: selectionIds.map((selectionId, index) => ({
      active_authority: null,
      allowed_asset_actions: [],
      allowed_identity_actions: index === 0 ? ["ACCEPT_NEW", "REJECT", "DEFER"] : [],
      assets: [],
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
      observations: [],
      record_matches: [],
      rendered_entry: null,
      resolution: index === 0 ? "ready" : "candidate-unavailable",
      selection: {
        course_id: courseId,
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

test("Courses opens the exact CONTROL queue and records a preview-bound identity decision", async ({
  page,
}) => {
  let decisionBody: Record<string, unknown> | null = null;
  await page.route("**/api/courses", (route) =>
    route.fulfill({
      json: {
        schema_version: "1",
        reviewed_on: null,
        source: null,
        publication_boundary: [],
        institutions: [],
        unresolved_collections: [],
      },
    }),
  );
  await page.route(`**/courses/${courseId}/references**`, async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith("/decision-preview") && request.method() === "POST") {
      const body = request.postDataJSON();
      await route.fulfill({
        json: {
          request_id: "preview-request:1",
          result_id: "preview-result:1",
          preview_id: "preview:1",
          queue_id: body.expected_queue_id,
          item_revision_id: body.expected_item_revision_id,
          selection_id: "selection:1",
          disposition: body.disposition,
          target_state_projection_id: body.target_state_projection_id,
          canonical_citekey: body.canonical_citekey,
          alias_citekeys: body.alias_citekeys,
          selected_record_match_ids: body.selected_record_match_ids,
          expected_current_decision_id: body.expected_current_decision_id,
        },
      });
      return;
    }
    if (pathname.endsWith("/decision") && request.method() === "PUT") {
      decisionBody = request.postDataJSON();
      await route.fulfill({
        json: {
          current_decision_id: "identity-decision:1",
          current_state_projection_id: "state-projection:1",
          decision_append_request_id: "append-request:1",
          decision_id: "identity-decision:1",
          dimension: "reference-identity",
          disposition: "ACCEPT_NEW",
          preview_id: "preview:1",
          put_request_id: "put-request:1",
          receipt_id: "receipt:1",
          refreshed_item_revision_id: "item-revision:2",
          refreshed_queue_id: "queue:2",
          result_id: "put-result:1",
          state_projection_id: "state-projection:1",
        },
      });
      return;
    }
    await route.fulfill({ json: queue() });
  });

  await page.goto("/courses");
  await page.getByRole("link", { name: /Open course references/ }).click();

  await expect(
    page.getByRole("heading", { name: "Solid State Physics II references" }),
  ).toBeVisible();
  await expect(page.getByText("Reference 1 of 14")).toBeVisible();
  await expect(page).toHaveURL(/\?item=selection%3A1$/u);
  await expect(
    page.getByRole("button", {
      name: /Select reference 14 of 14: unresolved_14, Candidate unavailable/,
    }),
  ).toBeVisible();

  await page.getByLabel("Accept as new authority").check();
  await page.getByLabel("Decision rationale").fill("Reviewed the owner evidence.");
  await page.getByRole("button", { name: "Preview identity consequences" }).click();
  await expect(page.getByLabel("Owner-generated identity preview")).toBeVisible();
  await page.getByRole("button", { name: "Confirm identity decision" }).click();

  await expect(page.getByLabel("Recorded owner receipt")).toContainText(
    "Identity decision recorded",
  );
  expect(decisionBody).toMatchObject({
    expected_preview_id: "preview:1",
    expected_preview_result_id: "preview-result:1",
    expected_queue_id: "queue:1",
    expected_item_revision_id: "item-revision:1",
    disposition: "ACCEPT_NEW",
    canonical_citekey: "Ashcroft1976",
    rationale: "Reviewed the owner evidence.",
  });
  expect(decisionBody).not.toHaveProperty("actor_id");
  expect(decisionBody).not.toHaveProperty("actor_verification_record_id");
});
