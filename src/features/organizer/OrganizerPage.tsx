import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient, type OrganizerControlRequest } from "../../api/client";

const organizerStatusKey = ["organizer", "status"] as const;
const organizerProposalsKey = ["organizer", "proposals"] as const;

export function OrganizerPage() {
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: organizerStatusKey,
    queryFn: ({ signal }) => apiClient.organizerStatus(signal),
    refetchInterval: 3_000,
  });
  const proposals = useQuery({
    queryKey: organizerProposalsKey,
    queryFn: ({ signal }) => apiClient.organizerProposals(200, signal),
    refetchInterval: 5_000,
  });
  const control = useMutation({
    mutationFn: (request: OrganizerControlRequest) =>
      apiClient.setOrganizerMode(request),
    onSuccess: async (value) => {
      queryClient.setQueryData(organizerStatusKey, value);
      await queryClient.invalidateQueries({ queryKey: organizerProposalsKey });
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

      <section className="organizer-events" aria-labelledby="organizer-proposals-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Bounded polling snapshot</p>
            <h2 id="organizer-proposals-title">Latest proposals</h2>
          </div>
          <span>
            {proposals.data
              ? `${proposals.data.proposals.length}/${proposals.data.total} shown`
              : "Loading…"}
          </span>
        </div>
        {proposals.isError ? (
          <p role="alert">Unable to read organizer proposals.</p>
        ) : proposals.data?.proposals.length === 0 ? (
          <p>No organizer proposals are available.</p>
        ) : (
          <ol>
            {proposals.data?.proposals.map((proposal) => (
              <li key={proposal.file_id}>
                <strong>{proposal.name}</strong>
                <span>
                  {proposal.life_domain} · {proposal.para_category} ·{" "}
                  {proposal.suggested_group}
                  {proposal.course_code ? ` · ${proposal.course_code}` : ""}
                </span>
                <code>{proposal.relative_path}</code>
                <small>{proposal.rationale}</small>
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
