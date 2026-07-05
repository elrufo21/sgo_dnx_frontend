import { create } from "zustand";

import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";

const STORAGE_KEY = "sgo.auth.session";
const SESSION_EXPIRED_MESSAGE = "Tu sesión expiró. Ingresa nuevamente.";

export interface AuthUser {
  id: string;
  personalId: string;
  area: string;
  username: string;
  displayName: string;
  companyId: string;
  companyName: string;
  companyRuc: string;
  companyUbigeoName: string;
  companyCommercialName: string;
  companySunatAddress: string;
  companyPhone: string;
  usuarioSol: string;
  claveSol: string;
  certificadoBase64: string;
  claveCertificado: string;
  entorno: string;
  maxDiscount: number;
  boletaPorLote: boolean;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  expiresAt: number;
  passwordExpiresAt: string | null;
  loginPayload?: LoginResponse;
}

interface LoginPayload {
  username: string;
  password: string;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  passwordExpiresAt: string | null;
  isPasswordExpired: boolean;
  hydrated: boolean;
  loading: boolean;
  error: string | null;

  login: (payload: LoginPayload) => Promise<boolean>;
  logout: () => void;
  hydrate: () => void;
  setPasswordExpiration: (value: string | null) => void;
}

interface LoginResponse {
  [key: string]: unknown;
  Id?: string | number | null;
  PersonalId?: string | number | null;
  Area?: string | null;
  Usuario?: string | null;
  CompaniaId?: string | number | null;
  RazonSocial?: string | null;
  CompaniaRuc?: string | null;
  CompaniaNomUbg?: string | null;
  CompaniaComercial?: string | null;
  CompaniaDirecSunat?: string | null;
  CompaniaTelefono?: string | null;
  UsuarioSol?: string | null;
  ClaveSol?: string | null;
  CertificadoBase64?: string | null;
  ClaveCertificado?: string | null;
  Entorno?: string | number | null;
  FechaVencimientoClave?: string | null;
  DescuentoMax?: string | number | null;
  BoletaPorLote?: string | number | boolean | null;
  Token?: string | null;
  ExpiresAtUtc?: string | null;
  ExpiresInSeconds?: number | null;
}

let sessionTimeoutId: number | null = null;

const isAuthSession = (value: unknown): value is AuthSession => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    "token" in candidate &&
    "user" in candidate &&
    "expiresAt" in candidate &&
    typeof candidate.token === "string"
  );
};

const readSessionFromStorage = (): AuthSession | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isAuthSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const persistSession = (session: AuthSession) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

const clearSession = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
};

const scheduleSessionExpiration = (expiresAt: number, onExpire: () => void) => {
  if (typeof window === "undefined") return;
  if (sessionTimeoutId) {
    window.clearTimeout(sessionTimeoutId);
  }

  const msUntilExpire = expiresAt - Date.now();
  if (msUntilExpire <= 0) {
    onExpire();
    return;
  }

  sessionTimeoutId = window.setTimeout(() => {
    onExpire();
  }, msUntilExpire);
};

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const parsePasswordExpirationMs = (value?: string | null): number | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  if (DATE_ONLY_REGEX.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    return new Date(year, month - 1, day).getTime();
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasPasswordExpired = (value?: string | null): boolean => {
  const raw = String(value ?? "").trim();
  if (!raw) return false;

  const parsed = parsePasswordExpirationMs(raw);
  if (parsed === null) return false;

  if (DATE_ONLY_REGEX.test(raw)) {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    return todayStart >= parsed;
  }

  return Date.now() >= parsed;
};

const normalizeMaxDiscount = (value: unknown): number => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, numeric);
};

const normalizeText = (value: unknown): string => String(value ?? "").trim();

const readLoginValue = (
  payload: LoginResponse,
  ...keys: string[]
): unknown => {
  for (const key of keys) {
    if (!(key in payload)) continue;
    const value = payload[key];
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }
  return null;
};

const normalizeBooleanFlag = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return false;
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "si" ||
    normalized === "sí" ||
    normalized === "s" ||
    normalized === "yes" ||
    normalized === "y"
  );
};

const resolveBoletaPorLoteFlag = (payload: LoginResponse): boolean =>
  normalizeBooleanFlag(
    readLoginValue(
      payload,
      "BoletaPorLote",
      "boletaPorLote",
      "CompaniaBoletaPorLote",
      "companiaBoletaPorLote",
      "CompaniaBoletaEnvioLote",
      "companiaBoletaEnvioLote",
      "BoletaEnvioLote",
      "boletaEnvioLote",
    ),
  );

const normalizeAuthUser = (user: AuthUser): AuthUser => ({
  ...user,
  companyRuc: normalizeText(
    (user as AuthUser & { companyRuc?: unknown }).companyRuc,
  ),
  companyUbigeoName: normalizeText(
    (user as AuthUser & { companyUbigeoName?: unknown }).companyUbigeoName,
  ),
  companyCommercialName: normalizeText(
    (user as AuthUser & { companyCommercialName?: unknown })
      .companyCommercialName,
  ),
  companySunatAddress: normalizeText(
    (user as AuthUser & { companySunatAddress?: unknown }).companySunatAddress,
  ),
  companyPhone: normalizeText(
    (user as AuthUser & { companyPhone?: unknown }).companyPhone,
  ),
  usuarioSol: normalizeText(
    (user as AuthUser & { usuarioSol?: unknown }).usuarioSol,
  ),
  claveSol: normalizeText(
    (user as AuthUser & { claveSol?: unknown }).claveSol,
  ),
  certificadoBase64: normalizeText(
    (user as AuthUser & { certificadoBase64?: unknown }).certificadoBase64,
  ),
  claveCertificado: normalizeText(
    (user as AuthUser & { claveCertificado?: unknown }).claveCertificado,
  ),
  entorno: normalizeText((user as AuthUser & { entorno?: unknown }).entorno),
  maxDiscount: normalizeMaxDiscount(
    (user as AuthUser & { maxDiscount?: unknown }).maxDiscount,
  ),
  boletaPorLote: normalizeBooleanFlag(
    (user as AuthUser & { boletaPorLote?: unknown }).boletaPorLote,
  ),
});

export const useAuthStore = create<AuthState>((set, get) => {
  const storedSession = readSessionFromStorage();

  const isExpired = (expiresAt?: number | null) =>
    !expiresAt || expiresAt <= Date.now();

  const hasValidStoredSession =
    storedSession && !isExpired(storedSession.expiresAt);

  const logout = (reason?: string) => {
    if (sessionTimeoutId) {
      window.clearTimeout(sessionTimeoutId);
      sessionTimeoutId = null;
    }
    clearSession();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      passwordExpiresAt: null,
      isPasswordExpired: false,
      error: reason ?? null,
      hydrated: true,
    });
  };

  const hydrate = () => {
    if (get().hydrated) return;
    const session = readSessionFromStorage();
    if (session && !isExpired(session.expiresAt)) {
      const passwordExpiresAt = session.passwordExpiresAt ?? null;
      set({
        user: normalizeAuthUser(session.user),
        token: session.token,
        isAuthenticated: true,
        passwordExpiresAt,
        isPasswordExpired: hasPasswordExpired(passwordExpiresAt),
        hydrated: true,
      });
      scheduleSessionExpiration(session.expiresAt, () => logout(SESSION_EXPIRED_MESSAGE));
    } else {
      logout(session ? SESSION_EXPIRED_MESSAGE : undefined);
    }
  };

  return {
    user: hasValidStoredSession
      ? normalizeAuthUser(storedSession.user)
      : null,
    token: hasValidStoredSession ? storedSession?.token : null,
    isAuthenticated: !!hasValidStoredSession,
    passwordExpiresAt: hasValidStoredSession
      ? (storedSession?.passwordExpiresAt ?? null)
      : null,
    isPasswordExpired: hasValidStoredSession
      ? hasPasswordExpired(storedSession?.passwordExpiresAt ?? null)
      : false,
    hydrated: false,
    loading: false,
    error: null,

    hydrate,

    setPasswordExpiration: (value) => {
      const normalized = value?.trim() ? value.trim() : null;
      const state = get();
      set({
        passwordExpiresAt: normalized,
        isPasswordExpired: hasPasswordExpired(normalized),
      });

      if (!state.user || !state.token || !state.isAuthenticated) return;

      const currentSession = readSessionFromStorage();
      const session: AuthSession = {
        ...(currentSession ?? {}),
        token: state.token,
        user: normalizeAuthUser(state.user),
        expiresAt: currentSession?.expiresAt ?? Date.now() + 5 * 60 * 1000,
        passwordExpiresAt: normalized,
      };
      persistSession(session);
    },

    login: async ({ username, password }) => {
      set({ loading: true, error: null });

      const response = await apiRequest<LoginResponse>({
        url: `${API_BASE_URL}/User/acceso`,
        method: "POST",
        data: {
          email: username.trim(),
          password: password.trim(),
        },
      });

      const parsed = response as LoginResponse | null;

      if (!parsed || typeof parsed !== "object") {
        set({
          loading: false,
          isAuthenticated: false,
          user: null,
          token: null,
          error: "Credenciales incorrectas",
          hydrated: true,
        });
        return false;
      }

      const token = normalizeText(readLoginValue(parsed, "Token", "token"));

      if (!token) {
        set({
          loading: false,
          isAuthenticated: false,
          user: null,
          token: null,
          error: "Credenciales incorrectas",
          hydrated: true,
        });
        return false;
      }

      const expiresAt =
        (readLoginValue(parsed, "ExpiresAtUtc", "expiresAtUtc")
          ? Date.parse(
              String(readLoginValue(parsed, "ExpiresAtUtc", "expiresAtUtc")),
            )
          : null) ??
        (readLoginValue(parsed, "ExpiresInSeconds", "expiresInSeconds")
          ? Date.now() +
            Number(readLoginValue(parsed, "ExpiresInSeconds", "expiresInSeconds")) *
              1000
          : null);
      const boletaPorLote = resolveBoletaPorLoteFlag(parsed);

      const session: AuthSession = {
        token,
        expiresAt: expiresAt ?? Date.now() + 5 * 60 * 1000, // fallback a 5 min si el API no envía expiración
        passwordExpiresAt:
          normalizeText(
            readLoginValue(
              parsed,
              "FechaVencimientoClave",
              "fechaVencimientoClave",
            ),
          ) || null,
        user: {
          id: normalizeText(readLoginValue(parsed, "Id", "id")),
          personalId: normalizeText(readLoginValue(parsed, "PersonalId", "personalId")),
          area: normalizeText(readLoginValue(parsed, "Area", "area")),
          username,
          displayName:
            normalizeText(readLoginValue(parsed, "Usuario", "usuario")) || username,
          companyId: normalizeText(readLoginValue(parsed, "CompaniaId", "companiaId")),
          companyName: normalizeText(readLoginValue(parsed, "RazonSocial", "razonSocial")),
          companyRuc: normalizeText(readLoginValue(parsed, "CompaniaRuc", "companiaRuc")),
          companyUbigeoName: normalizeText(
            readLoginValue(parsed, "CompaniaNomUbg", "companiaNomUbg"),
          ),
          companyCommercialName: normalizeText(
            readLoginValue(parsed, "CompaniaComercial", "companiaComercial"),
          ),
          companySunatAddress: normalizeText(
            readLoginValue(parsed, "CompaniaDirecSunat", "companiaDirecSunat"),
          ),
          companyPhone: normalizeText(
            readLoginValue(parsed, "CompaniaTelefono", "companiaTelefono"),
          ),
          usuarioSol: normalizeText(readLoginValue(parsed, "UsuarioSol", "usuarioSol")),
          claveSol: normalizeText(readLoginValue(parsed, "ClaveSol", "claveSol")),
          certificadoBase64: normalizeText(
            readLoginValue(parsed, "CertificadoBase64", "certificadoBase64"),
          ),
          claveCertificado: normalizeText(
            readLoginValue(parsed, "ClaveCertificado", "claveCertificado"),
          ),
          entorno: normalizeText(readLoginValue(parsed, "Entorno", "entorno")),
          maxDiscount: normalizeMaxDiscount(
            readLoginValue(parsed, "DescuentoMax", "descuentoMax"),
          ),
          boletaPorLote,
        },
        loginPayload: {
          ...parsed,
          CompaniaRuc: normalizeText(readLoginValue(parsed, "CompaniaRuc", "companiaRuc")),
          CompaniaNomUbg: normalizeText(
            readLoginValue(parsed, "CompaniaNomUbg", "companiaNomUbg"),
          ),
          CompaniaComercial: normalizeText(
            readLoginValue(parsed, "CompaniaComercial", "companiaComercial"),
          ),
          CompaniaDirecSunat: normalizeText(
            readLoginValue(parsed, "CompaniaDirecSunat", "companiaDirecSunat"),
          ),
          CompaniaTelefono: normalizeText(
            readLoginValue(parsed, "CompaniaTelefono", "companiaTelefono"),
          ),
          UsuarioSol: normalizeText(readLoginValue(parsed, "UsuarioSol", "usuarioSol")),
          ClaveSol: normalizeText(readLoginValue(parsed, "ClaveSol", "claveSol")),
          CertificadoBase64: normalizeText(
            readLoginValue(parsed, "CertificadoBase64", "certificadoBase64"),
          ),
          ClaveCertificado: normalizeText(
            readLoginValue(parsed, "ClaveCertificado", "claveCertificado"),
          ),
          Entorno: normalizeText(readLoginValue(parsed, "Entorno", "entorno")),
          FechaVencimientoClave:
            normalizeText(
              readLoginValue(parsed, "FechaVencimientoClave", "fechaVencimientoClave"),
            ) || null,
          DescuentoMax: (() => {
            const raw = readLoginValue(parsed, "DescuentoMax", "descuentoMax");
            return raw === null || raw === undefined ? null : String(raw);
          })(),
          BoletaPorLote: boletaPorLote,

          // Compatibilidad temporal con consumidores legacy.
          companiaRuc: normalizeText(readLoginValue(parsed, "CompaniaRuc", "companiaRuc")),
          companiaNomUbg: normalizeText(
            readLoginValue(parsed, "CompaniaNomUbg", "companiaNomUbg"),
          ),
          companiaComercial: normalizeText(
            readLoginValue(parsed, "CompaniaComercial", "companiaComercial"),
          ),
          companiaDirecSunat: normalizeText(
            readLoginValue(parsed, "CompaniaDirecSunat", "companiaDirecSunat"),
          ),
          companiaTelefono: normalizeText(
            readLoginValue(parsed, "CompaniaTelefono", "companiaTelefono"),
          ),
          usuarioSol: normalizeText(readLoginValue(parsed, "UsuarioSol", "usuarioSol")),
          claveSol: normalizeText(readLoginValue(parsed, "ClaveSol", "claveSol")),
          certificadoBase64: normalizeText(
            readLoginValue(parsed, "CertificadoBase64", "certificadoBase64"),
          ),
          claveCertificado: normalizeText(
            readLoginValue(parsed, "ClaveCertificado", "claveCertificado"),
          ),
          entorno: normalizeText(readLoginValue(parsed, "Entorno", "entorno")),
          fechaVencimientoClave:
            normalizeText(
              readLoginValue(parsed, "FechaVencimientoClave", "fechaVencimientoClave"),
            ) || null,
          descuentoMax: (() => {
            const raw = readLoginValue(parsed, "DescuentoMax", "descuentoMax");
            return raw === null || raw === undefined ? null : String(raw);
          })(),
          boletaPorLote: boletaPorLote ? "1" : "0",
        },
      };

      persistSession(session);
      set({
        loading: false,
        isAuthenticated: true,
        user: session.user,
        token: session.token,
        passwordExpiresAt: session.passwordExpiresAt,
        isPasswordExpired: hasPasswordExpired(session.passwordExpiresAt),
        hydrated: true,
        error: null,
      });

      scheduleSessionExpiration(session.expiresAt, () =>
        logout(SESSION_EXPIRED_MESSAGE)
      );

      return true;
    },

    logout: () => logout(),
  };
});
