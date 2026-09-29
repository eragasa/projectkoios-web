import type { ReactNode } from "react";

export function ReviewPageHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="review-page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {aside}
    </header>
  );
}

export function ReviewProgress({
  ariaLabel,
  current,
  total,
  summary,
  separator = "/",
}: {
  ariaLabel: string;
  current: number;
  total: number;
  summary: string;
  separator?: string;
}) {
  return (
    <div className="review-progress" aria-label={ariaLabel}>
      <strong>
        {current}
        {separator}
        {total}
      </strong>
      <span>{summary}</span>
      <progress max={total || 1} value={current} />
    </div>
  );
}
