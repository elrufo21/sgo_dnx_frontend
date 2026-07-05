import axios, { type AxiosRequestConfig, type Method } from "axios";
import { API_BASE_URL } from "@/config";

interface ApiRequestParams<TBody = unknown, TFallback = unknown> {
  url: string;
  method?: Method;
  data?: TBody | null;
  config?: AxiosRequestConfig;
  fallback?: TFallback;
}

const AUTH_STORAGE_KEY = "sgo.auth.session";

const resolveAuthToken = (): string | null => {
  if (typeof window === "undefined") return null;

  try {
    const rawSession = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!rawSession) return null;

    const parsed = JSON.parse(rawSession);
    return typeof parsed?.token === "string" && parsed.token.trim() !== ""
      ? parsed.token
      : null;
  } catch {
    return null;
  }
};

const resolveOrigin = (url: string): string | null => {
  try {
    if (typeof window !== "undefined") {
      return new URL(url, window.location.origin).origin;
    }
    return new URL(url).origin;
  } catch {
    return null;
  }
};

const shouldAttachAuth = (url: string): boolean => {
  if (typeof window === "undefined") return true;

  const requestOrigin = resolveOrigin(url);
  if (!requestOrigin) return true;

  const appOrigin = window.location.origin;
  const apiOrigin = resolveOrigin(API_BASE_URL) ?? appOrigin;

  // Attach auth only for app/backend origins; avoid leaking auth to third-party APIs.
  return requestOrigin === appOrigin || requestOrigin === apiOrigin;
};

const withAuthHeader = (
  headers: AxiosRequestConfig["headers"],
  url: string,
): AxiosRequestConfig["headers"] => {
  if (!shouldAttachAuth(url)) return headers;

  const token = resolveAuthToken();
  if (!token) return headers;

  const normalizedHeaders = {
    ...(headers as Record<string, string | number | boolean> | undefined),
  };

  const hasAuthorization = Object.keys(normalizedHeaders).some(
    (key) => key.toLowerCase() === "authorization"
  );

  if (!hasAuthorization) {
    normalizedHeaders.Authorization = `Bearer ${token}`;
  }

  return normalizedHeaders;
};

export async function apiRequest<
  TResponse = unknown,
  TBody = unknown,
  TFallback = unknown
>({
  url,
  method = "GET",
  data = null,
  config = {},
  fallback,
}: ApiRequestParams<TBody, TFallback>): Promise<TResponse | TFallback> {
  try {
    const headers = withAuthHeader(config.headers, url);

    const response = await axios({
      url,
      method,
      data,
      ...config,
      headers,
    });
    const result = response.data;

    if (typeof result === "string" && result.includes("<!doctype html")) {
      console.warn("⚠️ El api no existe");
      return fallback as TFallback;
    }
    console.log("response", result);

    return result;
  } catch (err) {
    console.error("⚠️ Error del api", err);
    return err as TResponse | TFallback;
  }
}
