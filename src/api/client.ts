import type { components, paths } from "./schema.generated";

type GeneratedHealthResponse =
  paths["/health"]["get"]["responses"][200]["content"]["application/json"];

export type HealthResponse = GeneratedHealthResponse & {
  status: string;
};

export type PublicationCatalog = components["schemas"]["PublicationCatalog"];
export type PublicationRecord = components["schemas"]["PublicationRecord"];
export type SearchRequest = components["schemas"]["SearchRequest"];
export type SearchResult = components["schemas"]["SearchResult"];
export type CitationDecisionDisposition =
  components["schemas"]["CitationDecisionDisposition"];
export type CitationDecisionRequest = components["schemas"]["CitationDecisionRequest"];
export type CitationDecisionResponse =
  components["schemas"]["CitationDecisionResponse"];
export type CitationReviewDetail =
  components["schemas"]["CitationReviewDetailResponse"];
export type CitationReviewQueue = components["schemas"]["CitationReviewQueueResponse"];
export type LiteratureReviewProgress =
  components["schemas"]["LiteratureReviewProgressResponse"];
export type ProvidedReference = components["schemas"]["ProvidedReferenceResponse"];
export type ProvidedReferenceList =
  components["schemas"]["ProvidedReferenceListResponse"];

export interface ProvideReferenceRequest {
  claimId: string;
  citationLabel: string;
  doiOrUrl: string;
  note: string;
  file: File;
}

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

  async publications(signal?: AbortSignal): Promise<PublicationCatalog> {
    return this.request<PublicationCatalog>("/api/publications", { signal });
  }

  async search(request: SearchRequest, signal?: AbortSignal): Promise<SearchResult[]> {
    return this.request<SearchResult[]>("/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  }

  async citationReviews(signal?: AbortSignal): Promise<CitationReviewQueue> {
    return this.request<CitationReviewQueue>("/citation-reviews", { signal });
  }

  async literatureReviewProgress(
    signal?: AbortSignal,
  ): Promise<LiteratureReviewProgress> {
    return this.request<LiteratureReviewProgress>("/literature-review/progress", {
      signal,
    });
  }

  async providedLiteratureReferences(
    signal?: AbortSignal,
  ): Promise<ProvidedReferenceList> {
    return this.request<ProvidedReferenceList>("/literature-review/references", {
      signal,
    });
  }

  async provideLiteratureReference(
    request: ProvideReferenceRequest,
    signal?: AbortSignal,
  ): Promise<ProvidedReference> {
    const body = new FormData();
    body.set("claim_id", request.claimId);
    body.set("citation_label", request.citationLabel);
    body.set("note", request.note);
    body.set("reference_pdf", request.file);
    if (request.doiOrUrl.trim()) {
      body.set("doi_or_url", request.doiOrUrl.trim());
    }
    return this.request<ProvidedReference>("/literature-review/references", {
      method: "POST",
      body,
      signal,
    });
  }

  async citationReview(
    claimId: string,
    signal?: AbortSignal,
  ): Promise<CitationReviewDetail> {
    return this.request<CitationReviewDetail>(
      `/citation-reviews/${encodeURIComponent(claimId)}`,
      { signal },
    );
  }

  async saveCitationDecision(
    claimId: string,
    request: CitationDecisionRequest,
    signal?: AbortSignal,
  ): Promise<CitationDecisionResponse> {
    return this.request<CitationDecisionResponse>(
      `/citation-reviews/${encodeURIComponent(claimId)}/decision`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal,
      },
    );
  }

  citationSourceUrl(file: string, physicalPage: number): string {
    const path = `/citation-reviews/sources/${encodeURIComponent(file)}`;
    return `${this.baseUrl}${path}#page=${physicalPage}`;
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
