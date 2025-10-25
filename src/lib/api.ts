type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  headers?: HeadersInit;
  skipAuth?: boolean;
};

export type User = {
  id: number;
  email: string | null;
  display_name: string;
  email_verified: boolean;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_at: string;
  refresh_expires_at: string;
  user: User;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type SignupPayload = {
  email: string;
  password: string;
  display_name?: string;
};

type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    hint?: string;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly hint?: string;

  constructor(status: number, code: string, message: string, hint?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}

const rawEndpoint = process.env.NEXT_PUBLIC_API_ENDPOINT?.trim() ?? "";
const API_BASE = rawEndpoint.replace(/\/+$/, "");

let accessToken: string | null = null;
let refreshPromise: Promise<TokenResponse | null> | null = null;

function resolveUrl(path: string): string {
  if (!API_BASE) {
    throw new Error("NEXT_PUBLIC_API_ENDPOINT is not configured");
  }
  const trimmedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${API_BASE}/${trimmedPath}`;
}

function ensureHeaders(headers: HeadersInit | undefined): Headers {
  return headers instanceof Headers ? headers : new Headers(headers);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<T>;
  }
  const text = await response.text();
  return JSON.parse(text) as T;
}

function handleErrorResponse(response: Response, payload: ApiErrorPayload | undefined): never {
  if (payload?.error) {
    const { code, message, hint } = payload.error;
    throw new ApiError(response.status, code, message, hint);
  }
  throw new ApiError(
    response.status,
    "unknown_error",
    `Request failed with status ${response.status}`,
  );
}

async function apiFetch<T>(
  path: string,
  { method = "GET", body, headers, skipAuth = false }: RequestOptions = {},
  attempt = 0,
): Promise<T> {
  const requestHeaders = ensureHeaders(headers);
  requestHeaders.set("Accept", "application/json");

  const init: RequestInit = {
    method,
    headers: requestHeaders,
    credentials: "include",
  };

  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
    init.body = JSON.stringify(body);
  }

  if (accessToken && !skipAuth) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(resolveUrl(path), init);
  if (response.status === 401 && attempt === 0 && !skipAuth) {
    const refreshed = await refreshTokenInternal();
    if (refreshed) {
      return apiFetch<T>(path, { method, body, headers: requestHeaders, skipAuth }, attempt + 1);
    }
  }

  if (!response.ok) {
    let payload: ApiErrorPayload | undefined;
    try {
      payload = await parseResponse<ApiErrorPayload>(response);
    } catch {
      handleErrorResponse(response, undefined);
    }
    handleErrorResponse(response, payload);
  }

  return parseResponse<T>(response);
}

async function refreshTokenInternal(): Promise<TokenResponse | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(resolveUrl("/auth/refresh"), {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });
        if (!response.ok) {
          accessToken = null;
          return null;
        }
        const data = await parseResponse<TokenResponse>(response);
        accessToken = data.access_token;
        return data;
      } catch {
        accessToken = null;
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function login(payload: LoginPayload): Promise<TokenResponse> {
  const data = await apiFetch<TokenResponse>("/auth/login", {
    method: "POST",
    body: payload,
    skipAuth: true,
  });
  accessToken = data.access_token;
  return data;
}

export async function signup(payload: SignupPayload): Promise<TokenResponse> {
  const data = await apiFetch<TokenResponse>("/auth/signup", {
    method: "POST",
    body: payload,
    skipAuth: true,
  });
  accessToken = data.access_token;
  return data;
}

export async function getMe(): Promise<User> {
  return apiFetch<User>("/auth/me");
}

export async function refresh(): Promise<TokenResponse | null> {
  return refreshTokenInternal();
}

export async function logout(): Promise<void> {
  try {
    await apiFetch("/auth/logout", {
      method: "POST",
      skipAuth: true,
    });
  } finally {
    accessToken = null;
  }
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}
