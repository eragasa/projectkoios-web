import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { apiClient, type PublicCourseInstitution } from "../../api/client";
import { usePageMetadata } from "../../app/usePageMetadata";

function statusLabel(status: string): string {
  if (status === "review-candidate") return "Review candidate";
  if (status === "published") return "Published materials";
  return "Inventory only";
}

export function CoursesPage() {
  usePageMetadata(
    "Courses",
    "A public-safe inventory of identified Project Koios course collections and their review status.",
  );
  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: ({ signal }) => apiClient.courses(signal),
  });
  const [query, setQuery] = useState("");
  const [institutionId, setInstitutionId] = useState("all");

  const institutions = courses.data?.institutions ?? [];
  const allCourses = useMemo(
    () => institutions.flatMap((institution) => institution.courses),
    [institutions],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleInstitutions = useMemo(
    () =>
      institutions
        .filter(
          (institution) => institutionId === "all" || institution.id === institutionId,
        )
        .map((institution) => ({
          ...institution,
          courses: institution.courses.filter((course) => {
            if (!normalizedQuery) return true;
            return [course.code, course.title ?? "", institution.name]
              .join(" ")
              .toLocaleLowerCase()
              .includes(normalizedQuery);
          }),
        }))
        .filter((institution) => institution.courses.length > 0),
    [institutionId, institutions, normalizedQuery],
  );
  const reviewCandidateCount = allCourses.filter(
    (course) => course.materials_status === "review-candidate",
  ).length;
  const publishedCount = allCourses.filter(
    (course) => course.materials_status === "published",
  ).length;

  return (
    <div className="courses-page">
      <header className="section-heading courses-heading">
        <div>
          <p className="eyebrow">Public-safe inventory</p>
          <h1>Courses</h1>
          <p>
            Identified teaching and coursework collections, shown without exposing
            private records, student work, or unreviewed third-party material.
          </p>
        </div>
        {courses.data && allCourses.length > 0 ? (
          <dl className="course-counts" aria-label="Course catalog summary">
            <div>
              <dt>Identified</dt>
              <dd>{allCourses.length}</dd>
            </div>
            <div>
              <dt>Review candidates</dt>
              <dd>{reviewCandidateCount}</dd>
            </div>
            <div>
              <dt>Published materials</dt>
              <dd>{publishedCount}</dd>
            </div>
          </dl>
        ) : null}
      </header>

      {courses.isPending ? (
        <div className="publication-status" role="status">
          Loading courses…
        </div>
      ) : null}

      {courses.isError ? (
        <div className="empty-state" role="alert">
          <h2>Course catalog unavailable</h2>
          <p>The public-safe course inventory could not be loaded.</p>
        </div>
      ) : null}

      {courses.data && allCourses.length === 0 ? (
        <div className="empty-state">
          <h2>No public course metadata yet</h2>
          <p>Private course sources are never inferred as public records.</p>
        </div>
      ) : null}

      {courses.data && allCourses.length > 0 ? (
        <>
          <section className="course-boundary" aria-labelledby="course-boundary-title">
            <div>
              <p className="eyebrow">Publication boundary</p>
              <h2 id="course-boundary-title">Identity is public. Materials are not.</h2>
            </div>
            <ul>
              {(courses.data.publication_boundary ?? []).map((boundary) => (
                <li key={boundary}>{boundary}</li>
              ))}
            </ul>
          </section>

          <section className="course-tools" aria-label="Filter courses">
            <label>
              <span>Search courses</span>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Code, title, or institution"
                type="search"
                value={query}
              />
            </label>
            <label>
              <span>Institution</span>
              <select
                onChange={(event) => setInstitutionId(event.target.value)}
                value={institutionId}
              >
                <option value="all">All institutions</option>
                {institutions.map((institution) => (
                  <option key={institution.id} value={institution.id}>
                    {institution.name}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <div className="course-institution-list">
            {visibleInstitutions.map((institution) => (
              <CourseInstitution institution={institution} key={institution.id} />
            ))}
          </div>

          {visibleInstitutions.length === 0 ? (
            <div className="empty-state" role="status">
              <h2>No matching courses</h2>
              <p>Change the search text or institution filter.</p>
            </div>
          ) : null}

          <footer className="course-catalog-footer">
            <div>
              <p className="eyebrow">Source and freshness</p>
              <p>
                Catalog reviewed {courses.data.reviewed_on ?? "date unavailable"}.
                Status describes migration and review only.
              </p>
            </div>
            {courses.data.source ? (
              <a href={courses.data.source.url} rel="noreferrer">
                Inspect the source inventory ↗
              </a>
            ) : null}
          </footer>

          {(courses.data.unresolved_collections ?? []).length > 0 ? (
            <section className="unresolved-course-groups">
              <p className="eyebrow">Not yet assigned to a course</p>
              <ul>
                {(courses.data.unresolved_collections ?? []).map((collection) => (
                  <li key={collection}>{collection}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function CourseInstitution({ institution }: { institution: PublicCourseInstitution }) {
  return (
    <section className="course-institution" aria-labelledby={`${institution.id}-title`}>
      <header>
        <p className="eyebrow">Institution</p>
        <h2 id={`${institution.id}-title`}>{institution.name}</h2>
        <span>{institution.courses.length} identified</span>
      </header>
      <div className="course-grid">
        {institution.courses.map((course) => (
          <article className="course-card" key={course.id}>
            <div>
              <code>{course.code}</code>
              <span
                className={`course-status course-status--${course.materials_status}`}
              >
                {statusLabel(course.materials_status)}
              </span>
            </div>
            <h3>{course.title ?? `Course ${course.code}`}</h3>
            <p>
              {course.materials_status === "review-candidate"
                ? "A default-deny sanitized candidate awaits manual ownership, rights, and content review."
                : course.materials_status === "published"
                  ? "Reviewed public materials are available for this course."
                  : "The source collection is identified; no materials are approved for public access."}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
