import { ApiResponse } from '../types/api';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || '';

function assertBaseUrl() {
  if (!BASE_URL) {
    throw new Error('Missing EXPO_PUBLIC_API_BASE_URL');
  }
}

export async function apiRequest<T>(
  path: string,
  method: 'GET' | 'POST',
  token?: string,
  body?: Record<string, unknown>
): Promise<ApiResponse<T>> {
  assertBaseUrl();
  const url = `${BASE_URL}${path}`;

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let requestBody: string | undefined;
  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
    const params = new URLSearchParams();
    Object.entries(body || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      params.append(key, String(value));
    });
    requestBody = params.toString();
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: requestBody
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Request failed: ${method} ${url} (${message})`);
  }

  const text = await res.text();
  let json: ApiResponse<T>;
  try {
    json = JSON.parse(text);
  } catch {
    const preview = text.replace(/\s+/g, ' ').trim().slice(0, 120);
    throw new Error(
      preview
        ? `Invalid server response from ${method} ${url} (${res.status}): ${preview}`
        : `Invalid server response from ${method} ${url} (${res.status})`
    );
  }

  return json;
}
