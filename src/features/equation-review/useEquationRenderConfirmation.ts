import { useState } from "react";
import type { EquationDisplayMode } from "../../api/client";
import {
  EQUATION_RENDERER_ID,
  EQUATION_RENDERER_VERSION,
  renderEquationWithKatex,
  sha256Text,
  type RenderedEquationPreview,
} from "./equationRendering";

export function useEquationRenderConfirmation({
  reviewerLatex,
  obsidianMarkdown,
  displayMode,
}: {
  reviewerLatex: string;
  obsidianMarkdown: string;
  displayMode: EquationDisplayMode;
}) {
  const [rendered, setRendered] = useState<RenderedEquationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  const isCurrent = Boolean(
    rendered &&
    rendered.reviewerLatex === reviewerLatex &&
    rendered.obsidianMarkdown === obsidianMarkdown,
  );

  function invalidate() {
    setRendered(null);
    setError(null);
  }

  function reject(message: string) {
    setRendered(null);
    setError(message);
  }

  async function renderCurrent() {
    setIsRendering(true);
    setRendered(null);
    setError(null);
    const latexAtRender = reviewerLatex;
    const markdownAtRender = obsidianMarkdown;
    const modeAtRender = displayMode;
    const latexPreview = renderEquationWithKatex(latexAtRender, modeAtRender);
    const markdownPreview = renderEquationWithKatex(latexAtRender, modeAtRender);

    if (!latexPreview.html || !markdownPreview.html) {
      setError(latexPreview.error ?? markdownPreview.error);
      setIsRendering(false);
      return;
    }

    try {
      const [latexHash, markdownHash] = await Promise.all([
        sha256Text(latexAtRender),
        sha256Text(markdownAtRender),
      ]);
      setRendered({
        reviewerLatex: latexAtRender,
        obsidianMarkdown: markdownAtRender,
        latexHtml: latexPreview.html,
        markdownHtml: markdownPreview.html,
        confirmation: {
          renderer_id: EQUATION_RENDERER_ID,
          renderer_version: EQUATION_RENDERER_VERSION,
          rendered_reviewer_latex_sha256: latexHash,
          rendered_obsidian_markdown_sha256: markdownHash,
        },
      });
    } catch (renderError) {
      setError(
        renderError instanceof Error
          ? renderError.message
          : "Rendering confirmation failed.",
      );
    } finally {
      setIsRendering(false);
    }
  }

  return {
    rendered,
    error,
    isRendering,
    isCurrent,
    invalidate,
    reject,
    renderCurrent,
  };
}
