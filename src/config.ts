const DEFAULT_API_BASE_URL = "http://localhost:5000/api/v1";

const rawApiBaseUrl =
  String(import.meta.env.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL).trim() ||
  DEFAULT_API_BASE_URL;

export const API_BASE_URL = rawApiBaseUrl.replace(/\/+$/, "");
if (import.meta.env.PROD && !String(import.meta.env.VITE_API_BASE_URL ?? "").trim()) {
  console.warn(
    "VITE_API_BASE_URL no esta configurada en produccion. Se usara el valor por defecto local."
  );
}

const buildRootUrl = (baseUrl: string) => {
  try {
    return new URL("/", baseUrl).origin;
  } catch {
    return baseUrl;
  }
};

export const API_ROOT_URL = buildRootUrl(API_BASE_URL);

export const buildRootApiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  try {
    return new URL(normalizedPath, API_ROOT_URL).toString();
  } catch {
    return `${API_ROOT_URL}${normalizedPath}`;
  }
};

export const buildApiUrl = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const PASSWORD_EXPIRATION_LOCK_ENABLED =
  String(import.meta.env.VITE_PASSWORD_EXPIRATION_LOCK_ENABLED ?? "true").toLowerCase() !==
  "false";

export const ENDPOINTS = {
  personal: "/Personal",
  personalList: "/Personal/list",
  personalRegister: "/Personal/registerpersonal",

  categoriaRegister: "/Linea/registerlinea",
  categoriaById: (id: number | string) => `/Linea/${id}`,

  areaRegister: "/Area/registerarea",
  areaById: (id: number | string) => `/Area/${id}`,

  maquinaRegister: "/Maquina/registermaquina",
  maquinaById: (id: number | string) => `/Maquina/${id}`,
} as const;

export const FEATURE_FLAGS = {
  richToasts: true,
};
