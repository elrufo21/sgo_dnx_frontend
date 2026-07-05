import { create } from "zustand";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { buildApiUrl } from "@/config";
import { useAuthStore } from "@/store/auth/auth.store";

interface BoletaBatchConfigState {
  boletaPorLote: boolean;
  loading: boolean;
  saving: boolean;
  fetchConfig: () => Promise<void>;
  saveConfig: (boletaPorLote: boolean) => Promise<boolean>;
}

const AUTH_STORAGE_KEY = "sgo.auth.session";

const normalizeText = (value: unknown, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const toPositiveInt = (value: unknown, fallback = 1) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : fallback;
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
    normalized === "y" ||
    normalized === "verdadero"
  );
};

const readSession = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const resolveCompanyId = () => {
  const session = readSession();
  return toPositiveInt(
    (session as any)?.user?.companyId ??
      (session as any)?.companiaId ??
      (session as any)?.loginPayload?.CompaniaId ??
      (session as any)?.loginPayload?.companiaId ??
      (typeof window !== "undefined"
        ? window.localStorage.getItem("companiaId")
        : 1),
    1,
  );
};

const resolveBoletaPorLoteFromSession = () => {
  const session = readSession();
  const fallbackStorageValue =
    typeof window !== "undefined"
      ? window.localStorage.getItem("boletaPorLote") ??
        window.localStorage.getItem("BoletaPorLote")
      : null;
  return normalizeBooleanFlag(
    (session as any)?.user?.boletaPorLote ??
      (session as any)?.user?.BoletaPorLote ??
      (session as any)?.boletaPorLote ??
      (session as any)?.BoletaPorLote ??
      (session as any)?.loginPayload?.BoletaPorLote ??
      (session as any)?.loginPayload?.boletaPorLote ??
      fallbackStorageValue ??
      false,
  );
};

const syncBoletaPorLoteToSession = (boletaPorLote: boolean) => {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as
      | {
          user?: Record<string, unknown>;
          loginPayload?: Record<string, unknown>;
          boletaPorLote?: unknown;
          BoletaPorLote?: unknown;
        }
      | null;
    if (!parsed || typeof parsed !== "object") return;

    const nextUser: Record<string, unknown> = {
      ...(parsed.user ?? {}),
      boletaPorLote,
      BoletaPorLote: boletaPorLote,
    };

    const nextLoginPayload: Record<string, unknown> = {
      ...(parsed.loginPayload ?? {}),
      BoletaPorLote: boletaPorLote,
      boletaPorLote: boletaPorLote ? "1" : "0",
    };

    const nextSession = {
      ...parsed,
      boletaPorLote,
      BoletaPorLote: boletaPorLote,
      user: nextUser,
      loginPayload: nextLoginPayload,
    };

    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
    window.localStorage.setItem("boletaPorLote", boletaPorLote ? "1" : "0");
    window.localStorage.setItem("BoletaPorLote", boletaPorLote ? "1" : "0");

    const authState = useAuthStore.getState();
    if (authState.user) {
      useAuthStore.setState({
        user: {
          ...authState.user,
          boletaPorLote,
        },
      });
    }
  } catch (error) {
    console.error("No se pudo sincronizar BoletaPorLote en sesión", error);
  }
};

const isAxiosLikeError = (value: unknown) =>
  Boolean(
    value &&
      typeof value === "object" &&
      "isAxiosError" in (value as Record<string, unknown>),
  );

const resolveResponseOk = (value: unknown) => {
  if (isAxiosLikeError(value)) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return true;
    if (
      normalized.includes("error") ||
      normalized.includes("404") ||
      normalized.includes("500") ||
      normalized.includes("no se pudo")
    ) {
      return false;
    }
    return true;
  }

  if (!value || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  if ("ok" in record) return normalizeBooleanFlag(record.ok);
  if ("success" in record) return normalizeBooleanFlag(record.success);
  if ("resultado" in record) {
    const normalized = normalizeText(record.resultado).toLowerCase();
    if (!normalized) return true;
    return !normalized.includes("error");
  }
  if ("status" in record) {
    const status = Number(record.status);
    if (Number.isFinite(status)) return status >= 200 && status < 300;
  }

  return true;
};

export const useBoletaBatchConfigStore = create<BoletaBatchConfigState>(
  (set) => ({
    boletaPorLote: false,
    loading: false,
    saving: false,

    fetchConfig: async () => {
      set({ loading: true });
      try {
        set({
          boletaPorLote: resolveBoletaPorLoteFromSession(),
          loading: false,
        });
      } catch (error) {
        console.error("Error cargando configuración BoletaPorLote", error);
        set({ loading: false });
      }
    },

    saveConfig: async (boletaPorLote) => {
      const companyId = resolveCompanyId();
      const payload = {
        boletaPorLote,
      };

      const url = buildApiUrl(`/Compania/${companyId}/boleta-por-lote`);
      set({ saving: true });
      try {
        const response = await apiRequest<unknown>({
          url,
          method: "PATCH",
          data: payload,
          fallback: null,
        });
        const responseBoletaPorLote = normalizeBooleanFlag(
          (response as any)?.boletaPorLote ??
            (response as any)?.BoletaPorLote ??
            boletaPorLote,
        );

        if (!resolveResponseOk(response)) {
          set({ saving: false });
          return false;
        }

        syncBoletaPorLoteToSession(responseBoletaPorLote);
        set({ boletaPorLote: responseBoletaPorLote, saving: false });
        return true;
      } catch (error) {
        console.error("Error guardando BoletaPorLote", error);
        set({ saving: false });
        return false;
      }
    },
  }),
);
