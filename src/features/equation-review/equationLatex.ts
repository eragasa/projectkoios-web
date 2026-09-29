export type ProposalLatexDerivationStatus =
  "UNWRAPPED_EXACT" | "STRIPPED_INLINE_DELIMITERS" | "STRIPPED_DISPLAY_DELIMITERS";

export type ProposalLatexDerivationFailure =
  | "EMPTY"
  | "EDGE_WHITESPACE"
  | "CARRIAGE_RETURN"
  | "NON_NFC"
  | "MIXED_DELIMITERS"
  | "UNMATCHED_DELIMITER"
  | "NESTED_OR_INTERNAL_DELIMITER"
  | "NONCANONICAL_DISPLAY_NEWLINE";

export type ProposalLatexDerivation =
  | {
      ok: true;
      body: string;
      status: ProposalLatexDerivationStatus;
      reason: null;
    }
  | {
      ok: false;
      body: null;
      status: "INVALID";
      reason: ProposalLatexDerivationFailure;
    };

type Delimiter = "INLINE" | "DISPLAY" | null;

function isUnescapedDollar(value: string, index: number) {
  if (value[index] !== "$") {
    return false;
  }
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    backslashes += 1;
  }
  return backslashes % 2 === 0;
}

function openingDelimiter(value: string): Delimiter {
  if (!isUnescapedDollar(value, 0)) {
    return null;
  }
  return isUnescapedDollar(value, 1) ? "DISPLAY" : "INLINE";
}

function closingDelimiter(value: string): Delimiter {
  const last = value.length - 1;
  if (!isUnescapedDollar(value, last)) {
    return null;
  }
  return isUnescapedDollar(value, last - 1) ? "DISPLAY" : "INLINE";
}

function containsUnescapedDollar(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    if (isUnescapedDollar(value, index)) {
      return true;
    }
  }
  return false;
}

function invalid(reason: ProposalLatexDerivationFailure): ProposalLatexDerivation {
  return { ok: false, body: null, status: "INVALID", reason };
}

function validateBody(
  body: string,
  status: ProposalLatexDerivationStatus,
): ProposalLatexDerivation {
  if (!body) {
    return invalid("EMPTY");
  }
  if (body !== body.trim()) {
    return invalid("EDGE_WHITESPACE");
  }
  if (body.includes("\r")) {
    return invalid("CARRIAGE_RETURN");
  }
  if (body.normalize("NFC") !== body) {
    return invalid("NON_NFC");
  }
  if (containsUnescapedDollar(body)) {
    return invalid("NESTED_OR_INTERNAL_DELIMITER");
  }
  return { ok: true, body, status, reason: null };
}

/**
 * Derive a canonical reviewer math body without mutating the immutable proposal.
 * This intentionally recognizes only one complete outer delimiter pair and never
 * trims, normalizes, or repairs source text.
 */
export function deriveProposalLatexBody(raw: string): ProposalLatexDerivation {
  if (!raw) {
    return invalid("EMPTY");
  }
  if (raw !== raw.trim()) {
    return invalid("EDGE_WHITESPACE");
  }
  if (raw.includes("\r")) {
    return invalid("CARRIAGE_RETURN");
  }
  if (raw.normalize("NFC") !== raw) {
    return invalid("NON_NFC");
  }

  const opening = openingDelimiter(raw);
  const closing = closingDelimiter(raw);
  if (opening && closing && opening !== closing) {
    return invalid("MIXED_DELIMITERS");
  }
  if ((opening && !closing) || (!opening && closing)) {
    return invalid("UNMATCHED_DELIMITER");
  }
  if (!opening || !closing) {
    return validateBody(raw, "UNWRAPPED_EXACT");
  }

  if (opening === "INLINE") {
    return validateBody(raw.slice(1, -1), "STRIPPED_INLINE_DELIMITERS");
  }

  let body = raw.slice(2, -2);
  const leadingLineFeed = body.startsWith("\n");
  const trailingLineFeed = body.endsWith("\n");
  if (leadingLineFeed !== trailingLineFeed) {
    return invalid("NONCANONICAL_DISPLAY_NEWLINE");
  }
  if (leadingLineFeed && trailingLineFeed) {
    body = body.slice(1, -1);
  }
  return validateBody(body, "STRIPPED_DISPLAY_DELIMITERS");
}
