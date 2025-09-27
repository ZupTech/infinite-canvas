const HOST_URL = process.env.NEXT_PUBLIC_HOST_URL ?? "https://myunite.ai";

type FetchOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function request<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options;
  const computedHeaders = new Headers(headers as HeadersInit | undefined);

  if (body === undefined) {
    computedHeaders.delete("Content-Type");
  } else if (
    !(body instanceof FormData) &&
    !computedHeaders.has("Content-Type")
  ) {
    computedHeaders.set("Content-Type", "application/json");
  }

  const init: RequestInit = {
    ...rest,
    credentials: "include",
    headers: computedHeaders,
  };

  if (body !== undefined) {
    init.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const response = await fetch(`${HOST_URL}${path}`, init);
  if (!response.ok) {
    let message = response.statusText;
    try {
      const errorBody = await response.json();
      message = errorBody?.error ?? errorBody?.message ?? message;
    } catch (error) {
      // ignore json parse errors
    }
    const err = new Error(message);
    (err as any).status = response.status;
    throw err;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  return (await response.text()) as T;
}

export interface UniteGenModelParameter {
  name: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "slider"
    | "select"
    | "radio"
    | "file"
    | "multifile"
    | "audio"
    | "voice_recorder"
    | "voice-selector"
    | "aspect-ratio"
    | "hidden"
    | "computed"
    | "boolean";
  required?: boolean;
  default?: unknown;
  options?: Array<string | { label: string; value: string }>;
  conditional?: Record<string, unknown>;
  accept?: string;
  uiPriority?: string;
}

export interface UniteGenModel {
  id: string;
  type: string;
  provider: string;
  visible: boolean;
  parameters: UniteGenModelParameter[];
  ui?: Record<string, unknown>;
}

export interface UniteGenModelsResponse {
  ui?: Record<string, unknown>;
  models: UniteGenModel[];
}

export interface GenerateRequest {
  modelId: string;
  parameters: Record<string, unknown>;
}

export interface GenerateResponse {
  job: {
    id: string;
    runId: string;
    modelId: string;
    status: string;
    parameters: Record<string, unknown>;
    result: unknown;
    createdAt: string;
    updatedAt: string;
  };
  realtime?: {
    runId: string;
    token: string | null;
    scope: string | null;
  } | null;
}

export interface HistoryResponse {
  jobs: Array<{
    id: string;
    modelId: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    result?: Record<string, unknown> | null;
    error?: unknown;
    runId?: string;
  }>;
  pagination?: {
    page: number;
    limit: number;
    hasMore: boolean;
    currentCount: number;
  };
}

export interface RealtimeTokenResponse {
  token: string;
  tags: string[];
}

export interface PresignedUploadRequest {
  fileName: string;
  fileSize: number;
  fileType: string;
  mediaType: "image" | "video" | "audio";
}

export interface PresignedUploadResponse {
  presignedUrl: string;
  fileKey: string;
  uploadUrl: string;
  expiresAt: string;
  limits: number;
  allowedTypes: string[];
}

export interface ProcessUploadedRequest {
  fileKey: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  mediaType: "image" | "video" | "audio";
  uploadUrl: string;
  purpose?: string;
}

export interface SaveProjectRequest {
  id?: string;
  title: string;
  serializedJson: Record<string, unknown>;
  revision?: number;
  isDraft?: boolean;
}

export interface SaveProjectResponse {
  id: string;
  revision: number;
  updatedAt: string;
  createdAt: string;
}

export interface ProjectResponse {
  id: string;
  title: string;
  serializedJson: Record<string, unknown>;
  revision: number;
  isDraft: boolean;
  updatedAt: string;
  createdAt: string;
}

export async function fetchModels(): Promise<UniteGenModelsResponse> {
  return await request<UniteGenModelsResponse>("/api/models", {
    method: "GET",
  });
}

export async function triggerGeneration(
  payload: GenerateRequest,
): Promise<GenerateResponse> {
  return await request<GenerateResponse>("/api/generate", {
    method: "POST",
    body: payload,
  });
}

export async function fetchHistory(params?: {
  page?: number;
  limit?: number;
  all?: boolean;
  cv?: number;
  v?: number;
}): Promise<HistoryResponse> {
  const search = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return await request<HistoryResponse>(
    `/api/history${query ? `?${query}` : ""}`,
    {
      method: "GET",
    },
  );
}

export async function fetchRealtimeToken(): Promise<RealtimeTokenResponse> {
  return await request<RealtimeTokenResponse>("/api/trigger/realtime-token", {
    method: "GET",
  });
}

export async function fetchJobStatus<T = unknown>(runId: string): Promise<T> {
  return await request<T>(`/api/jobs/status/${encodeURIComponent(runId)}`, {
    method: "GET",
  });
}

export async function requestPresignedUpload(
  payload: PresignedUploadRequest,
): Promise<PresignedUploadResponse> {
  return await request<PresignedUploadResponse>("/api/media/presigned", {
    method: "POST",
    body: payload,
  });
}

export async function processUploadedFile(payload: ProcessUploadedRequest) {
  return await request<{ jobId?: string; runId?: string }>(
    "/api/media/process-uploaded",
    {
      method: "POST",
      body: payload,
    },
  );
}

export async function saveProject(
  payload: SaveProjectRequest,
): Promise<SaveProjectResponse> {
  return await request<SaveProjectResponse>("/api/canvas/projects", {
    method: "POST",
    body: payload,
  });
}

export async function fetchProject(id: string): Promise<ProjectResponse> {
  return await request<ProjectResponse>(`/api/canvas/projects/${id}`, {
    method: "GET",
  });
}
