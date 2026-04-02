/**
 * E2E test helpers — API request and assertion utilities.
 */
import { STAGING } from "./config";

interface ApiResponse {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Make an API request to the staging server.
 */
export async function apiRequest(
  method: string,
  path: string,
  token?: string,
  body?: Record<string, unknown>,
): Promise<ApiResponse> {
  const url = `${STAGING.API_URL}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });

  let respBody: Record<string, unknown>;
  try {
    respBody = (await resp.json()) as Record<string, unknown>;
  } catch {
    respBody = {};
  }

  return { status: resp.status, body: respBody };
}

/**
 * Shorthand for alice's API requests.
 */
export function asAlice(method: string, path: string, body?: Record<string, unknown>) {
  return apiRequest(method, path, STAGING.ALICE_TOKEN, body);
}

/**
 * Shorthand for bob's API requests.
 */
export function asBob(method: string, path: string, body?: Record<string, unknown>) {
  return apiRequest(method, path, STAGING.BOB_TOKEN, body);
}

/**
 * Anonymous API request (no auth).
 */
export function anonymous(method: string, path: string) {
  return apiRequest(method, path);
}
