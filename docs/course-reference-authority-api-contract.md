# Course reference-authority API contract

## Adopted boundary

The CONTROL-only course reference workspace consumes the reviewed control OpenAPI
artifact from `projectkoios-api` commit
`cee214ab2207e47e7b7696d772b3f3d5c0fc6bff`.

- Schema: `openapi/control.openapi.json`
- SHA-256: `a8128d46b62651aec77510a66309022b842668b6c5c76c0bc874db474a06eb09`
- Generated browser types: `src/api/schema.generated.ts`
- Initial course: `dlsu.phy627m.gs1`
- Initial bounded scope: exactly 14 owner-ordered selections

The PUBLIC OpenAPI document exposes none of these routes. The PUBLIC web profile has
neither the route nor the Courses navigation entry and performs no authority request.

## Routes

```text
GET  /courses/{course_id}/references
POST /courses/{course_id}/references/{item_id}/decision-preview
PUT  /courses/{course_id}/references/{item_id}/decision
POST /courses/{course_id}/references/{item_id}/asset-decision-preview
PUT  /courses/{course_id}/references/{item_id}/asset-decision
```

The queue is a complete Courses-owned left projection. The browser preserves
`scope.ordered_selection_ids`, including typed unresolved selections, and refuses to
expose a decision control if the initial projection is not one exact 14-item CONTROL
queue. It does not sort, omit, or invent candidates.

Course membership, order, origin, locators, and display guards are Courses-owned.
Reference identity, canonical citekey, aliases, record-match observations, decision
heads, evidence, active state projections, source assets, allowed actions, previews,
and receipts are References-owned.

## Preview-before-write workflow

Identity decisions are completed before canonical-asset decisions. The browser presents
only actions projected in `allowed_identity_actions` and `allowed_asset_actions`.

For identity review, the operator explicitly selects the disposition, target when
required, canonical citekey, aliases, record observations, and expected current head.
The browser sends those fields with the current queue and item revision to the identity
preview route. It labels consequences authoritative only after the owner returns a
preview and displays the full returned consequence projection plus `preview_id` and
`result_id`.

For asset review, an active identity state projection must exist. The operator gives
every projected asset competitor an explicit disposition and rationale. The owner
returns the selected canonical observation, complete competitor consequences, an asset
plan, identity state projection, and preview identities. The browser does not choose a
canonical asset or infer competitor consequences locally.

Editing any decision input discards the visible preview. Every HTTP 409 also discards it
and refreshes the queue. Confirmation is disabled until a current preview exists.

## Idempotent decisions

At confirmation, the browser creates one UTC-second `decided_at` and one UUID
`idempotency_key`, then freezes the entire PUT body. A transport or owner-availability
retry reuses those exact bytes. Changing an input creates a new intent instead.

Identity PUTs bind:

- the exact preview and preview-result identities;
- queue and item revisions;
- target state projection and current decision head where applicable;
- canonical and alias citekeys;
- selected record observations;
- disposition, rationale, and decision time.

Asset PUTs additionally bind the refreshed identity state projection and exact
owner-returned asset plan. Neither request accepts browser-supplied actor or actor
verification fields. The CONTROL API injects and verifies trusted actor provenance.

Typed stale evidence, revision, target, concurrent-decision, and idempotency conflicts
are shown as distinct safe operator messages. Raw owner detail is not rendered. A
successful PUT is shown as an owner receipt, followed by explicit next-item navigation.

## Browser boundary

TanStack Query holds replaceable server projections in memory. React state holds only
the current unsaved form, owner preview, and frozen in-flight intent. The feature uses
no local storage, IndexedDB, cookies, service-worker queue, filesystem access, or
browser-owned authority persistence. Navigation and page unload are guarded while an
unsaved intent is active.
