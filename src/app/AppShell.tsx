import { NavLink, Outlet } from "react-router-dom";

import { HealthIndicator } from "../components/HealthIndicator";
import type { DeploymentProfile } from "./deploymentProfile";

export function AppShell({ profile }: { profile: DeploymentProfile }) {
  const isControl = profile === "control";

  return (
    <div className={`app-shell app-shell--${profile}`}>
      <header className="topbar">
        <NavLink className="brand" to="/" aria-label="Project Koios home">
          <span className="brand__mark" aria-hidden="true">
            K
          </span>
          <span>
            <strong>Project Koios</strong>
            <small>
              {isControl ? "Private control workspace" : "Published knowledge"}
            </small>
          </span>
        </NavLink>

        <nav className="primary-nav" aria-label="Primary navigation">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/projects">Projects</NavLink>
          <NavLink to="/publications">Publications</NavLink>
          {isControl ? <NavLink to="/control">Control center</NavLink> : null}
        </nav>

        {isControl ? (
          <HealthIndicator />
        ) : (
          <span className="profile-indicator">Public</span>
        )}
      </header>

      <main className="page-shell">
        <Outlet />
      </main>
    </div>
  );
}
