import { create } from "zustand";
import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
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
  if (normalized === "BETA" || normalized === "3") return "BETA";
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
  const certificateName =
    normalizeText(item.nombreCertificado ?? item.NombreCertificado) ||
    normalizeCertificateName(certificateRaw);

  const hasCertificateRaw = item.hasCertificate ?? item.tieneCertificado ?? item.TieneCertificado;
  const hasCertificate =
    certificateValue.length > 0 ||
    String(hasCertificateRaw ?? "")
      .trim()
      .toLowerCase() === "true" ||
    String(hasCertificateRaw ?? "").trim() === "1";

  return {
    hasCertificate,
    certificateName,
    certificateBase64: null,
    certificateExpiresAt: normalizeText(
      item.certificateExpiresAt ??
        item.fechaVencimientoCertificado ??
        item.FechaVencimientoCertificado,
    ) || null,
    certificatePassword: "",
    solUser: normalizeText(
      item.UsuarioSOL ?? item.usuarioSOL ?? item.usuarioSol ?? item.solUser,
    ),
    solPassword: "",
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
