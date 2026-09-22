import { Route, Routes } from "react-router-dom";

import { CitationReviewPage } from "../features/citation-review/CitationReviewPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { GitHubTasksPage } from "../features/github-tasks/GitHubTasksPage";
import { LiteratureReviewPage } from "../features/literature-review/LiteratureReviewPage";
import { NotFoundPage } from "../features/publishing/NotFoundPage";
import { PublicHomePage } from "../features/publishing/PublicHomePage";
import { ProjectsPage } from "../features/publishing/ProjectsPage";
import { PublicationsPage } from "../features/publishing/PublicationsPage";
import { SearchPage } from "../features/search/SearchPage";
import { AppShell } from "./AppShell";
import { deploymentProfile, type DeploymentProfile } from "./deploymentProfile";

export function App({ profile = deploymentProfile }: { profile?: DeploymentProfile }) {
  const isControl = profile === "control";

  return (
    <Routes>
      <Route element={<AppShell profile={profile} />}>
        <Route index element={<PublicHomePage />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="publications" element={<PublicationsPage />} />
        {isControl ? (
          <>
            <Route path="control" element={<DashboardPage />} />
            <Route path="control/github" element={<GitHubTasksPage />} />
            <Route path="control/search" element={<SearchPage />} />
            <Route path="control/citation-review" element={<CitationReviewPage />} />
            <Route
              path="control/literature-review"
              element={<LiteratureReviewPage />}
            />
          </>
        ) : null}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
