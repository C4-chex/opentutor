import { API_BASE, buildSecureRequestInit, parseApiError } from "./client";

export interface GitHubMaterialFile {
  path: string;
  relative_path: string;
  size: number;
  content: string;
  source_url: string;
  kind: "document" | "code";
  recommended: boolean;
  language: string;
}
export interface GitHubMaterialPreview {
  snapshot_id: string;
  repository: string;
  url: string;
  ref: string;
  commit: string;
  path: string;
  title: string;
  files: GitHubMaterialFile[];
  has_documents: boolean;
  skipped_count: number;
}
export interface GitHubImportResult {
  course_id: string;
  job_id: string;
  first_node_id: string;
  files_imported: number;
  nodes_created: number;
  commit: string;
}

async function githubRequest<T>(action: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetch(`${API_BASE}/content/github/${action}`, {
      ...buildSecureRequestInit({ method: "POST", body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    if (!response.ok) throw await parseApiError(response);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export const previewGitHub = (url: string) =>
  githubRequest<GitHubMaterialPreview>("preview", { url });
export const importGitHub = (snapshotId: string, paths: string[], name: string, requestId: string) =>
  githubRequest<GitHubImportResult>("import", {
    snapshot_id: snapshotId, paths, name, request_id: requestId,
  });
