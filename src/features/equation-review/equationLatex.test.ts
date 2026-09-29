import { describe, expect, test } from "vitest";
import { deriveProposalLatexBody } from "./equationLatex";

const realProposal =
  "$\\psi_{n\\mathbf{k}}(\\mathbf{r}) = u_{n\\mathbf{k}}(\\mathbf{r})\\mathrm{e}^{i\\mathbf{k}\\cdot\\mathbf{r}},$";
const realBody =
  "\\psi_{n\\mathbf{k}}(\\mathbf{r}) = u_{n\\mathbf{k}}(\\mathbf{r})\\mathrm{e}^{i\\mathbf{k}\\cdot\\mathbf{r}},";

describe("deriveProposalLatexBody", () => {
  test("strips exactly one complete inline pair from the real immutable proposal", () => {
    expect(deriveProposalLatexBody(realProposal)).toEqual({
      ok: true,
      body: realBody,
      status: "STRIPPED_INLINE_DELIMITERS",
      reason: null,
    });
  });

  test.each([
    ["E = mc^2", "UNWRAPPED_EXACT", "E = mc^2"],
    ["$$E = mc^2$$", "STRIPPED_DISPLAY_DELIMITERS", "E = mc^2"],
    ["$$\nE = mc^2\n$$", "STRIPPED_DISPLAY_DELIMITERS", "E = mc^2"],
    ["E = \\$5", "UNWRAPPED_EXACT", "E = \\$5"],
  ])("derives canonical source %s without normalization", (raw, status, body) => {
    expect(deriveProposalLatexBody(raw)).toEqual({
      ok: true,
      body,
      status,
      reason: null,
    });
  });

  test.each([
    ["$E = mc^2", "UNMATCHED_DELIMITER"],
    ["E = mc^2$", "UNMATCHED_DELIMITER"],
    ["$E = mc^2$$", "MIXED_DELIMITERS"],
    ["$$E = mc^2$", "MIXED_DELIMITERS"],
    ["$$$E = mc^2$$$", "NESTED_OR_INTERNAL_DELIMITER"],
    ["$", "EMPTY"],
    ["$$$$", "EMPTY"],
    [" E = mc^2", "EDGE_WHITESPACE"],
    ["$E = mc^2 $", "EDGE_WHITESPACE"],
    ["$$\nE = mc^2$$", "NONCANONICAL_DISPLAY_NEWLINE"],
    ["E\r= mc^2", "CARRIAGE_RETURN"],
    ["e\u0301 = 1", "NON_NFC"],
    ["E $ mc^2", "NESTED_OR_INTERNAL_DELIMITER"],
  ])("rejects noncanonical source %j", (raw, reason) => {
    expect(deriveProposalLatexBody(raw)).toEqual({
      ok: false,
      body: null,
      status: "INVALID",
      reason,
    });
  });
});
