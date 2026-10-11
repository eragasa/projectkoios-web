import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { apiClient, type CourseReferenceQueue } from "../../api/client";
import { usePageMetadata } from "../../app/usePageMetadata";
import { DisclosurePanel } from "../../components/DisclosurePanel";
import { ReviewPageHeader, ReviewProgress } from "../../components/ReviewPageHeader";
import {
  ReferenceAuthorityWorkspace,
  type ReferenceDraftState,
} from "./ReferenceAuthorityWorkspace";
import {
  courseReferenceError,
  resolutionLabels,
  SOLID_STATE_II_COURSE_ID,
  SOLID_STATE_II_REFERENCE_COUNT,
} from "./referenceAuthorityModel";

interface NavigationState extends ReferenceDraftState {
  selectionId: string;
}

function queueIsExact(queue: CourseReferenceQueue): boolean {
  return (
    queue.control_class === "CONTROL" &&
    queue.scope.course_id === SOLID_STATE_II_COURSE_ID &&
    queue.scope.total === SOLID_STATE_II_REFERENCE_COUNT &&
    queue.items.length === SOLID_STATE_II_REFERENCE_COUNT &&
    queue.scope.ordered_selection_ids.length === SOLID_STATE_II_REFERENCE_COUNT &&
    queue.items.every(
      (item, index) =>
        item.selection.selection_id === queue.scope.ordered_selection_ids[index] &&
        item.selection.ordinal === index + 1 &&
        item.selection.course_id === queue.scope.course_id &&
        item.selection.previous_selection_id ===
          (queue.scope.ordered_selection_ids[index - 1] ?? null) &&
        item.selection.next_selection_id ===
          (queue.scope.ordered_selection_ids[index + 1] ?? null),
    )
  );
}

function QueueProvenance({ queue }: { queue: CourseReferenceQueue }) {
  return (
    <DisclosurePanel
      className="reference-queue-provenance"
      summary="Course scope and queue provenance"
    >
      <dl>
        <div>
          <dt>Contract</dt>
          <dd>
            <code>{queue.contract_id}</code>
          </dd>
        </div>
        <div>
          <dt>Queue</dt>
          <dd>
            <code>{queue.queue_id}</code>
          </dd>
        </div>
        <div>
          <dt>Scope</dt>
          <dd>
            <code>{queue.scope.scope_id}</code>
          </dd>
        </div>
        <div>
          <dt>Manifest</dt>
          <dd>
            <code>{queue.scope.manifest_id}</code>
          </dd>
        </div>
        <div>
          <dt>Manifest SHA-256</dt>
          <dd>
            <code>{queue.scope.manifest_sha256}</code>
          </dd>
        </div>
        <div>
          <dt>Inventory</dt>
          <dd>
            <code>{queue.scope.inventory_id}</code>
          </dd>
        </div>
        <div>
          <dt>Source export</dt>
          <dd>
            <code>{queue.source_export_result_id}</code>
          </dd>
        </div>
        <div>
          <dt>Rendered bibliography</dt>
          <dd>
            <code>{queue.render_result_id}</code>
          </dd>
        </div>
        <div>
          <dt>Review projection</dt>
          <dd>
            <code>{queue.review_projection_id}</code>
          </dd>
        </div>
      </dl>
    </DisclosurePanel>
  );
}

export function ReferenceAuthorityPage() {
  usePageMetadata(
    "Course references · Solid State Physics II",
    "Resolve the bounded Solid State Physics II reference-authority queue with owner-generated previews.",
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("item");
  const [navigationState, setNavigationState] = useState<NavigationState | null>(null);
  const [pendingSelectionId, setPendingSelectionId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["course-references", SOLID_STATE_II_COURSE_ID],
    queryFn: ({ signal }) =>
      apiClient.courseReferences(SOLID_STATE_II_COURSE_ID, signal),
    retry: false,
  });

  const queue = query.data;
  const validQueue = queue && queueIsExact(queue) ? queue : null;
  const items = useMemo(() => validQueue?.items ?? [], [validQueue]);
  const firstPending = items.find(
    (item) =>
      item.active_authority === null ||
      (item.assets.length > 0 && item.current_asset_decision === null),
  );
  const selectedIndex = selectedId
    ? items.findIndex((item) => item.selection.selection_id === selectedId)
    : -1;
  const activeIndex =
    selectedIndex >= 0
      ? selectedIndex
      : firstPending
        ? items.indexOf(firstPending)
        : items.length
          ? 0
          : -1;
  const activeItem = activeIndex >= 0 ? items[activeIndex] : null;

  const setSelected = useCallback(
    (selectionId: string) => {
      const next = new URLSearchParams(searchParams);
      next.set("item", selectionId);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (activeItem && selectedIndex < 0) setSelected(activeItem.selection.selection_id);
  }, [activeItem, selectedIndex, setSelected]);

  useEffect(() => {
    setNavigationState(null);
    setPendingSelectionId(null);
  }, [activeItem?.selection.selection_id]);

  const activeNavigation =
    navigationState?.selectionId === activeItem?.selection.selection_id
      ? navigationState
      : null;
  const dirty = activeNavigation?.dirty ?? false;
  const busy = activeNavigation?.busy ?? false;

  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  function requestSelection(selectionId: string) {
    if (selectionId === activeItem?.selection.selection_id || busy) return;
    if (dirty) {
      setPendingSelectionId(selectionId);
      return;
    }
    setSelected(selectionId);
  }

  function discardAndNavigate() {
    if (!pendingSelectionId) return;
    const selectionId = pendingSelectionId;
    setPendingSelectionId(null);
    setNavigationState(null);
    setSelected(selectionId);
  }

  const identityDecided = items.filter((item) => item.active_authority !== null).length;
  const previousItem = activeIndex > 0 ? items[activeIndex - 1] : null;
  const nextItem =
    activeIndex >= 0 && activeIndex < items.length - 1 ? items[activeIndex + 1] : null;

  return (
    <div className="reference-authority-page">
      <nav className="transcript-back" aria-label="Course navigation">
        <Link to="/courses">← Courses</Link>
      </nav>
      <ReviewPageHeader
        eyebrow="Courses · CONTROL reference authority"
        title="Solid State Physics II references"
        description="Resolve the exact Courses-owned reference scope through References-owned identity, citekey, and canonical-asset decisions. Every mutation requires a current owner-generated consequence preview."
        aside={
          validQueue ? (
            <ReviewProgress
              ariaLabel="Reference identity progress"
              current={identityDecided}
              total={validQueue.scope.total}
              summary="identity authorities established"
            />
          ) : undefined
        }
      />

      <section className="reference-course-context" aria-label="Courses-owned context">
        <div>
          <p className="eyebrow">Courses-owned context</p>
          <strong>{validQueue?.scope.course_title ?? "Solid State Physics II"}</strong>
          <code>{SOLID_STATE_II_COURSE_ID}</code>
        </div>
        <p>
          Course scope and order come from Courses. Identity, citekeys, assets,
          previews, and decisions remain References-owned. The browser stores no
          authority state.
        </p>
      </section>

      {query.isPending ? (
        <div className="review-loading" role="status">
          Loading 14 course references…
        </div>
      ) : null}
      {query.isError ? (
        <div className="empty-state" role="alert">
          <h2>Course reference authority unavailable</h2>
          <p>{courseReferenceError(query.error, "queue")}</p>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => void query.refetch()}
          >
            Retry
          </button>
        </div>
      ) : null}
      {queue && !validQueue ? (
        <div className="empty-state" role="alert">
          <h2>Course reference queue failed integrity checks</h2>
          <p>
            Expected one complete ordered CONTROL projection containing exactly 14
            selections for {SOLID_STATE_II_COURSE_ID}. No authority action is available.
          </p>
        </div>
      ) : null}

      {validQueue ? (
        <>
          <QueueProvenance queue={validQueue} />
          <div className="reference-authority-layout">
            <aside className="reference-queue" aria-label="Course reference queue">
              <header>
                <h2>Reference queue</h2>
                <span>{validQueue.scope.total} selections</span>
              </header>
              <ol>
                {items.map((item) => {
                  const identityReady = item.active_authority !== null;
                  const assetReady = Boolean(
                    item.active_authority?.canonical_asset_decision_id,
                  );
                  return (
                    <li key={item.selection.selection_id}>
                      <button
                        type="button"
                        aria-current={
                          item.selection.selection_id ===
                          activeItem?.selection.selection_id
                            ? "true"
                            : undefined
                        }
                        aria-label={`Select reference ${item.selection.ordinal} of ${items.length}: ${item.selection.display_citekey}, ${resolutionLabels[item.resolution]}`}
                        disabled={busy}
                        onClick={() => requestSelection(item.selection.selection_id)}
                      >
                        <span>
                          <strong>
                            {item.selection.ordinal}. {item.selection.display_citekey}
                          </strong>
                          <small>{resolutionLabels[item.resolution]}</small>
                        </span>
                        <span className="reference-queue__status">
                          <i className={identityReady ? "ready" : "pending"}>
                            identity
                          </i>
                          <i className={assetReady ? "ready" : "pending"}>asset</i>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </aside>

            <div className="reference-authority-main">
              <nav
                className="reference-navigation"
                aria-label="Reference queue navigation"
              >
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={!previousItem || busy}
                  onClick={() =>
                    previousItem &&
                    requestSelection(previousItem.selection.selection_id)
                  }
                >
                  Previous
                </button>
                <span>
                  Reference {activeIndex + 1} of {items.length}
                </span>
                <button
                  className="button button--secondary"
                  type="button"
                  disabled={!nextItem || busy}
                  onClick={() =>
                    nextItem && requestSelection(nextItem.selection.selection_id)
                  }
                >
                  Next
                </button>
              </nav>

              {pendingSelectionId ? (
                <section
                  className="reference-navigation-guard"
                  role="alertdialog"
                  aria-labelledby="reference-navigation-guard-heading"
                >
                  <div>
                    <h3 id="reference-navigation-guard-heading">
                      Discard unsubmitted decision changes?
                    </h3>
                    <p>
                      A decision draft or owner preview is active. Stay here or
                      explicitly discard it before navigating.
                    </p>
                  </div>
                  <div>
                    <button
                      className="button button--secondary"
                      type="button"
                      onClick={() => setPendingSelectionId(null)}
                    >
                      Stay on reference
                    </button>
                    <button
                      className="button button--primary"
                      type="button"
                      onClick={discardAndNavigate}
                    >
                      Discard changes and continue
                    </button>
                  </div>
                </section>
              ) : null}

              {activeItem ? (
                <ReferenceAuthorityWorkspace
                  key={activeItem.selection.selection_id}
                  courseId={SOLID_STATE_II_COURSE_ID}
                  queue={validQueue}
                  item={activeItem}
                  onDraftStateChange={(state) => {
                    setNavigationState((current) => {
                      if (
                        current?.selectionId === activeItem.selection.selection_id &&
                        current.dirty === state.dirty &&
                        current.busy === state.busy
                      )
                        return current;
                      return {
                        selectionId: activeItem.selection.selection_id,
                        ...state,
                      };
                    });
                  }}
                  onNext={
                    nextItem
                      ? () => requestSelection(nextItem.selection.selection_id)
                      : undefined
                  }
                />
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
