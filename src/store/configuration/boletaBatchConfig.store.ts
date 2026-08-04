import { create } from "zustand";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { buildApiUrl } from "@/config";
import { useAuthStore } from "@/store/auth/auth.store";

interface BoletaBatchConfigState {
  boletaPorLote: boolean;
  flagCaptura: boolean;
  loading: boolean;
  saving: boolean;
  fetchConfig: () => Promise<void>;
  saveConfig: (boletaPorLote: boolean, flagCaptura: boolean) => Promise<boolean>;
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

const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const resolveCompanyId = () => {
  const session = readSession();
  const user = asRecord(session?.user);
  const loginPayload = asRecord(session?.loginPayload);
  return toPositiveInt(
    user?.companyId ??
      session?.companiaId ??
      loginPayload?.CompaniaId ??
      loginPayload?.companiaId ??
      (typeof window !== "undefined"
        ? window.localStorage.getItem("companiaId")
        : 1),
    1,
  );
};

const resolveBoletaPorLoteFromSession = () => {
  const session = readSession();
  const user = asRecord(session?.user);
  const loginPayload = asRecord(session?.loginPayload);
  const fallbackStorageValue =
    typeof window !== "undefined"
      ? window.localStorage.getItem("boletaPorLote") ??
        window.localStorage.getItem("BoletaPorLote")
      : null;
  return normalizeBooleanFlag(
    user?.boletaPorLote ??
      user?.BoletaPorLote ??
      session?.boletaPorLote ??
      session?.BoletaPorLote ??
      loginPayload?.BoletaPorLote ??
      loginPayload?.boletaPorLote ??
      fallbackStorageValue ??
      false,
  );
};

const resolveFlagCapturaFromSession = () => {
  const session = readSession();
  const user = asRecord(session?.user);
  const loginPayload = asRecord(session?.loginPayload);
  const fallbackStorageValue =
    typeof window !== "undefined"
      ? window.localStorage.getItem("flagCaptura") ??
        window.localStorage.getItem("FlagCaptura")
      : null;
  return normalizeBooleanFlag(
    user?.flagCaptura ??
      user?.FlagCaptura ??
      session?.flagCaptura ??
      session?.FlagCaptura ??
      loginPayload?.FlagCaptura ??
      loginPayload?.flagCaptura ??
      fallbackStorageValue ??
      false,
  );
};

const syncConfigToSession = (boletaPorLote: boolean, flagCaptura: boolean) => {
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
          flagCaptura?: unknown;
          FlagCaptura?: unknown;
        }
      | null;
    if (!parsed || typeof parsed !== "object") return;

    const nextUser: Record<string, unknown> = {
      ...(parsed.user ?? {}),
      boletaPorLote,
      BoletaPorLote: boletaPorLote,
      flagCaptura,
      FlagCaptura: flagCaptura,
    };

    const nextLoginPayload: Record<string, unknown> = {
      ...(parsed.loginPayload ?? {}),
      BoletaPorLote: boletaPorLote,
      boletaPorLote: boletaPorLote ? "1" : "0",
      FlagCaptura: flagCaptura,
      flagCaptura: flagCaptura ? "1" : "0",
    };

    const nextSession = {
      ...parsed,
      boletaPorLote,
      BoletaPorLote: boletaPorLote,
      flagCaptura,
      FlagCaptura: flagCaptura,
      user: nextUser,
      loginPayload: nextLoginPayload,
    };

    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));
    window.localStorage.setItem("boletaPorLote", boletaPorLote ? "1" : "0");
    window.localStorage.setItem("BoletaPorLote", boletaPorLote ? "1" : "0");
    window.localStorage.setItem("flagCaptura", flagCaptura ? "1" : "0");
    window.localStorage.setItem("FlagCaptura", flagCaptura ? "1" : "0");

    const authState = useAuthStore.getState();
    if (authState.user) {
      useAuthStore.setState({
        user: {
          ...authState.user,
          boletaPorLote,
          flagCaptura,
        },
      });
    }
  } catch (error) {
    console.error("No se pudo sincronizar configuración en sesión", error);
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

const findCompanyConfig = (response: unknown, companyId: number) => {
  const record = asRecord(response);
  const rows = Array.isArray(response)
    ? response
    : Array.isArray(record?.data)
      ? record.data
      : [];

  return rows
    .map(asRecord)
    .find((row) => toPositiveInt(row?.companiaId ?? row?.CompaniaId, 0) === companyId);
};

export const useBoletaBatchConfigStore = create<BoletaBatchConfigState>(
  (set) => ({
    boletaPorLote: false,
    flagCaptura: false,
    loading: false,
    saving: false,

    fetchConfig: async () => {
      set({ loading: true });
      try {
        const companyId = resolveCompanyId();
        const response = await apiRequest<unknown>({
          url: buildApiUrl("/Compania/list?page=1&pageSize=100"),
          method: "GET",
          fallback: null,
        });
        const company = findCompanyConfig(response, companyId);
        set({
          boletaPorLote: normalizeBooleanFlag(
            company?.boletaPorLote ??
              company?.BoletaPorLote ??
              resolveBoletaPorLoteFromSession(),
          ),
          flagCaptura: normalizeBooleanFlag(
            company?.flagCaptura ??
              company?.FlagCaptura ??
              resolveFlagCapturaFromSession(),
          ),
          loading: false,
        });
      } catch (error) {
        console.error("Error cargando configuración de compañía", error);
        set({ loading: false });
      }
    },

    saveConfig: async (boletaPorLote, flagCaptura) => {
      const companyId = resolveCompanyId();
      set({ saving: true });
      try {
        const boletaResponse = await apiRequest<unknown>({
          url: buildApiUrl(`/Compania/${companyId}/boleta-por-lote`),
          method: "PATCH",
          data: { boletaPorLote },
          fallback: null,
        });
        const boletaRecord = asRecord(boletaResponse);
        const responseBoletaPorLote = normalizeBooleanFlag(
          boletaRecord?.boletaPorLote ?? boletaRecord?.BoletaPorLote ?? boletaPorLote,
        );

        const flagResponse = await apiRequest<unknown>({
          url: buildApiUrl(`/Compania/${companyId}/flag-captura`),
          method: "PATCH",
          data: { flagCaptura },
          fallback: null,
        });
        const flagRecord = asRecord(flagResponse);
        const responseFlagCaptura = normalizeBooleanFlag(
          flagRecord?.flagCaptura ?? flagRecord?.FlagCaptura ?? flagCaptura,
        );

        if (!resolveResponseOk(boletaResponse) || !resolveResponseOk(flagResponse)) {
          set({ saving: false });
          return false;
        }

        syncConfigToSession(responseBoletaPorLote, responseFlagCaptura);
        set({
          boletaPorLote: responseBoletaPorLote,
          flagCaptura: responseFlagCaptura,
          saving: false,
        });
        return true;
      } catch (error) {
        console.error("Error guardando configuración de compañía", error);
        set({ saving: false });
        return false;
      }
    },
  }),
);
