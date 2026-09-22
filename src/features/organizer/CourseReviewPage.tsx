import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import {
  apiClient,
  type OrganizerProposal,
  type PublicCourseRecord,
} from "../../api/client";
import { usePageMetadata } from "../../app/usePageMetadata";

type CourseCandidate = {
  course: PublicCourseRecord;
  institution: string;
  proposals: OrganizerProposal[];
};

function containsCourseCode(value: string, courseCode: string): boolean {
  const escaped = courseCode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`, "i").test(value);
}

function proposalsForCourse(
  proposals: OrganizerProposal[],
  courseCode: string,
): OrganizerProposal[] {
  return proposals.filter((proposal) =>
    containsCourseCode(
      `${proposal.relative_path} ${proposal.suggested_group}`,
      courseCode,
    ),
  );
}

export function CourseReviewPage() {
  usePageMetadata(
    "Course review",
    "Private local review of organization-agent teaching proposals against the Project Koios course inventory.",
  );
  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: ({ signal }) => apiClient.courses(signal),
  });
  const organizerStatus = useQuery({
    queryKey: ["organizer", "status"],
    queryFn: ({ signal }) => apiClient.organizerStatus(signal),
  });
  const teaching = useQuery({
    queryKey: ["organizer", "proposals", "teaching"],
    queryFn: ({ signal }) => apiClient.organizerProposals("teaching", 500, signal),
  });

  const proposals = teaching.data?.proposals ?? [];
  const courseCandidates: CourseCandidate[] = (courses.data?.institutions ?? [])
    .flatMap((institution) =>
      institution.courses.map((course) => ({
        course,
        institution: institution.name,
        proposals: proposalsForCourse(proposals, course.code),
      })),
    )
    .filter(
      (candidate) =>
        candidate.proposals.length > 0 ||
        candidate.course.materials_status === "review-candidate",
    );
  const matchedProposalIds = new Set(
    courseCandidates.flatMap((candidate) =>
      candidate.proposals.map((proposal) => proposal.file_id),
    ),
  );
  const unmatched = proposals.filter(
    (proposal) => !matchedProposalIds.has(proposal.file_id),
  );
  const identifiedCourses = (courses.data?.institutions ?? []).reduce(
    (total, institution) => total + institution.courses.length,
    0,
  );

  return (
    <div className="course-review-page">
      <header className="control-heading">
        <div>
          <p className="eyebrow">Private local review · Organizer projection</p>
          <h1>Course review</h1>
          <p>
            Start from metadata-only teaching proposals produced by the organization
            agent, then compare path-matched candidates with the reviewed course
            inventory. No course identity or publication decision is inferred.
          </p>
        </div>
        <div className="operator-card" aria-live="polite">
          <span className="operator-card__status">
            {organizerStatus.data?.activity ?? "unavailable"}
          </span>
          <strong>
            Organizer {organizerStatus.data?.desired_mode ?? "status unknown"}
          </strong>
          <p>
            {organizerStatus.data
              ? `${organizerStatus.data.proposed_files.toLocaleString()} total metadata proposals`
              : "The organizer status could not be read."}
          </p>
        </div>
      </header>

      <section className="control-notice" aria-label="Course review boundary">
        <strong>Candidate evidence, not course authority.</strong>
        <span>
          Matching uses course-code tokens in private relative paths and agent-suggested
          groups. It does not publish files, inspect payload bytes, establish ownership,
          or approve course materials.
        </span>
      </section>

      <nav className="course-review-links" aria-label="Course review navigation">
        <Link to="/control/organizer">Inspect organization agent →</Link>
        <Link to="/courses">Inspect public-safe inventory →</Link>
        {courses.data?.source ? (
          <a href={courses.data.source.url} rel="noreferrer">
            Inventory evidence · {courses.data.source.revision.slice(0, 12)} ↗
          </a>
        ) : null}
        <button
          disabled={
            courses.isFetching || organizerStatus.isFetching || teaching.isFetching
          }
          onClick={() => {
            void courses.refetch();
            void organizerStatus.refetch();
            void teaching.refetch();
          }}
          type="button"
        >
          Refresh review evidence
        </button>
      </nav>

      <section className="organizer-metrics" aria-label="Course review summary">
        <Metric label="Identified courses" value={identifiedCourses} />
        <Metric label="Teaching proposals" value={teaching.data?.total ?? 0} />
        <Metric label="Course-code matches" value={matchedProposalIds.size} />
        <Metric label="Unmatched proposals" value={unmatched.length} />
      </section>

      {courses.data && courses.data.publication_boundary.length > 0 ? (
        <section className="course-boundary">
          <div>
            <p className="eyebrow">Review blockers</p>
            <h2>Publication remains default-deny</h2>
          </div>
          <ul>
            {courses.data.publication_boundary.map((boundary) => (
              <li key={boundary}>{boundary}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {courses.isPending || teaching.isPending ? (
        <p role="status">Loading course and organizer projections…</p>
      ) : null}
      {courses.isError || teaching.isError ? (
        <div className="empty-state" role="alert">
          <h2>Course review projection unavailable</h2>
          <p>
            The course inventory and organization-agent proposals must both be available
            locally.
          </p>
        </div>
      ) : null}
      {teaching.data && !teaching.data.complete ? (
        <div className="control-notice" role="status">
          <strong>Bounded proposal view.</strong>
          <span>
            Showing the first {teaching.data.proposals.length} of {teaching.data.total}
            teaching proposals.
          </span>
        </div>
      ) : null}

      {courses.data && teaching.data ? (
        <section className="course-review-queue" aria-labelledby="course-review-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Human review queue</p>
              <h2 id="course-review-title">Course candidates</h2>
            </div>
            <span>{courseCandidates.length} courses requiring attention</span>
          </div>

          {courseCandidates.length === 0 ? (
            <div className="empty-state">
              <h3>No course candidates yet</h3>
              <p>
                Run the organization agent to generate teaching proposals, or continue
                reviewing the existing public-safe inventory.
              </p>
            </div>
          ) : (
            <div className="course-review-list">
              {courseCandidates.map((candidate) => (
                <CourseCandidateCard candidate={candidate} key={candidate.course.id} />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {unmatched.length > 0 ? (
        <section className="unmatched-teaching-proposals">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Unresolved teaching metadata</p>
              <h2>Unmatched proposals</h2>
            </div>
            <span>{unmatched.length} require course identity review</span>
          </div>
          <ProposalList proposals={unmatched} />
        </section>
      ) : null}

      {courses.data && courses.data.unresolved_collections.length > 0 ? (
        <section className="unresolved-course-groups">
          <p className="eyebrow">Unresolved source collections</p>
          <ul>
            {courses.data.unresolved_collections.map((collection) => (
              <li key={collection}>{collection}</li>
            ))}
          </ul>
          {courses.data.source ? (
            <a href={courses.data.source.url} rel="noreferrer">
              Inspect inventory evidence at revision{" "}
              {courses.data.source.revision.slice(0, 12)} ↗
            </a>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function CourseCandidateCard({ candidate }: { candidate: CourseCandidate }) {
  return (
    <article className="course-review-card">
      <header>
        <div>
          <code>{candidate.course.code}</code>
          <h3>{candidate.course.title ?? `Course ${candidate.course.code}`}</h3>
          <p>{candidate.institution}</p>
        </div>
        <span>{candidate.course.materials_status}</span>
      </header>
      <p className="course-review-card__boundary">
        Organizer matches are not sanitization audit counts. Retained and excluded
        totals remain under the explicit course policy and audit record.
      </p>
      {candidate.proposals.length > 0 ? (
        <ProposalList proposals={candidate.proposals} />
      ) : (
        <p className="course-review-card__empty">
          This catalog review candidate has no matching organizer proposal yet.
        </p>
      )}
    </article>
  );
}

function ProposalList({ proposals }: { proposals: OrganizerProposal[] }) {
  return (
    <ol className="course-proposal-list">
      {proposals.map((proposal) => (
        <li key={proposal.file_id}>
          <div>
            <strong>{proposal.suggested_group}</strong>
            <span>{Math.round(proposal.confidence * 100)}% confidence</span>
          </div>
          <code>{proposal.relative_path}</code>
          <p>{proposal.rationale}</p>
          <footer>
            <span>{proposal.availability.replace("_", " ")}</span>
            <span>{proposal.byte_size.toLocaleString()} bytes</span>
            <span>
              {proposal.model} · {proposal.model_digest.slice(0, 12)}
            </span>
            <time>{proposal.proposed_at}</time>
          </footer>
        </li>
      ))}
    </ol>
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
