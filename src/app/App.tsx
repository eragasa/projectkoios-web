import { Route, Routes } from "react-router-dom";

import { CitationReviewPage } from "../features/citation-review/CitationReviewPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { LiteratureReviewPage } from "../features/literature-review/LiteratureReviewPage";
import { SearchPage } from "../features/search/SearchPage";
import { AppShell } from "./AppShell";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="citation-review" element={<CitationReviewPage />} />
        <Route path="literature-review" element={<LiteratureReviewPage />} />
      </Route>
    </Routes>
  );
}
