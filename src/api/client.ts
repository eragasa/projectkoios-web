import type { components, paths } from "./schema.generated";

type GeneratedHealthResponse =
  paths["/health"]["get"]["responses"][200]["content"]["application/json"];

export type HealthResponse = GeneratedHealthResponse & {
  status: string;
};

export type SearchRequest = components["schemas"]["SearchRequest"];
export type SearchResult = components["schemas"]["SearchResult"];

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class ProjectKoiosApiClient {
  readonly baseUrl: string;

  constructor(baseUrl = "") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async health(signal?: AbortSignal): Promise<HealthResponse> {
    return this.request<HealthResponse>("/health", { signal });
  }

  async search(request: SearchRequest, signal?: AbortSignal): Promise<SearchResult[]> {
    return this.request<SearchResult[]>("/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, init);
    if (!response.ok) {
      let message = `Project Koios API returned ${response.status}`;
      try {
        const body = (await response.json()) as { detail?: unknown };
        if (typeof body.detail === "string") {
          message = body.detail;
        }
      } catch {
        // The status code remains sufficient when the body is not JSON.
      }
      throw new ApiError(response.status, message);
    }
    return (await response.json()) as T;
  }
}

const configuredBaseUrl = import.meta.env.VITE_KOIOS_API_BASE_URL as string | undefined;

export const apiClient = new ProjectKoiosApiClient(configuredBaseUrl ?? "");
