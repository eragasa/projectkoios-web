import type { ReactNode } from "react";

export function DisclosurePanel({
  summary,
  className,
  children,
}: {
  summary: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <details className={className}>
      <summary>{summary}</summary>
      {children}
    </details>
  );
}

export function BoundedJsonView({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}
