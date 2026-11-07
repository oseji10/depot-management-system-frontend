import { API_URL, authHeaders, signOutLocally } from "./auth";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors?: Record<string, string[]>,
    public body?: Record<string, unknown> | null,
  ) {
    super(message);
  }
}

/** Browser -> Laravel API, with the signed-in user's token. A rejected token sends the user to the login page. */
export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? "GET",
      headers: { ...(opts.auth === false ? { Accept: "application/json" } : authHeaders()), ...(opts.body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError("Could not reach the server. Check your connection and try again.", 0);
  }

  if (res.status === 401 && opts.auth !== false) {
    signOutLocally();
    window.location.href = "/login/";
    throw new ApiError("Your session has expired. Sign in again.", 401);
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(data?.message ?? "Something went wrong. Try again.", res.status, data?.errors, data);
  }

  return data as T;
}
