import "katex/dist/katex.min.css";

/** Render only markup produced locally by KaTeX with trust disabled. */
export function KatexMarkup({
  html,
  label,
  className,
  as: Element = "div",
}: {
  html: string;
  label?: string;
  className?: string;
  as?: "div" | "span";
}) {
  return (
    <Element
      aria-label={label}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
