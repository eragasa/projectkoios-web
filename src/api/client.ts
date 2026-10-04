import type { components, paths } from "./schema.generated";

type GeneratedHealthResponse =
  paths["/health"]["get"]["responses"][200]["content"]["application/json"];

export type HealthResponse = GeneratedHealthResponse & {
  status: string;
};

export type GitHubTaskDashboard = components["schemas"]["GitHubTaskDashboard"];
export type GitHubRepositoryTaskProjection =
  components["schemas"]["GitHubRepositoryTaskProjection"];
export type GitHubTaskSequence = components["schemas"]["GitHubTaskSequence"];
export type PublicCourseCatalog = components["schemas"]["PublicCourseCatalog"];
export type PublicCourseInstitution = components["schemas"]["PublicCourseInstitution"];
export type PublicCourseRecord = components["schemas"]["PublicCourseRecord"];
export type PublicProjectCatalog = components["schemas"]["PublicProjectCatalog"];
export type PublicProjectRecord = components["schemas"]["PublicProjectRecord"];
export type PublicationCatalog = components["schemas"]["PublicationCatalog"];
export type PublicationRecord = components["schemas"]["PublicationRecord"];
export type ProjectMissingPdfList =
  paths["/project-reference-intake/ksdft2effmass/missing-pdfs"]["get"]["responses"][200]["content"]["application/json"];
export type ProjectMissingPdf = components["schemas"]["MissingPdfItemResponse"];
export type ProjectProvidedPdf =
  paths["/project-reference-intake/ksdft2effmass/missing-pdfs/{citekey}/document"]["post"]["responses"][200]["content"]["application/json"];

export type CitationDocumentCatalog =
  paths["/citation-documents"]["get"]["responses"][200]["content"]["application/json"];
export type CitationDocumentItem =
  components["schemas"]["CitationDocumentItemResponse"];
export type CitationDocumentReceipt =
  components["schemas"]["CitationDocumentReceiptResponse"];
export type CitationDocumentProcessRequest =
  paths["/citation-documents/{item_id}/process-private"]["post"]["requestBody"]["content"]["application/json"];
export type CitationDocumentProcessResponse =
  paths["/citation-documents/{item_id}/process-private"]["post"]["responses"][200]["content"]["application/json"];
export type CitationDocumentSourceGap =
  components["schemas"]["CitationSourceGapResponse"];

export type TranscriptCatalog =
  paths["/transcripts"]["get"]["responses"][200]["content"]["application/json"];
export type TranscriptDocument =
  paths["/transcripts/{document_id}"]["get"]["responses"][200]["content"]["application/json"];
export type TranscriptDocumentSummary =
  components["schemas"]["TranscriptDocumentSummaryResponse"];
export type TranscriptPage = components["schemas"]["TranscriptPageResponse"];
export type TranscriptStatus = components["schemas"]["TranscriptStatus"];

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
export type EquationReviewQueueResponse =
  paths["/equation-reviews"]["get"]["responses"][200]["content"]["application/json"];
export type EquationReviewCandidate = EquationReviewQueueResponse["items"][number];
export type EquationReviewDecisionRequest =
  paths["/equation-reviews/{candidate_id}/decision"]["put"]["requestBody"]["content"]["application/json"];
export type EquationReviewDecisionResponse =
  paths["/equation-reviews/{candidate_id}/decision"]["put"]["responses"][200]["content"]["application/json"];
export type EquationReviewDisposition =
  components["schemas"]["EquationReviewDisposition"];
export type EquationDisplayMode = components["schemas"]["EquationDisplayMode"];
export type EquationReviewStatus = components["schemas"]["EquationReviewStatus"];
export type EquationReviewFailureCode =
  components["schemas"]["EquationReviewFailureCode"];
export type EquationReviewFailureResponse =
  components["schemas"]["EquationReviewFailureResponse"];
export type OrganizerControlRequest = components["schemas"]["OrganizerControlRequest"];
export type OrganizerEventList = components["schemas"]["OrganizerEventListResponse"];
export type OrganizerStatus = components["schemas"]["OrganizerStatusResponse"];
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
  readonly code: string | undefined;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
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

  async courses(signal?: AbortSignal): Promise<PublicCourseCatalog> {
    return this.request<PublicCourseCatalog>("/api/courses", { signal });
  }

  async projects(signal?: AbortSignal): Promise<PublicProjectCatalog> {
    return this.request<PublicProjectCatalog>("/api/projects", { signal });
  }

  async publications(signal?: AbortSignal): Promise<PublicationCatalog> {
    return this.request<PublicationCatalog>("/api/publications", { signal });
  }

  async projectMissingPdfs(signal?: AbortSignal): Promise<ProjectMissingPdfList> {
    return this.request<ProjectMissingPdfList>(
      "/project-reference-intake/ksdft2effmass/missing-pdfs",
      { signal },
    );
  }

  async provideProjectMissingPdf(
    citekey: string,
    file: File,
    signal?: AbortSignal,
  ): Promise<ProjectProvidedPdf> {
    return this.request<ProjectProvidedPdf>(
      `/project-reference-intake/ksdft2effmass/missing-pdfs/${encodeURIComponent(citekey)}/document`,
      {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: file,
        signal,
      },
    );
  }

  async githubTasks(signal?: AbortSignal): Promise<GitHubTaskDashboard> {
    return this.request<GitHubTaskDashboard>("/github/tasks", { signal });
  }

  async citationDocuments(signal?: AbortSignal): Promise<CitationDocumentCatalog> {
    return this.request<CitationDocumentCatalog>("/citation-documents", { signal });
  }

  async provideCitationDocumentSource(
    itemId: string,
    file: File,
    signal?: AbortSignal,
  ): Promise<CitationDocumentReceipt> {
    return this.request<CitationDocumentReceipt>(
      `/citation-documents/${encodeURIComponent(itemId)}/source`,
      {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: file,
        signal,
      },
    );
  }

  async processCitationDocumentPrivately(
    itemId: string,
    request: CitationDocumentProcessRequest,
    signal?: AbortSignal,
  ): Promise<CitationDocumentProcessResponse> {
    return this.request<CitationDocumentProcessResponse>(
      `/citation-documents/${encodeURIComponent(itemId)}/process-private`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal,
      },
    );
  }

  async transcripts(signal?: AbortSignal): Promise<TranscriptCatalog> {
    return this.request<TranscriptCatalog>("/transcripts", { signal });
  }

  async transcript(
    documentId: string,
    signal?: AbortSignal,
  ): Promise<TranscriptDocument> {
    return this.request<TranscriptDocument>(
      `/transcripts/${encodeURIComponent(documentId)}`,
      { signal },
    );
  }

  async organizerStatus(signal?: AbortSignal): Promise<OrganizerStatus> {
    return this.request<OrganizerStatus>("/organizer/status", { signal });
  }

  async setOrganizerMode(
    request: OrganizerControlRequest,
    signal?: AbortSignal,
  ): Promise<OrganizerStatus> {
    return this.request<OrganizerStatus>("/organizer/control", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  }

  async organizerEvents(after = 0, signal?: AbortSignal): Promise<OrganizerEventList> {
    const query = new URLSearchParams({ after: String(after) });
    return this.request<OrganizerEventList>(`/organizer/events?${query.toString()}`, {
      signal,
    });
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

  async equationReviews(
    documentId: string,
    signal?: AbortSignal,
  ): Promise<EquationReviewQueueResponse> {
    const query = new URLSearchParams({ document_id: documentId });
    return this.request<EquationReviewQueueResponse>(
      `/equation-reviews?${query.toString()}`,
      { signal },
    );
  }

  async saveEquationReviewDecision(
    candidateId: string,
    request: EquationReviewDecisionRequest,
    signal?: AbortSignal,
  ): Promise<EquationReviewDecisionResponse> {
    return this.request<EquationReviewDecisionResponse>(
      `/equation-reviews/${encodeURIComponent(candidateId)}/decision`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal,
      },
    );
  }

  equationRegionImageUrl(candidateId: string): string {
    const path = `/equation-reviews/${encodeURIComponent(candidateId)}/region`;
    return `${this.baseUrl}${path}`;
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
      let code: string | undefined;
      try {
        const body = (await response.json()) as {
          code?: unknown;
          detail?:
            | string
            | {
                code?: unknown;
                detail?: unknown;
              };
        };
        if (typeof body.detail === "string") {
          message = body.detail;
        } else if (body.detail && typeof body.detail === "object") {
          if (typeof body.detail.detail === "string") {
            message = body.detail.detail;
          }
          if (typeof body.detail.code === "string") {
            code = body.detail.code;
          }
        }
        if (typeof body.code === "string") {
          code = body.code;
        }
      } catch {
        // The status code remains sufficient when the body is not JSON.
      }
      throw new ApiError(response.status, message, code);
    }
    return (await response.json()) as T;
  }
}

const configuredBaseUrl = import.meta.env.VITE_KOIOS_API_BASE_URL as string | undefined;

export const apiClient = new ProjectKoiosApiClient(configuredBaseUrl ?? "");
