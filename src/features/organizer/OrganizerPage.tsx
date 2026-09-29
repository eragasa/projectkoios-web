import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient, type OrganizerControlRequest } from "../../api/client";

const organizerStatusKey = ["organizer", "status"] as const;
const organizerEventsKey = ["organizer", "events"] as const;

export function OrganizerPage() {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: organizerStatusKey,
    queryFn: ({ signal }) => apiClient.organizerStatus(signal),
    refetchInterval: 3_000,
  });
  const events = useQuery({
    queryKey: organizerEventsKey,
    queryFn: ({ signal }) => apiClient.organizerEvents(0, signal),
    refetchInterval: 5_000,
  });
  const control = useMutation({
    mutationFn: (request: OrganizerControlRequest) =>
      apiClient.setOrganizerMode(request),
    onSuccess: async (value) => {
      queryClient.setQueryData(organizerStatusKey, value);
      await queryClient.invalidateQueries({ queryKey: organizerEventsKey });
    },
  });

  const value = status.data;
  return (
    <div className="control-dashboard organizer-page">
      <header className="control-heading">
        <div>
          <p className="eyebrow">Private local agent · Observer mode</p>
          <h1>Life organizer</h1>
          <p>
            Catalog cloud-drive metadata and generate local categorization proposals.
            This agent cannot move, rename, or delete files.
          </p>
        </div>
        <div className="operator-card" aria-live="polite">
          <span className="operator-card__status">{value?.activity ?? "loading"}</span>
          <strong>Requested mode: {value?.desired_mode ?? "unknown"}</strong>
          <p>{value?.current_relative_path ?? "No active file"}</p>
        </div>
      </header>

      <section className="control-notice" aria-label="Organizer safety boundary">
        <strong>Proposal-only boundary.</strong>
        <span>
          Cloud roots are read-only. Local categorization proposals require human review
          before any organization plan can be applied.
        </span>
      </section>

      <section className="organizer-controls" aria-label="Organizer controls">
        {(["on", "pause", "off"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            disabled={control.isPending || value?.desired_mode === mode}
            onClick={() => control.mutate({ mode })}
          >
            {mode === "on" ? "Start" : mode === "pause" ? "Pause" : "Turn off"}
          </button>
        ))}
        {control.isError ? <p role="alert">Unable to update organizer mode.</p> : null}
      </section>

      {status.isLoading ? <p>Loading organizer status…</p> : null}
      {status.isError ? <p role="alert">Unable to read organizer status.</p> : null}
      {value ? (
        <section className="organizer-metrics" aria-label="Catalog progress">
          <Metric label="Cloud roots" value={value.discovered_roots} />
          <Metric label="Observed files" value={value.observed_files} />
          <Metric label="Local files" value={value.local_files} />
          <Metric label="Cloud placeholders" value={value.placeholder_files} />
          <Metric label="Proposals" value={value.proposed_files} />
        </section>
      ) : null}

      <section className="organizer-events" aria-labelledby="organizer-events-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Bounded polling snapshot</p>
            <h2 id="organizer-events-title">Latest organizer events</h2>
          </div>
          <span>{events.data ? `${events.data.events.length} shown` : "Loading…"}</span>
        </div>
        {events.isError ? (
          <p role="alert">Unable to read organizer events.</p>
        ) : events.data?.events.length === 0 ? (
          <p>No organizer events are available.</p>
        ) : (
          <ol>
            {events.data?.events.map((event) => (
              <li key={event.sequence}>
                <strong>{event.kind}</strong>
                <span>
                  Sequence {event.sequence}
                  {event.root_id ? ` · root ${event.root_id}` : ""}
                  {event.file_id ? ` · file ${event.file_id}` : ""}
                </span>
                <time dateTime={event.occurred_at}>{event.occurred_at}</time>
                <small>{event.message}</small>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <article>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </article>
  );
}
