import { parseDeploymentProfile } from "./deploymentProfile";

test("defaults to the public profile", () => {
  expect(parseDeploymentProfile(undefined)).toBe("public");
  expect(parseDeploymentProfile("")).toBe("public");
});

test.each(["public", "control"] as const)("accepts the %s profile", (profile) => {
  expect(parseDeploymentProfile(profile)).toBe(profile);
});

test("rejects an unknown profile", () => {
  expect(() => parseDeploymentProfile("private")).toThrow(
    'VITE_KOIOS_DEPLOYMENT_PROFILE must be "public" or "control"',
  );
});
