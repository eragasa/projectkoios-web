import { useState } from "react";

type PreviewMode = "proposed" | "diff";
type ChangeKind = "CREATE" | "UPDATE" | "CONFLICT";
type Disposition = "READY_FOR_APPLY" | "REVISION_REQUESTED" | "HOLD";
type DiffKind = "CONTEXT" | "ADDED" | "REMOVED" | "HUNK";

interface NoteProposal {
  proposalId: string;
  title: string;
  citekey: string;
  relativePath: string;
  changeKind: ChangeKind;
  proposedSha256: string;
  expectedContentSha256: string | null;
  frontmatterText: string;
  managedSections: ReadonlyArray<{
    name: string;
    heading: string;
    body: string;
  }>;
  proposedText: string;
  diff: ReadonlyArray<{ kind: DiffKind; text: string }>;
  conflict: string | null;
}

const batchSha256 = "4ad71635f25e68a5ccf5095ac115abc899ae9f3151cff575acdab89fd4ee9fc4";

const proposals: ReadonlyArray<NoteProposal> = [
  {
    proposalId: "periodic2dDefectReview",
    title: "Two-dimensional periodic defect literature",
    citekey: "periodic2dDefectReview",
    relativePath: "notes/research/periodic2dDefectReview.md",
    changeKind: "UPDATE",
    proposedSha256: "b15c7d948b4792c1c15aa81879c26a20c91917137c5a17abf19dcb9d00c4e512",
    expectedContentSha256:
      "37d4dc0f4933c90435c8598f4cc4f23ba2824cbca14acb49cd5b032d443a8881",
    frontmatterText: 'status: "draft"\ncampaign: "periodic2d_defect"',
    managedSections: [
      {
        name: "source-map",
        heading: "Source map",
        body: "Tracks candidate sources and their evidence boundaries.",
      },
      {
        name: "open-questions",
        heading: "Open questions",
        body: "Separates unresolved literature interpretation from accepted claims.",
      },
    ],
    proposedText: `---
status: "draft"
campaign: "periodic2d_defect"
---

# Two-dimensional periodic defect literature

## Source map

<!-- koios:managed:source-map:begin -->
Tracks candidate sources and their evidence boundaries.
<!-- koios:managed:source-map:end -->

## Reading notes

Human-authored comparison notes remain here.

## Open questions

<!-- koios:managed:open-questions:begin -->
Separates unresolved literature interpretation from accepted claims.
<!-- koios:managed:open-questions:end -->
`,
    diff: [
      { kind: "HUNK", text: "@@ -8,7 +8,7 @@" },
      { kind: "CONTEXT", text: " ## Source map" },
      { kind: "REMOVED", text: "-Candidate sources." },
      {
        kind: "ADDED",
        text: "+Tracks candidate sources and their evidence boundaries.",
      },
      { kind: "CONTEXT", text: " ## Reading notes" },
      { kind: "CONTEXT", text: " Human-authored comparison notes remain here." },
      {
        kind: "ADDED",
        text: "+## Open questions",
      },
    ],
    conflict: null,
  },
  {
    proposalId: "piab1dLiterature",
    title: "Particle in a box literature dossier",
    citekey: "piab1dLiterature",
    relativePath: "notes/research/piab1dLiterature.md",
    changeKind: "CREATE",
    proposedSha256: "ac1137201ba63123bdb5dbff25ba3b342a78367e6d88d233da2a9e87f9442a74",
    expectedContentSha256: null,
    frontmatterText: 'status: "draft"\ncampaign: "piab1d"',
    managedSections: [
      {
        name: "scope",
        heading: "Scope",
        body: "A proposed literature note; not scientific validation evidence.",
      },
    ],
    proposedText: `---
status: "draft"
campaign: "piab1d"
---

# Particle in a box literature dossier

## Scope

<!-- koios:managed:scope:begin -->
A proposed literature note; not scientific validation evidence.
<!-- koios:managed:scope:end -->

## Reading notes

`,
    diff: [
      { kind: "HUNK", text: "@@ -0,0 +1,14 @@" },
      { kind: "ADDED", text: "+---" },
      { kind: "ADDED", text: '+status: "draft"' },
      { kind: "ADDED", text: '+campaign: "piab1d"' },
      { kind: "ADDED", text: "+# Particle in a box literature dossier" },
    ],
    conflict: null,
  },
  {
    proposalId: "staleManagedNote",
    title: "Stale managed-note proposal",
    citekey: "staleManagedNote",
    relativePath: "notes/research/staleManagedNote.md",
    changeKind: "CONFLICT",
    proposedSha256: "6de69ec69ef56f9cd8acba765f738eac071a88b9a923535c2d4962b1e52648df",
    expectedContentSha256:
      "d10ef08dbd12eb0f6a91c56912661992a1bb3047d1cb33e576490c11906d4cb4",
    frontmatterText: 'status: "draft"',
    managedSections: [],
    proposedText: "",
    diff: [],
    conflict:
      "The destination identity no longer matches the proposal precondition. Regenerate before review.",
  },
];

const changeLabels: Record<ChangeKind, string> = {
  CREATE: "New note",
  UPDATE: "Managed update",
  CONFLICT: "Conflict",
};

const dispositionLabels: Record<Disposition, string> = {
  READY_FOR_APPLY: "Ready for explicit apply",
  REVISION_REQUESTED: "Revision requested",
  HOLD: "On hold",
};

function NoteQueueItem({
  proposal,
  selected,
  disposition,
  onSelect,
}: {
  proposal: NoteProposal;
  selected: boolean;
  disposition: Disposition | undefined;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        className={`note-review-queue__item${selected ? " note-review-queue__item--selected" : ""}`}
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
      >
        <span
          className={`note-change-kind note-change-kind--${proposal.changeKind.toLowerCase()}`}
        >
          {changeLabels[proposal.changeKind]}
        </span>
        <strong>{proposal.title}</strong>
        <code>{proposal.relativePath}</code>
        <small>
          {proposal.conflict
            ? "Regeneration required"
            : disposition
              ? dispositionLabels[disposition]
              : "Awaiting review"}
        </small>
      </button>
    </li>
  );
}

function ProposedNote({ proposal }: { proposal: NoteProposal }) {
  return (
    <div className="note-preview" aria-label="Proposed note preview">
      <section className="note-preview__frontmatter">
        <span>Proposed frontmatter</span>
        <pre>{proposal.frontmatterText}</pre>
      </section>
      <article className="note-preview__document">
        <h2>{proposal.title}</h2>
        {proposal.managedSections.map((section) => (
          <section key={section.name}>
            <div className="note-preview__section-heading">
              <h3>{section.heading}</h3>
              <span>Machine-managed · {section.name}</span>
            </div>
            <p>{section.body}</p>
          </section>
        ))}
        <section className="note-preview__preserved">
          <div className="note-preview__section-heading">
            <h3>Human-owned content</h3>
            <span>Preserved by contract</span>
          </div>
          <p>
            Text outside paired machine-management markers remains unchanged by the
            proposed materializer operation.
          </p>
        </section>
      </article>
      <details className="note-preview__source">
        <summary>Show complete proposed Markdown</summary>
        <pre>{proposal.proposedText}</pre>
      </details>
    </div>
  );
}

function NoteDiff({ proposal }: { proposal: NoteProposal }) {
  return (
    <div className="note-diff" aria-label="Proposed note diff">
      <div className="note-diff__legend" aria-label="Diff legend">
        <span className="note-diff__legend-added">Added</span>
        <span className="note-diff__legend-removed">Removed</span>
        <span>Context</span>
      </div>
      <pre>
        {proposal.diff.map((line, index) => (
          <span
            className={`note-diff__line note-diff__line--${line.kind.toLowerCase()}`}
            key={`${line.kind}-${index}`}
          >
            {line.text}
          </span>
        ))}
      </pre>
    </div>
  );
}

function ReviewDetail({
  proposal,
  disposition,
  onDisposition,
}: {
  proposal: NoteProposal;
  disposition: Disposition | undefined;
  onDisposition: (disposition: Disposition) => void;
}) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("proposed");
  const [reviewNote, setReviewNote] = useState("");

  return (
    <main className="note-review-detail">
      <header className="note-review-detail__header">
        <div>
          <div className="note-review-detail__badges">
            <span
              className={`note-change-kind note-change-kind--${proposal.changeKind.toLowerCase()}`}
            >
              {changeLabels[proposal.changeKind]}
            </span>
            <span>
              {disposition ? dispositionLabels[disposition] : "Awaiting review"}
            </span>
          </div>
          <h2>{proposal.title}</h2>
          <code>{proposal.relativePath}</code>
        </div>
        <div
          className="note-review-detail__tabs"
          role="group"
          aria-label="Preview mode"
        >
          <button
            type="button"
            aria-pressed={previewMode === "proposed"}
            onClick={() => setPreviewMode("proposed")}
          >
            Proposed note
          </button>
          <button
            type="button"
            aria-pressed={previewMode === "diff"}
            onClick={() => setPreviewMode("diff")}
          >
            Managed diff
          </button>
        </div>
      </header>

      <section className="note-review-provenance" aria-label="Proposal provenance">
        <dl>
          <div>
            <dt>Citekey</dt>
            <dd>{proposal.citekey}</dd>
          </div>
          <div>
            <dt>Batch identity</dt>
            <dd>
              <code>{batchSha256}</code>
            </dd>
          </div>
          <div>
            <dt>Proposal identity</dt>
            <dd>
              <code>{proposal.proposedSha256}</code>
            </dd>
          </div>
          <div>
            <dt>Precondition</dt>
            <dd>
              {proposal.expectedContentSha256 ? (
                <code>{proposal.expectedContentSha256}</code>
              ) : (
                "New destination"
              )}
            </dd>
          </div>
        </dl>
      </section>

      {proposal.conflict ? (
        <section className="note-review-conflict" role="alert">
          <strong>Proposal cannot be approved</strong>
          <p>{proposal.conflict}</p>
        </section>
      ) : previewMode === "proposed" ? (
        <ProposedNote proposal={proposal} />
      ) : (
        <NoteDiff proposal={proposal} />
      )}

      <section
        className="note-review-disposition"
        aria-labelledby="note-review-disposition-title"
      >
        <div>
          <p className="eyebrow">Prototype disposition</p>
          <h3 id="note-review-disposition-title">Record review intent</h3>
          <p>This browser-local fixture does not persist, apply, or write the note.</p>
        </div>
        <label>
          <span>Reviewer note</span>
          <textarea
            rows={3}
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            placeholder="Explain a requested revision or reason for holding the note."
          />
        </label>
        <div className="note-review-disposition__actions">
          <button
            className="button button--primary"
            type="button"
            disabled={proposal.conflict !== null}
            onClick={() => onDisposition("READY_FOR_APPLY")}
          >
            Mark ready for future apply
          </button>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => onDisposition("REVISION_REQUESTED")}
          >
            Request revision
          </button>
          <button
            className="button button--secondary"
            type="button"
            onClick={() => onDisposition("HOLD")}
          >
            Hold
          </button>
        </div>
        <div className="note-review-disposition__status" aria-live="polite">
          <p>
            Current browser-local disposition:{" "}
            {disposition ? dispositionLabels[disposition] : "Awaiting review"}.
          </p>
        </div>
      </section>
    </main>
  );
}

export function NoteReviewPage() {
  const [selectedId, setSelectedId] = useState(proposals[0].proposalId);
  const [dispositions, setDispositions] = useState<
    Readonly<Record<string, Disposition>>
  >({});
  const selectedProposal =
    proposals.find((proposal) => proposal.proposalId === selectedId) ?? proposals[0];

  function recordDisposition(disposition: Disposition) {
    setDispositions((current) => ({
      ...current,
      [selectedProposal.proposalId]: disposition,
    }));
  }

  return (
    <div className="control-dashboard note-review-page">
      <header className="control-heading">
        <div>
          <p className="eyebrow">Private workspace · Fixture-backed prototype</p>
          <h1>Note review</h1>
          <p>
            Inspect a proposed note before any materializer apply step. Compare
            generated sections, provenance, and preserved human-owned content.
          </p>
        </div>
        <div className="operator-card" aria-label="Review boundary">
          <span className="operator-card__status">Prototype only</span>
          <strong>No write capability</strong>
          <p>No service, persistence, or materializer apply operation is connected.</p>
        </div>
      </header>

      <section className="control-notice" aria-label="Note review safety boundary">
        <strong>Review remains separate from apply.</strong>
        <span>
          These synthetic records demonstrate the interface only. They are not a note
          catalog or an authorization to mutate a vault.
        </span>
      </section>

      <section className="note-review-metrics" aria-label="Review queue summary">
        <article>
          <span>Proposed notes</span>
          <strong>{proposals.length}</strong>
        </article>
        <article>
          <span>Updates</span>
          <strong>
            {proposals.filter((item) => item.changeKind === "UPDATE").length}
          </strong>
        </article>
        <article>
          <span>New notes</span>
          <strong>
            {proposals.filter((item) => item.changeKind === "CREATE").length}
          </strong>
        </article>
        <article>
          <span>Conflicts</span>
          <strong>
            {proposals.filter((item) => item.changeKind === "CONFLICT").length}
          </strong>
        </article>
      </section>

      <div className="note-review-workspace">
        <aside className="note-review-queue" aria-labelledby="note-review-queue-title">
          <div>
            <p className="eyebrow">Synthetic materialization batch</p>
            <h2 id="note-review-queue-title">Proposed notes</h2>
            <span>{proposals.length} fixture records</span>
          </div>
          <ol>
            {proposals.map((proposal) => (
              <NoteQueueItem
                key={proposal.proposalId}
                proposal={proposal}
                selected={proposal.proposalId === selectedProposal.proposalId}
                disposition={dispositions[proposal.proposalId]}
                onSelect={() => setSelectedId(proposal.proposalId)}
              />
            ))}
          </ol>
        </aside>

        <ReviewDetail
          key={selectedProposal.proposalId}
          proposal={selectedProposal}
          disposition={dispositions[selectedProposal.proposalId]}
          onDisposition={recordDisposition}
        />
      </div>
    </div>
  );
}
