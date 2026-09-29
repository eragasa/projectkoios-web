import katex from "katex";
import type {
  EquationDisplayMode,
  EquationReviewDecisionRequest,
} from "../../api/client";

export const EQUATION_RENDERER_ID = "katex";
export const EQUATION_RENDERER_VERSION = "0.16.47";

export type RenderedEquationPreview = {
  reviewerLatex: string;
  obsidianMarkdown: string;
  latexHtml: string;
  markdownHtml: string;
  confirmation: NonNullable<EquationReviewDecisionRequest["render_confirmation"]>;
};

export type EquationRenderResult =
  { html: string; error: null } | { html: null; error: string };

export function canonicalObsidianMarkdown(
  latex: string,
  displayMode: EquationDisplayMode,
) {
  return displayMode === "DISPLAY" ? `$$\n${latex}\n$$` : `$${latex}$`;
}

export function renderEquationWithKatex(
  latex: string,
  displayMode: EquationDisplayMode,
): EquationRenderResult {
  try {
    return {
      html: katex.renderToString(latex, {
        displayMode: displayMode === "DISPLAY",
        output: "htmlAndMathml",
        strict: "error",
        throwOnError: true,
        trust: false,
      }),
      error: null,
    };
  } catch (error) {
    return {
      html: null,
      error:
        error instanceof Error
          ? `KaTeX could not render this source: ${error.message}`
          : "KaTeX could not render this source.",
    };
  }
}

export async function sha256Text(value: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error(
      "Secure browser hashing is unavailable; this correction cannot be accepted.",
    );
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
