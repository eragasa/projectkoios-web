import { Route, Routes } from "react-router-dom";

import { DashboardPage } from "../features/dashboard/DashboardPage";
import { SearchPage } from "../features/search/SearchPage";
import { AppShell } from "./AppShell";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="search" element={<SearchPage />} />
      </Route>
    </Routes>
  );
}
