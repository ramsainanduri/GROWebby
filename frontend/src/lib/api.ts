export type UploadedCoordinate = {
  id: number;
  originalName: string;
  size: number;
  url: string;
  createdAt: string;
};

export type SimulationMetric = {
  stage?: string;
  progress: number;
  sample?: number;
  timePs?: number;
  energy?: number;
  potential?: number;
  totalEnergy?: number;
  kineticEnergy?: number;
  temperature?: number;
  pressure?: number;
  density?: number;
  [key: string]: string | number | undefined;
};

export type ArtifactFile = {
  name: string;
  kind: string;
  url: string;
  path?: string;
};

export type SimulationJob = {
  id: number;
  runGroupId: number;
  step: string;
  name: string;
  workspaceSlug: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  currentStep: string;
  progress: number;
  processPid: number | null;
  parameters: Record<string, unknown>;
  metrics: SimulationMetric[];
  artifactFiles: ArtifactFile[];
  executionMode: string;
  error: string;
  upload: UploadedCoordinate;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

export type SimulationLogEntry = {
  id: number;
  message: string;
  createdAt: string;
};

export type SessionUser = {
  id: number;
  username: string;
  email: string;
  isStaff: boolean;
  isSuperuser: boolean;
  isActive: boolean;
  groups: string[];
};

export type SessionState = {
  isAuthenticated: boolean;
  user: SessionUser | null;
};

export type AdminUser = {
  id: number;
  username: string;
  email: string;
  isActive: boolean;
  isStaff: boolean;
  isSuperuser: boolean;
  dateJoined: string;
  purpose: string;
};

export type HealthState = {
  status: string;
  service: string;
  engine: {
    selected: string;
    executionMode: string;
    gromacsBinary: string;
    gpuAvailable?: boolean;
    gpuBackend?: string;
  };
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await response.json() : { error: await response.text() };
  if (!response.ok) {
    const message = typeof data.error === "string" && data.error.trim().startsWith("<!DOCTYPE")
      ? "The server rejected the request. Refresh the page and try again."
      : data.error;
    throw new Error(message ?? "Request failed");
  }
  return data as T;
}

export async function getHealth(): Promise<HealthState> {
  return parseResponse<HealthState>(await fetch(`${API_BASE}/health/`));
}

function csrfToken(): string {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith("csrftoken="))
    ?.split("=")[1] ?? "";
}

async function apiFetch(path: string, init: RequestInit = {}) {
  const method = init.method?.toUpperCase() ?? "GET";
  const headers = new Headers(init.headers);
  if (method !== "GET" && method !== "HEAD") {
    headers.set("X-CSRFToken", csrfToken());
  }
  return fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers
  });
}

export async function getSession(): Promise<SessionState> {
  const response = await apiFetch("/auth/session/");
  return parseResponse<SessionState>(response);
}

export async function loginUser(username: string, password: string): Promise<SessionState> {
  const response = await apiFetch("/auth/login/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  return parseResponse<SessionState>(response);
}

export async function registerUser(username: string, email: string, password: string, purpose: string): Promise<{ registered: boolean; message: string }> {
  const response = await apiFetch("/auth/register/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password, purpose })
  });
  return parseResponse<{ registered: boolean; message: string }>(response);
}

export async function logoutUser(): Promise<SessionState> {
  const response = await apiFetch("/auth/logout/", { method: "POST" });
  return parseResponse<SessionState>(response);
}

export async function uploadCoordinate(file: File): Promise<UploadedCoordinate> {
  const form = new FormData();
  form.append("file", file);
  const response = await apiFetch("/uploads/coordinate/", {
    method: "POST",
    body: form
  });
  return parseResponse<UploadedCoordinate>(response);
}

export async function listUploads(): Promise<UploadedCoordinate[]> {
  const response = await apiFetch("/uploads/");
  const data = await parseResponse<{ results: UploadedCoordinate[] }>(response);
  return data.results;
}

export async function createSimulation(uploadId: number, parameters: Record<string, unknown>, name?: string): Promise<SimulationJob> {
  const response = await apiFetch("/simulations/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId, parameters, name })
  });
  return parseResponse<SimulationJob>(response);
}

export async function listSimulations(): Promise<SimulationJob[]> {
  const response = await apiFetch("/simulations/");
  const data = await parseResponse<{ results: SimulationJob[] }>(response);
  return data.results;
}

export async function getSimulation(jobId: number): Promise<SimulationJob> {
  const response = await apiFetch(`/simulations/${jobId}/`);
  return parseResponse<SimulationJob>(response);
}

export async function deleteSimulation(jobId: number): Promise<{ deleted: boolean }> {
  const response = await apiFetch(`/simulations/${jobId}/`, { method: "DELETE" });
  return parseResponse<{ deleted: boolean }>(response);
}

export async function cancelSimulation(jobId: number): Promise<SimulationJob> {
  const response = await apiFetch(`/simulations/${jobId}/cancel/`, { method: "POST" });
  return parseResponse<SimulationJob>(response);
}

export async function renameSimulation(jobId: number, name: string): Promise<SimulationJob> {
  const response = await apiFetch(`/simulations/${jobId}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  return parseResponse<SimulationJob>(response);
}

export async function createExampleSetup(exampleKey: "lysozyme" | "small-molecule"): Promise<{ upload: UploadedCoordinate; parameters: Record<string, unknown> }> {
  const response = await apiFetch(`/examples/${exampleKey}/`, { method: "POST" });
  return parseResponse<{ upload: UploadedCoordinate; parameters: Record<string, unknown> }>(response);
}

export async function getSimulationLogs(jobId: number): Promise<SimulationLogEntry[]> {
  const response = await apiFetch(`/simulations/${jobId}/logs/history/`);
  const data = await parseResponse<{ results: SimulationLogEntry[] }>(response);
  return data.results;
}

export async function readArtifact(jobId: number, artifact: ArtifactFile): Promise<{ content: string; artifact: ArtifactFile }> {
  const response = await apiFetch(`/simulations/${jobId}/artifacts/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artifact })
  });
  return parseResponse<{ content: string; artifact: ArtifactFile }>(response);
}

export async function saveArtifact(jobId: number, artifact: ArtifactFile, content: string): Promise<{ saved: boolean; artifact: ArtifactFile }> {
  const response = await apiFetch(`/simulations/${jobId}/artifacts/`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ artifact, content })
  });
  return parseResponse<{ saved: boolean; artifact: ArtifactFile }>(response);
}

export function logStreamUrl(jobId: number): string {
  return `${API_BASE}/simulations/${jobId}/logs/`;
}

export function logHistoryUrl(jobId: number): string {
  return `${API_BASE}/simulations/${jobId}/logs/history/`;
}

// ── Admin API ──────────────────────────────────────────────────────────────────

export async function adminListUsers(): Promise<AdminUser[]> {
  const response = await apiFetch("/auth/admin/users/");
  const data = await parseResponse<{ users: AdminUser[] }>(response);
  return data.users;
}

export async function adminApproveUser(userId: number): Promise<{ id: number; isActive: boolean }> {
  const response = await apiFetch(`/auth/admin/users/${userId}/approve/`, { method: "POST" });
  return parseResponse(response);
}

export async function adminDenyUser(userId: number): Promise<{ deleted: boolean }> {
  const response = await apiFetch(`/auth/admin/users/${userId}/deny/`, { method: "POST" });
  return parseResponse(response);
}

export async function adminCreateUser(data: any): Promise<{ id: number; created: boolean }> {
  const response = await apiFetch(`/auth/admin/users/create/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return parseResponse(response);
}

export async function adminUpdateUser(userId: number, data: any): Promise<{ id: number; updated: boolean }> {
  const response = await apiFetch(`/auth/admin/users/${userId}/update/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return parseResponse(response);
}

export async function adminResetUserPassword(userId: number, data: any): Promise<{ id: number; passwordReset: boolean }> {
  const response = await apiFetch(`/auth/admin/users/${userId}/reset-password/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
  return parseResponse(response);
}
