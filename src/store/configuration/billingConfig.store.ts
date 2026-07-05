import { create } from "zustand";
import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { useAuthStore } from "@/store/auth/auth.store";
import type {
  BillingConfigSummary,
  SaveBillingConfigPayload,
  BillingProcessType,
} from "@/types/billingConfig";

interface BillingConfigState {
  config: BillingConfigSummary | null;
  loading: boolean;
  saving: boolean;
  fetchConfig: (companyIdOverride?: string | number) => Promise<void>;
  saveConfig: (payload: SaveBillingConfigPayload) => Promise<boolean>;
}

const normalizeText = (value: unknown, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const toPositiveInt = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const resolveCompanyId = (override?: string | number) => {
  const overrideId = toPositiveInt(override, 0);
  if (overrideId > 0) return overrideId;
  if (typeof window === "undefined") return 1;

  try {
    const sessionRaw = window.localStorage.getItem("sgo.auth.session");
    const parsed = sessionRaw
      ? (JSON.parse(sessionRaw) as
          | {
              user?: { companyId?: string | number | null };
              companiaId?: string | number | null;
            }
          | null)
      : null;
    const storedCompaniaId = window.localStorage.getItem("companiaId");

    const companyIdRaw =
      parsed?.user?.companyId ?? parsed?.companiaId ?? storedCompaniaId;

    return toPositiveInt(companyIdRaw, 1);
  } catch {
    return 1;
  }
};

const resolveProcessType = (value: unknown): BillingProcessType => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === "PRODUCCION" || normalized === "1") return "PRODUCCION";
  return "BETA";
};

const toEntornoValue = (processType: BillingProcessType): number =>
  processType === "PRODUCCION" ? 1 : 3;

const resolvePayloadItem = (payload: unknown): Record<string, unknown> | null => {
  if (!payload) return null;

  if (Array.isArray(payload)) {
    const firstItem = payload.find(
      (item) => item && typeof item === "object",
    ) as Record<string, unknown> | undefined;
    return firstItem ?? null;
  }

  if (typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  if (Array.isArray(record.data)) {
    const first = record.data.find(
      (item) => item && typeof item === "object",
    ) as Record<string, unknown> | undefined;
    if (first) return first;
  }

  if (record.data && typeof record.data === "object") {
    return record.data as Record<string, unknown>;
  }

  return record;
};

const hasBillingConfigShape = (item: Record<string, unknown>) => {
  const knownKeys = [
    "UsuarioSOL",
    "usuarioSOL",
    "usuarioSol",
    "solUser",
    "ClaveSOL",
    "claveSOL",
    "claveSol",
    "solPassword",
    "Entorno",
    "entorno",
    "processType",
    "tipoProceso",
    "TipoProceso",
    "CompaniaPFX",
    "certificadoPfx",
    "certificadoPFX",
    "CertificadoPFX",
    "certificateName",
    "nombreCertificado",
    "NombreCertificado",
    "ClaveCertificado",
    "claveCertificado",
    "certificadoClave",
    "hasCertificate",
    "tieneCertificado",
    "TieneCertificado",
    "certificateExpiresAt",
    "fechaVencimientoCertificado",
    "FechaVencimientoCertificado",
    "updatedAt",
    "fechaActualizacion",
    "FechaActualizacion",
  ];

  return knownKeys.some((key) => Object.prototype.hasOwnProperty.call(item, key));
};

const normalizeCertificateName = (value: unknown) => {
  const raw = normalizeText(value);
  if (!raw) return "-";
  // Si llega contenido extenso (base64/ruta completa), evitamos ensuciar la UI.
  if (raw.length > 120) return "Certificado cargado";
  return raw;
};

const looksLikeBase64Payload = (value: string) => {
  const compact = value.replace(/\s+/g, "");
  if (compact.length < 120) return false;
  return /^[A-Za-z0-9+/=]+$/.test(compact);
};

const mapApiToSummary = (payload: unknown): BillingConfigSummary | null => {
  const item = resolvePayloadItem(payload);
  if (!item) return null;
  if (!hasBillingConfigShape(item)) return null;

  const certificateRaw =
    item.CertificadoPFX ??
    item.certificadoPfx ??
    item.certificadoPFX ??
    item.certificateName ??
    item.nombreCertificado ??
    item.NombreCertificado;
  const certificateValue = normalizeText(certificateRaw);
  const certificateBase64 = looksLikeBase64Payload(certificateValue)
    ? certificateValue.replace(/\s+/g, "")
    : null;
  const certificateName =
    normalizeText(item.nombreCertificado ?? item.NombreCertificado) ||
    (certificateBase64 ? "certificado-sunat.p12" : normalizeCertificateName(certificateRaw));

  const hasCertificateRaw = item.hasCertificate ?? item.tieneCertificado ?? item.TieneCertificado;
  const hasCertificate =
    certificateValue.length > 0 ||
    Boolean(certificateBase64) ||
    String(hasCertificateRaw ?? "")
      .trim()
      .toLowerCase() === "true" ||
    String(hasCertificateRaw ?? "").trim() === "1";

  return {
    hasCertificate,
    certificateName,
    certificateBase64,
    certificateExpiresAt: normalizeText(
      item.certificateExpiresAt ??
        item.fechaVencimientoCertificado ??
        item.FechaVencimientoCertificado,
    ) || null,
    certificatePassword: normalizeText(
      item.ClaveCertificado ??
        item.claveCertificado ??
        item.certificadoClave,
    ),
    solUser: normalizeText(
      item.UsuarioSOL ?? item.usuarioSOL ?? item.usuarioSol ?? item.solUser,
    ),
    solPassword: normalizeText(
      item.ClaveSOL ?? item.claveSOL ?? item.claveSol ?? item.solPassword,
    ),
    processType: resolveProcessType(
      item.Entorno ??
        item.entorno ??
        item.processType ??
        item.tipoProceso ??
        item.TipoProceso,
    ),
    updatedAt:
      normalizeText(item.updatedAt ?? item.fechaActualizacion ?? item.FechaActualizacion) ||
      null,
  };
};

const isAxiosLikeError = (value: unknown) =>
  Boolean(
    value &&
      typeof value === "object" &&
      "isAxiosError" in (value as Record<string, unknown>),
  );

const GET_ENDPOINT = `${API_BASE_URL}/Nota/credenciales-sunat`;
const SAVE_ENDPOINT = `${API_BASE_URL}/Nota/credenciales-sunat`;
const AUTH_STORAGE_KEY = "sgo.auth.session";

const toEntornoFromProcessType = (processType: BillingProcessType) =>
  processType === "PRODUCCION" ? "1" : "3";

const syncSunatConfigToSession = (
  summary: BillingConfigSummary,
  companyId: number,
) => {
  if (typeof window === "undefined") return;

  try {
    const rawSession = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!rawSession) return;

    const parsed = JSON.parse(rawSession) as
      | {
          user?: Record<string, unknown>;
          loginPayload?: Record<string, unknown>;
        }
      | null;
    if (!parsed || typeof parsed !== "object") return;

    const entornoValue = toEntornoFromProcessType(summary.processType);
    const userData = (parsed.user ?? {}) as Record<string, unknown>;
    const payloadData = (parsed.loginPayload ?? {}) as Record<string, unknown>;

    const nextUser: Record<string, unknown> = {
      ...userData,
      companyId: normalizeText(userData.companyId, String(companyId)),
      usuarioSol: summary.solUser,
      claveSol: summary.solPassword,
      claveCertificado: summary.certificatePassword,
      entorno: entornoValue,
    };

    if (summary.certificateBase64) {
      nextUser.certificadoBase64 = summary.certificateBase64;
    }

    const nextLoginPayload: Record<string, unknown> = {
      ...payloadData,
      companiaId: normalizeText(payloadData.companiaId, String(companyId)),
      usuarioSol: summary.solUser,
      claveSol: summary.solPassword,
      claveCertificado: summary.certificatePassword,
      entorno: entornoValue,
    };

    if (summary.certificateBase64) {
      nextLoginPayload.certificadoBase64 = summary.certificateBase64;
    }

    const nextSession = {
      ...parsed,
      user: nextUser,
      loginPayload: nextLoginPayload,
    };

    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(nextSession));

    const authState = useAuthStore.getState();
    if (authState.user) {
      useAuthStore.setState({
        user: {
          ...authState.user,
          usuarioSol: summary.solUser,
          claveSol: summary.solPassword,
          certificadoBase64:
            summary.certificateBase64 || authState.user.certificadoBase64,
          claveCertificado: summary.certificatePassword,
          entorno: entornoValue,
        },
      });
    }
  } catch (error) {
    console.error("No se pudo sincronizar credenciales SUNAT en la sesión", error);
  }
};

export const useBillingConfigStore = create<BillingConfigState>((set, get) => ({
  config: null,
  loading: false,
  saving: false,

  fetchConfig: async (companyIdOverride) => {
    const companyId = resolveCompanyId(companyIdOverride);
    set({ loading: true });
    try {
      const response = await apiRequest<unknown>({
        url: `${GET_ENDPOINT}/${companyId}`,
        method: "GET",
        fallback: null,
      });

      if (isAxiosLikeError(response)) {
        set({ loading: false });
        return;
      }

      const summary = mapApiToSummary(response);
      if (summary) {
        syncSunatConfigToSession(summary, companyId);
        set({ config: summary, loading: false });
        return;
      }

      set({ loading: false });
    } catch (error) {
      console.error("Error obteniendo configuración de facturación", error);
      set({ loading: false });
    }
  },

  saveConfig: async (payload) => {
    const companyId = resolveCompanyId();
    set({ saving: true });
    try {
      const formData = new FormData();

      if (payload.certificateFile instanceof File) {
        formData.append("certificado", payload.certificateFile);
      }
      formData.append("companiaId", String(companyId));
      formData.append("usuarioSOL", payload.solUser);
      formData.append("claveSOL", payload.solPassword);
      formData.append("claveCertificado", payload.certificatePassword);
      formData.append("entorno", String(toEntornoValue(payload.processType)));

      const response = await apiRequest<unknown>({
        url: SAVE_ENDPOINT,
        method: "POST",
        data: formData,
        fallback: null,
      });

      if (isAxiosLikeError(response)) {
        set({ saving: false });
        return false;
      }

      const summary = mapApiToSummary(response);
      if (summary) {
        syncSunatConfigToSession(summary, companyId);
        set({ config: summary, saving: false });
      } else {
        await get().fetchConfig(companyId);
        set({ saving: false });
      }

      return true;
    } catch (error) {
      console.error("Error guardando configuración de facturación", error);
      set({ saving: false });
      return false;
    }
  },
}));
