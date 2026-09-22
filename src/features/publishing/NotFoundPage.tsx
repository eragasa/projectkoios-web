import { Link } from "react-router-dom";

import { usePageMetadata } from "../../app/usePageMetadata";

export function NotFoundPage() {
  usePageMetadata(
    "Page not found",
    "The requested Project Koios page is not available in this deployment.",
  );

  return (
    <div className="empty-state not-found-page">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The requested Project Koios page is not available in this deployment.</p>
      <Link className="button button--primary" to="/">
        Return home
      </Link>
    </div>
  );
}
