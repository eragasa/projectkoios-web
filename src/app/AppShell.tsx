import { NavLink, Outlet } from "react-router-dom";

import { HealthIndicator } from "../components/HealthIndicator";

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/" aria-label="Project Koios home">
          <span className="brand__mark" aria-hidden="true">
            K
          </span>
          <span>
            <strong>Project Koios</strong>
            <small>Local knowledge workspace</small>
          </span>
        </NavLink>

        <nav className="primary-nav" aria-label="Primary navigation">
          <NavLink to="/" end>
            Overview
          </NavLink>
          <NavLink to="/search">Search</NavLink>
        </nav>

        <HealthIndicator />
      </header>

      <main className="page-shell">
        <Outlet />
      </main>
    </div>
  );
}
