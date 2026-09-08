import { getAccessToken } from '@/lib/api-client';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, '_');
}

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseApiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return body.message ?? body.error ?? `${fallback} (${res.status})`;
}

/** Upload a file to MinIO via NestJS API. */
export async function uploadEmployeeDocument(file: File, employeeId: string): Promise<string> {
  const path = `${employeeId}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const form = new FormData();
  form.append('file', file);
  form.append('path', path);

  const res = await fetch(`${API_BASE}/storage/upload`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
    credentials: 'include',
  });

  if (!res.ok) {
    throw new Error(await parseApiError(res, 'Upload failed'));
  }

  const data = (await res.json()) as { path: string };
  return data.path ?? path;
}

/** Download an employee document (opens in new tab). */
export async function downloadEmployeeDocument(path: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/storage/download?path=${encodeURIComponent(path)}`,
    {
      headers: authHeaders(),
      credentials: 'include',
    },
  );

  if (!res.ok) {
    throw new Error(await parseApiError(res, 'Download failed'));
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const tab = window.open(url, '_blank');
  if (!tab) {
    URL.revokeObjectURL(url);
    throw new Error('Pop-up blocked — allow pop-ups to view the file');
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Delete file from MinIO (call before removing the DB row). */
export async function deleteEmployeeDocumentFile(path: string): Promise<void> {
  const res = await fetch(
    `${API_BASE}/storage/delete?path=${encodeURIComponent(path)}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
      credentials: 'include',
    },
  );

  if (!res.ok) {
    throw new Error(await parseApiError(res, 'Delete failed'));
  }
}
