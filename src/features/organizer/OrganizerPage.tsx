import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import {
  apiClient,
  type OrganizerControlRequest,
  type OrganizerEvent,
} from "../../api/client";
import { usePageMetadata } from "../../app/usePageMetadata";

const organizerStatusKey = ["organizer", "status"] as const;

export function OrganizerPage() {
  usePageMetadata(
    "Organization agent",
    "Private local status and controls for the metadata-only Project Koios organization agent.",
  );
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [streamError, setStreamError] = useState(false);
  const status = useQuery({
    queryKey: organizerStatusKey,
    queryFn: ({ signal }) => apiClient.organizerStatus(signal),
    refetchInterval: 3_000,
  });
  const control = useMutation({
    mutationFn: (request: OrganizerControlRequest) =>
      apiClient.setOrganizerMode(request),
    onSuccess: (value) => {
      queryClient.setQueryData(organizerStatusKey, value);
    },
  });

  useEffect(() => {
    const source = new EventSource(apiClient.organizerEventStreamUrl(0));
    source.addEventListener("organizer", (event) => {
      const value = JSON.parse((event as MessageEvent<string>).data) as OrganizerEvent;
      setEvents((current) => {
        if (current.some((item) => item.sequence === value.sequence)) {
          return current;
        }
        return [...current, value].slice(-100);
      });
      setStreamError(false);
    });
    source.onerror = () => {
      setStreamError(true);
    };
    return () => source.close();
  }, []);

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
          Cloud roots are read-only. Local Ollama proposals require human review before
          any organization plan can be applied.
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
            <p className="eyebrow">Live local event stream</p>
            <h2 id="organizer-events-title">Agent activity</h2>
          </div>
          <span>{streamError ? "Reconnecting…" : "Connected"}</span>
        </div>
        {events.length === 0 ? (
          <p>No organizer events have been recorded.</p>
        ) : (
          <ol>
            {[...events].reverse().map((event) => (
              <li key={event.sequence}>
                <strong>{event.kind.replaceAll("_", " ")}</strong>
                <span>{event.message}</span>
                <time>{event.occurred_at}</time>
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
