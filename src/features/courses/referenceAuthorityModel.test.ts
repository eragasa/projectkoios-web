import { ApiError } from "../../api/client";
import { courseReferenceError, isFreshnessFailure } from "./referenceAuthorityModel";

test.each([
  ["EVIDENCE_STALE", "The evidence changed"],
  ["REVISION_STALE", "A newer item revision exists"],
  ["TARGET_STALE", "The selected authority target changed"],
  ["CONCURRENT_DECISION", "A concurrent decision won"],
  ["IDEMPOTENCY_CONFLICT", "The decision key conflicts"],
] as const)("maps %s without exposing raw owner detail", (code, expected) => {
  const error = new ApiError(409, "private owner detail", code);

  expect(courseReferenceError(error, "decision")).toContain(expected);
  expect(courseReferenceError(error, "decision")).not.toContain("private owner detail");
  expect(isFreshnessFailure(error)).toBe(true);
});

test("invalidates a preview after every unrecognized HTTP 409", () => {
  expect(isFreshnessFailure(new ApiError(409, "conflict"))).toBe(true);
});

test("keeps an unavailable-owner transport intent retryable", () => {
  const error = new ApiError(503, "private owner detail", "OWNER_UNAVAILABLE");

  expect(isFreshnessFailure(error)).toBe(false);
  expect(courseReferenceError(error, "decision")).toBe(
    "The References owner is currently unavailable.",
  );
});
