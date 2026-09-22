export type DeploymentProfile = "public" | "control";

export function parseDeploymentProfile(value: string | undefined): DeploymentProfile {
  if (value === undefined || value === "") {
    return "public";
  }
  if (value === "public" || value === "control") {
    return value;
  }
  throw new Error(
    `VITE_KOIOS_DEPLOYMENT_PROFILE must be "public" or "control", received ${JSON.stringify(value)}`,
  );
}

export const deploymentProfile = parseDeploymentProfile(
  import.meta.env.VITE_KOIOS_DEPLOYMENT_PROFILE,
);
