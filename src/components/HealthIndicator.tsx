import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../api/client";

export function HealthIndicator() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => apiClient.health(signal),
    refetchInterval: 30_000,
  });

  const state = health.isPending
    ? "checking"
    : health.isError
      ? "offline"
      : health.data.status;

  return (
    <div className={`health-indicator health-indicator--${state}`}>
      <span className="health-indicator__dot" aria-hidden="true" />
      <span>API {state}</span>
    </div>
  );
}
