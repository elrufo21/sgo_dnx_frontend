export type ExternalCaptureDraftData = {
  transactionNumber: string;
  memberCode: string;
  customerName: string;
  customerEmail: string;
  ruc: string;
  date: string;
  discount: number;
  lines: Array<{ code: string; quantity: number }>;
};

export type ExternalCaptureDraftContext = {
  companyId: number;
  userId: string;
};

const STORAGE_KEY = "sgo:sales:external-capture-draft";
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

type StoredDraft = {
  context: ExternalCaptureDraftContext;
  data: ExternalCaptureDraftData;
  savedAt: number;
};

const asText = (value: unknown) => String(value ?? "").trim();

const normalizeData = (value: unknown): ExternalCaptureDraftData | null => {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const lines = Array.isArray(data.lines)
    ? data.lines
        .map((line) => {
          const item =
            line && typeof line === "object"
              ? (line as Record<string, unknown>)
              : {};
          return { code: asText(item.code), quantity: Number(item.quantity) };
        })
        .filter(
          (line) =>
            line.code &&
            Number.isFinite(line.quantity) &&
            line.quantity > 0,
        )
    : [];

  if (!lines.length) return null;
  return {
    transactionNumber: asText(data.transactionNumber),
    memberCode: asText(data.memberCode),
    customerName: asText(data.customerName),
    customerEmail: asText(data.customerEmail),
    ruc: asText(data.ruc),
    date: asText(data.date),
    discount: Number.isFinite(Number(data.discount)) ? Number(data.discount) : 0,
    lines,
  };
};

const normalizeContext = (
  context: ExternalCaptureDraftContext,
): ExternalCaptureDraftContext | null => {
  const companyId = Number(context.companyId);
  const userId = asText(context.userId);
  return Number.isFinite(companyId) && companyId > 0 && userId
    ? { companyId, userId }
    : null;
};

export const saveExternalCaptureDraft = (
  data: ExternalCaptureDraftData,
  context: ExternalCaptureDraftContext,
) => {
  if (typeof window === "undefined") return;
  const safeContext = normalizeContext(context);
  const safeData = normalizeData(data);
  if (!safeContext || !safeData) return;

  const draft: StoredDraft = {
    context: safeContext,
    data: safeData,
    savedAt: Date.now(),
  };
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // El formulario continúa funcionando aunque el navegador bloquee el almacenamiento.
  }
};

export const getExternalCaptureDraft = (
  context: ExternalCaptureDraftContext,
): ExternalCaptureDraftData | null => {
  if (typeof window === "undefined") return null;
  const safeContext = normalizeContext(context);
  if (!safeContext) return null;

  try {
    const stored = JSON.parse(
      window.sessionStorage.getItem(STORAGE_KEY) ?? "null",
    ) as Partial<StoredDraft> | null;
    const savedAt = Number(stored?.savedAt);
    const data = normalizeData(stored?.data);
    const sameContext =
      Number(stored?.context?.companyId) === safeContext.companyId &&
      asText(stored?.context?.userId) === safeContext.userId;
    if (
      !data ||
      !sameContext ||
      !Number.isFinite(savedAt) ||
      Date.now() - savedAt > MAX_AGE_MS
    ) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const clearExternalCaptureDraft = () => {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // No hay borrador local que limpiar si el navegador bloquea el almacenamiento.
  }
};
