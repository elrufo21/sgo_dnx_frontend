import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router";
import {
  CheckCircle2,
  ArrowLeft,
  Printer,
  Download,
  Receipt,
  RefreshCw,
  MessageCircle,
  UserPlus,
  Trash2,
  Loader2,
} from "lucide-react";
import { PDFViewer, pdf } from "@react-pdf/renderer";
import { useForm, useWatch } from "react-hook-form";
import { usePosStore, selectTotals } from "@/store/pos/pos.store";
import { toast } from "@/shared/ui/toast";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import TicketDocument from "@/components/Ticket";
import { generateTicketQrBase64 } from "@/components/ticketQr";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormAutocomplete } from "@/components/forms/HookFormAutocomplete";
import CustomerFormBase from "@/components/CustomerFormBase";
import { usePosCartDraftPersistence } from "@/features/pos/hooks/usePosCartDraftPersistence";
import { useClientsStore } from "@/store/customers/customers.store";
import { useProductsStore } from "@/store/products/products.store";
import { useDialogStore } from "@/store/app/dialog.store";
import { useBoletasSummaryStore } from "@/store/boletasSummary/boletasSummary.store";
import type { PosCartItem } from "@/types/pos";
import type { Client } from "@/types/customer";
import { buildApiUrl } from "@/config";
import {
  IGV_FACTOR,
  buildSaleMonetarySummary,
  normalizeSunatUnitCode,
  roundCurrency,
} from "@/shared/helpers/saleMonetary";

type NotaDetallePayload = {
  detalleId?: number;
  idProducto: number;
  detalleCantidad: number;
  detalleUm?: string;
  detalleDescripcion: string;
  detalleCosto: number;
  detallePrecio: number;
  detallePV?: number;
  detalleSV?: number;
  detalleImporte: number;
  detalleEstado?: string;
  valorUM?: number;
};

type LoadedNotaMonetaryTotals = {
  subtotalWithoutIgv: number;
  totalWithIgv: number;
  totalToPay: number;
};

const getCartItemKey = (item: Pick<PosCartItem, "productId" | "detalleId">) =>
  Number(item.detalleId ?? 0) || Number(item.productId ?? 0);
const hasInvalidQuantityOrStockForPayment = (item: PosCartItem) => {
  const quantity = Number(item.cantidad ?? 0);
  if (!Number.isFinite(quantity) || quantity <= 0) return true;
  return false;
};

const UNITS = [
  "",
  "UNO",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
];

const TENS = [
  "",
  "DIEZ",
  "VEINTE",
  "TREINTA",
  "CUARENTA",
  "CINCUENTA",
  "SESENTA",
  "SETENTA",
  "OCHENTA",
  "NOVENTA",
];

const SPECIALS: Record<number, string> = {
  10: "DIEZ",
  11: "ONCE",
  12: "DOCE",
  13: "TRECE",
  14: "CATORCE",
  15: "QUINCE",
  20: "VEINTE",
};

const HUNDREDS = [
  "",
  "CIENTO",
  "DOSCIENTOS",
  "TRESCIENTOS",
  "CUATROCIENTOS",
  "QUINIENTOS",
  "SEISCIENTOS",
  "SETECIENTOS",
  "OCHOCIENTOS",
  "NOVECIENTOS",
];

const threeDigitsToWords = (n: number) => {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const units = n % 10;

  const hundredPart = HUNDREDS[hundreds];
  const twoDigit = n % 100;

  if (SPECIALS[twoDigit]) {
    return [hundredPart, SPECIALS[twoDigit]].filter(Boolean).join(" ").trim();
  }

  const tensPart = TENS[tens];
  const unitPart = units === 1 && tens === 0 ? "UNO" : UNITS[units];

  if (!tensPart) {
    return [hundredPart, unitPart].filter(Boolean).join(" ").trim();
  }

  if (tens === 2 && units > 0) {
    return [hundredPart, `VEINTI${unitPart.toLowerCase()}`]
      .filter(Boolean)
      .join(" ")
      .trim()
      .toUpperCase();
  }

  const tensUnits =
    units > 0 ? `${tensPart} Y ${unitPart}` : `${tensPart}`.trim();

  return [hundredPart, tensUnits].filter(Boolean).join(" ").trim();
};

const numberToWords = (amount: number, currencyLabel = "SOLES") => {
  if (Number.isNaN(amount)) return "";
  const value = Math.max(0, Math.floor(amount * 100)) / 100;
  const integerPart = Math.floor(value);
  const cents = Math.round((value - integerPart) * 100)
    .toString()
    .padStart(2, "0");

  if (integerPart === 0) {
    return `CERO CON ${cents}/100 ${currencyLabel}`;
  }

  const millions = Math.floor(integerPart / 1_000_000);
  const thousands = Math.floor((integerPart % 1_000_000) / 1_000);
  const hundreds = integerPart % 1_000;

  const parts: string[] = [];
  if (millions > 0) {
    parts.push(
      millions === 1 ? "UN MILLON" : `${threeDigitsToWords(millions)} MILLONES`,
    );
  }
  if (thousands > 0) {
    parts.push(
      thousands === 1 ? "MIL" : `${threeDigitsToWords(thousands)} MIL`,
    );
  }
  if (hundreds > 0) {
    parts.push(threeDigitsToWords(hundreds));
  }

  return `${parts.join(" ").trim()} CON ${cents}/100 ${currencyLabel}`.toUpperCase();
};

const PaymentPage = () => {
  const { notaId: notaIdParam } = useParams<{ notaId?: string }>();
  const { pathname, search, state } = useLocation();
  const navigate = useNavigate();
  const items = usePosStore((s) => s.items);
  const totals = usePosStore(selectTotals);
  const updateQuantity = usePosStore((s) => s.updateQuantity);
  const updatePrice = usePosStore((s) => s.updatePrice);
  const removeItem = usePosStore((s) => s.removeItem);
  const setStoreItems = usePosStore((s) => s.setItems);
  const editingNotaIdFromStore = usePosStore((s) => s.editingNotaId);
  const serverItemsFromStore = usePosStore((s) => s.serverItemsFromNota);
  const isEditingMode = usePosStore((s) => s.isEditingMode);
  const setEditingNotaInStore = usePosStore((s) => s.setEditingNota);
  const setEditingModeInStore = usePosStore((s) => s.setEditingMode);
  const setServerItemsInStore = usePosStore((s) => s.setServerItemsFromNota);
  const clearEditingNota = usePosStore((s) => s.clearEditingNota);
  const clearCart = usePosStore((s) => s.clearCart);
  const openDialog = useDialogStore((s) => s.openDialog);
  const { clients, fetchClients, searchClients, addClient } = useClientsStore();
  const { fetchProducts: refetchProducts } = useProductsStore();
  const fetchBoletaSummaryDocuments = useBoletasSummaryStore(
    (s) => s.fetchDocuments,
  );
  const fetchNextBoletaSummarySequence = useBoletasSummaryStore(
    (s) => s.fetchNextSummarySequence,
  );
  const sendBoletaSummary = useBoletasSummaryStore((s) => s.sendSummary);
  const consultBoletaSummary = useBoletasSummaryStore((s) => s.consultSummary);
  const safeTrim = (value: unknown) => String(value ?? "").trim();
  const parseBooleanLikeValue = (value: unknown): boolean => {
    if (typeof value === "boolean") return value;
    const normalized = safeTrim(value).toLowerCase();
    return (
      normalized === "true" ||
      normalized === "1" ||
      normalized === "si" ||
      normalized === "sí" ||
      normalized === "verdadero" ||
      normalized === "yes" ||
      normalized === "ok"
    );
  };
  const parseRecordLikeValue = (
    value: unknown,
  ): Record<string, unknown> | null => {
    if (!value) return null;
    if (typeof value === "object") return value as Record<string, unknown>;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        return parsed && typeof parsed === "object"
          ? (parsed as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    }
    return null;
  };
  const resolveHttpStatus = (payload: unknown) => {
    const payloadRecord = parseRecordLikeValue(payload);
    const status = Number(
      payloadRecord?.response &&
        typeof payloadRecord.response === "object" &&
        payloadRecord.response !== null
        ? ((payloadRecord.response as Record<string, unknown>).status ??
            payloadRecord.status)
        : payloadRecord?.status,
    );
    return Number.isFinite(status) && status > 0 ? Math.floor(status) : 0;
  };
  const resolveSunatCode = (payload: unknown, sunatPayload?: unknown) =>
    safeTrim(
      (parseRecordLikeValue(payload)?.cod_sunat as unknown) ??
        (parseRecordLikeValue(payload)?.codSunat as unknown) ??
        (parseRecordLikeValue(payload)?.COD_SUNAT as unknown) ??
        (parseRecordLikeValue(payload)?.CodSunat as unknown) ??
        (parseRecordLikeValue(sunatPayload)?.cod_sunat as unknown) ??
        (parseRecordLikeValue(sunatPayload)?.codSunat as unknown) ??
        (parseRecordLikeValue(sunatPayload)?.COD_SUNAT as unknown) ??
        (parseRecordLikeValue(sunatPayload)?.CodSunat as unknown) ??
        "",
    );
  const resolveSunatMessage = (payload: unknown, sunatPayload?: unknown) =>
    safeTrim(
      (parseRecordLikeValue(payload)?.msj_sunat as unknown) ??
        (parseRecordLikeValue(payload)?.msjSunat as unknown) ??
        (parseRecordLikeValue(payload)?.MSJ_SUNAT as unknown) ??
        (parseRecordLikeValue(payload)?.MsjSunat as unknown) ??
        (parseRecordLikeValue(sunatPayload)?.msj_sunat as unknown) ??
        (parseRecordLikeValue(sunatPayload)?.msjSunat as unknown) ??
        (parseRecordLikeValue(sunatPayload)?.MSJ_SUNAT as unknown) ??
        (parseRecordLikeValue(sunatPayload)?.MsjSunat as unknown) ??
        (parseRecordLikeValue(sunatPayload)?.mensaje as unknown) ??
        (parseRecordLikeValue(sunatPayload)?.Mensaje as unknown) ??
        "",
    );
  const resolveApiMessage = (payload: unknown, sunatPayload?: unknown) =>
    safeTrim(
      (parseRecordLikeValue(payload)?.mensaje as unknown) ??
        (parseRecordLikeValue(payload)?.message as unknown) ??
        (parseRecordLikeValue(payload)?.Message as unknown) ??
        (parseRecordLikeValue(payload)?.title as unknown) ??
        (parseRecordLikeValue(payload)?.detail as unknown) ??
        (parseRecordLikeValue(sunatPayload)?.mensaje as unknown) ??
        (parseRecordLikeValue(sunatPayload)?.message as unknown) ??
        (parseRecordLikeValue(sunatPayload)?.Message as unknown) ??
        (parseRecordLikeValue(payload)?.response &&
        typeof parseRecordLikeValue(payload)?.response === "object"
          ? ((
              (
                parseRecordLikeValue(payload)?.response as Record<
                  string,
                  unknown
                >
              ).data as any
            )?.mensaje ??
            (
              (
                parseRecordLikeValue(payload)?.response as Record<
                  string,
                  unknown
                >
              ).data as any
            )?.message ??
            (
              (
                parseRecordLikeValue(payload)?.response as Record<
                  string,
                  unknown
                >
              ).data as any
            )?.title ??
            (
              (
                parseRecordLikeValue(payload)?.response as Record<
                  string,
                  unknown
                >
              ).data as any
            )?.detail)
          : "") ??
        (typeof payload === "string" ? payload : "") ??
        "",
    );
  const resolveRegistroBdMessage = (
    payload: unknown,
    sunatPayload?: unknown,
  ) => {
    const payloadRecord = parseRecordLikeValue(payload);
    const sunatRecord = parseRecordLikeValue(sunatPayload);
    const registroBdPayload = parseRecordLikeValue(
      payloadRecord?.registro_bd ??
        payloadRecord?.registroBd ??
        payloadRecord?.RegistroBd ??
        sunatRecord?.registro_bd ??
        sunatRecord?.registroBd ??
        sunatRecord?.RegistroBd,
    );
    return safeTrim(
      registroBdPayload?.mensaje ?? registroBdPayload?.resultado ?? "",
    );
  };
  const resolveAcceptedState = (payload: unknown, sunatPayload?: unknown) => {
    const payloadRecord = parseRecordLikeValue(payload);
    const sunatRecord = parseRecordLikeValue(sunatPayload);
    const acceptedRaw =
      payloadRecord?.aceptado ??
      payloadRecord?.Aceptado ??
      payloadRecord?.ACEPTADO ??
      sunatRecord?.aceptado ??
      sunatRecord?.Aceptado ??
      sunatRecord?.ACEPTADO;
    const hasAccepted =
      acceptedRaw !== undefined &&
      acceptedRaw !== null &&
      safeTrim(acceptedRaw) !== "";
    return {
      hasAccepted,
      accepted: hasAccepted ? parseBooleanLikeValue(acceptedRaw) : false,
    };
  };
  const buildEmissionDetail = (payload: {
    message?: string;
    code?: string;
    sunatMessage?: string;
    registroBdMessage?: string;
  }) =>
    [
      payload.message,
      payload.code,
      payload.sunatMessage,
      payload.registroBdMessage,
    ]
      .map((part) => safeTrim(part))
      .filter(Boolean)
      .join(" - ");
  const isCancelledStatusValue = (value: unknown) => {
    const normalized = safeTrim(value).toUpperCase();
    return normalized.includes("ANUL") || normalized.includes("BAJA");
  };
  const isRejectedStatusValue = (value: unknown) => {
    const normalized = safeTrim(value).toUpperCase();
    return normalized.includes("RECHAZ");
  };
  const resolveDocTypeCodeFromSerie = (serie: unknown) => {
    const normalized = safeTrim(serie).toUpperCase();
    if (!normalized) return "";
    if (normalized.startsWith("FA")) return "01";
    if (normalized.startsWith("BA")) return "03";
    if (normalized.startsWith("FN") || normalized.startsWith("BN")) return "07";
    return "";
  };
  const resolveDocTypeCodeFromName = (name: unknown) => {
    const normalized = safeTrim(name).toUpperCase();
    if (!normalized) return "";
    if (normalized.includes("CREDITO")) return "07";
    if (normalized.includes("FACTURA")) return "01";
    if (normalized.includes("BOLETA")) return "03";
    return "";
  };
  const resolveTipoComprobanteModifica = (referenceDocument: unknown) => {
    const reference = safeTrim(referenceDocument).toUpperCase();
    if (!reference) return "";
    if (reference.startsWith("FA")) return "01";
    if (reference.startsWith("BA")) return "03";
    if (reference.startsWith("NV")) return "12";
    return "";
  };
  const resolveUiNotaStatus = (notaEstado: unknown, estadoSunat: unknown) => {
    const nota = safeTrim(notaEstado);
    const sunat = safeTrim(estadoSunat);

    if (isCancelledStatusValue(sunat) || isRejectedStatusValue(sunat)) {
      return sunat || "ANULADO";
    }
    return nota || sunat || "";
  };
  const resolveEstadoSunatFromNota = (
    notaData: Record<string, unknown> | null,
  ) =>
    safeTrim(
      (notaData as any)?.estadoSunat ??
        (notaData as any)?.EstadoSunat ??
        (notaData as any)?.docuEstadoSunat ??
        (notaData as any)?.DocuEstadoSunat ??
        "",
    );
  const resolveEstadoSunatFromDetalles = (detalles: unknown[]) => {
    if (!Array.isArray(detalles)) return "";
    const firstWithState = detalles.find((detalle: any) =>
      safeTrim(
        detalle?.estadoSunat ??
          detalle?.EstadoSunat ??
          detalle?.estadoSunatDocu ??
          detalle?.EstadoSunatDocu ??
          detalle?.docuEstadoSunat ??
          detalle?.DocuEstadoSunat ??
          "",
      ),
    ) as any;

    if (!firstWithState) return "";
    return safeTrim(
      firstWithState?.estadoSunat ??
        firstWithState?.EstadoSunat ??
        firstWithState?.estadoSunatDocu ??
        firstWithState?.EstadoSunatDocu ??
        firstWithState?.docuEstadoSunat ??
        firstWithState?.DocuEstadoSunat ??
        "",
    );
  };
  const routeNotaId = useMemo(() => {
    const parsed = Number(notaIdParam ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [notaIdParam]);
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const queryMode = useMemo(() => {
    const raw = String(searchParams.get("mode") ?? "")
      .trim()
      .toLowerCase();
    if (raw === "view" || raw === "edit") return raw;
    return null;
  }, [searchParams]);
  const pathMode = useMemo(() => {
    const normalizedPath = pathname.toLowerCase();
    if (!normalizedPath.includes("/sales/order_notes/")) return null;
    if (normalizedPath.endsWith("/view")) return "view";
    if (normalizedPath.endsWith("/edit")) return "edit";
    return null;
  }, [pathname]);
  const forcedMode = pathMode ?? queryMode;
  const isOrderNotesFlow = useMemo(
    () =>
      pathname.toLowerCase().includes("/sales/order_notes/") ||
      String(searchParams.get("from") ?? "").toLowerCase() === "order_notes",
    [pathname, searchParams],
  );
  const isReadOnlyNoteView = isOrderNotesFlow && forcedMode === "view";
  const cameFromOrderNotesViewButton = useMemo(() => {
    if (!pathname.toLowerCase().includes("/sales/order_notes/")) return false;
    if (!state || typeof state !== "object") return false;
    return (state as Record<string, unknown>).fromOrderNotesViewButton === true;
  }, [pathname, state]);
  const shouldBackToOrderNotesList = isReadOnlyNoteView;
  const backRoute = shouldBackToOrderNotesList
    ? "/sales/order_notes"
    : "/sales/pos";
  const backLabel = shouldBackToOrderNotesList ? "Volver" : "Volver al POS";
  const htmlCapture = useMemo(
    () =>
      state && typeof state === "object"
        ? ((state as Record<string, unknown>).htmlCapture as
            | Record<string, unknown>
            | undefined)
        : undefined,
    [state],
  );
  const initialItems =
    serverItemsFromStore.length > 0 ? serverItemsFromStore : items;
  const [purchasedItems, setPurchasedItems] = useState(initialItems);
  const [serverItems, setServerItems] =
    useState<PosCartItem[]>(serverItemsFromStore);
  const [paidTotals, setPaidTotals] = useState(
    serverItemsFromStore.length
      ? computeTotalsFromItems(serverItemsFromStore)
      : totals,
  );
  const [canPreviewPdf, setCanPreviewPdf] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloadingComprobante, setIsDownloadingComprobante] =
    useState(false);
  const [isVoidingTicket, setIsVoidingTicket] = useState(false);
  const [isSendingCreditNote, setIsSendingCreditNote] = useState(false);
  const [isResendingDocument, setIsResendingDocument] = useState(false);
  const [notaCabeceraActual, setNotaCabeceraActual] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [notaEstadoActual, setNotaEstadoActual] = useState("");
  const [docuIdActual, setDocuIdActual] = useState<number | null>(null);
  const [loadedNotaMonetaryTotals, setLoadedNotaMonetaryTotals] =
    useState<LoadedNotaMonetaryTotals | null>(null);
  const [loadedNotePricesIncludeIgv, setLoadedNotePricesIncludeIgv] =
    useState(true);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmedFlowType, setConfirmedFlowType] = useState<
    "create" | "edit" | null
  >(null);
  const [notaId, setNotaId] = useState<number | null>(
    routeNotaId ?? editingNotaIdFromStore ?? null,
  );
  const [notaNumero, setNotaNumero] = useState<string>("");
  const [notaSerieOverride, setNotaSerieOverride] = useState<string | null>(
    null,
  );
  const [hasLoadedNotaMeta, setHasLoadedNotaMeta] = useState(false);
  const [activeTab, setActiveTab] = useState<"items" | "pdf">("items");
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 767px)").matches;
  });
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const prevApplyDiscountRef = useRef(false);
  const hasMountedApplyDiscountRef = useRef(false);
  const hasInvalidCustomerSelectionRef = useRef(false);
  const clientSearchTimerRef = useRef<number | null>(null);
  const isConfirmedRef = useRef(false);
  const isOrderNotesFlowRef = useRef(false);
  const clearCartRef = useRef(clearCart);
  const clearEditingNotaRef = useRef(clearEditingNota);
  const resetDraftForNewSaleRef = useRef<() => Promise<void>>(() =>
    Promise.resolve(),
  );
  const hasExecutedConfirmedSaleCleanupRef = useRef(false);
  const shouldCleanupOnExitAfterConfirmRef = useRef(false);

  const docTypeConfig: Record<
    "03" | "01" | "101",
    { docu: string; serie: string; label: string }
  > = {
    "03": { docu: "BOLETA", serie: "BA01", label: "Boleta" },
    "01": { docu: "FACTURA", serie: "FA01", label: "Factura" },
    "101": { docu: "PROFORMA V", serie: "0001", label: "Proforma V" },
  };

  const isPdfEnabled = !isMobileViewport;
  const resolvedNoteIdForDraft = Number(notaId ?? routeNotaId ?? 0) || 0;
  const hasResolvedNoteIdForDraft = resolvedNoteIdForDraft > 0;
  const isPosEditDraftFlow =
    !isOrderNotesFlow &&
    hasResolvedNoteIdForDraft &&
    (isEditingMode || forcedMode === "edit");
  const isPosSaleDraftFlow =
    !isOrderNotesFlow && !hasResolvedNoteIdForDraft && !isEditingMode;
  const shouldPersistPosDraft = isPosSaleDraftFlow || isPosEditDraftFlow;
  const {
    isHydrated: isPosDraftHydrated,
    markDraftAsConfirmed,
    resetDraftForNewSale,
    discardCurrentDraft,
  } = usePosCartDraftPersistence({
    enabled: shouldPersistPosDraft,
    autosave:
      shouldPersistPosDraft &&
      (isPosEditDraftFlow || (isPosSaleDraftFlow && !isConfirmed)),
    hydrateFromStorage: shouldPersistPosDraft,
    scope: isPosEditDraftFlow ? "note-edit" : "sale",
    noteId: isPosEditDraftFlow ? resolvedNoteIdForDraft : null,
  });

  isConfirmedRef.current = isConfirmed;
  isOrderNotesFlowRef.current = isOrderNotesFlow;
  clearCartRef.current = clearCart;
  clearEditingNotaRef.current = clearEditingNota;
  resetDraftForNewSaleRef.current = resetDraftForNewSale;

  const runConfirmedSaleCleanup = useCallback(() => {
    if (hasExecutedConfirmedSaleCleanupRef.current) return;
    hasExecutedConfirmedSaleCleanupRef.current = true;
    shouldCleanupOnExitAfterConfirmRef.current = false;
    clearCartRef.current();
    clearEditingNotaRef.current();
    void resetDraftForNewSaleRef.current();
  }, []);

  useEffect(() => {
    return () => {
      const shouldCleanOnExit =
        !isOrderNotesFlowRef.current &&
        isConfirmedRef.current &&
        shouldCleanupOnExitAfterConfirmRef.current;

      if (!shouldCleanOnExit) return;
      runConfirmedSaleCleanup();
    };
  }, [runConfirmedSaleCleanup]);

  useEffect(() => {
    if (!isPosEditDraftFlow || !isPosDraftHydrated) return;
    if (items.length > 0) return;

    const fallbackItems = serverItems.length ? serverItems : purchasedItems;
    if (!fallbackItems.length) return;

    setStoreItems(fallbackItems);
  }, [
    isPosDraftHydrated,
    isPosEditDraftFlow,
    items.length,
    purchasedItems,
    serverItems,
    setStoreItems,
  ]);

  const {
    companyId,
    usernameFromSession,
    discountMaxFromSession,
    companyNameFromSession,
    companyCommercialFromSession,
    companyRucFromSession,
    companyUbigeoNameFromSession,
    companyAddressSunatFromSession,
    companyUbigeoCodeFromSession,
    usuarioSolFromSession,
    claveSolFromSession,
    claveCertificadoFromSession,
    certificadoBase64FromSession,
    entornoFromSession,
    boletaPorLoteFromSession,
  } = useMemo(() => {
    if (typeof window === "undefined") {
      return {
        companyId: 1,
        usernameFromSession: "USUARIO",
        discountMaxFromSession: 0,
        companyNameFromSession: "",
        companyCommercialFromSession: "",
        companyRucFromSession: "",
        companyUbigeoNameFromSession: "",
        companyAddressSunatFromSession: "",
        companyUbigeoCodeFromSession: "",
        usuarioSolFromSession: "",
        claveSolFromSession: "",
        claveCertificadoFromSession: "",
        certificadoBase64FromSession: "",
        entornoFromSession: "",
        boletaPorLoteFromSession: false,
      };
    }

    let parsedSession: any = null;
    const sessionRaw = localStorage.getItem("sgo.auth.session");
    if (sessionRaw) {
      try {
        parsedSession = JSON.parse(sessionRaw);
      } catch {
        parsedSession = null;
      }
    }

    const companyIdRaw =
      parsedSession?.user?.companyId ?? localStorage.getItem("companiaId");
    const companyIdNum = Number(companyIdRaw);
    const safeCompanyId =
      Number.isFinite(companyIdNum) && companyIdNum > 0 ? companyIdNum : 1;

    const username =
      safeTrim(parsedSession?.user?.displayName) ||
      safeTrim(parsedSession?.user?.username) ||
      "";
    const discountMaxRaw =
      parsedSession?.user?.maxDiscount ?? parsedSession?.descuentoMax ?? 0;
    const discountMaxNumeric = Number(discountMaxRaw);
    const safeDiscountMax =
      Number.isFinite(discountMaxNumeric) && discountMaxNumeric > 0
        ? discountMaxNumeric
        : 0;
    const companyName = safeTrim(
      parsedSession?.user?.companyName ?? parsedSession?.razonSocial ?? "",
    );
    const companyCommercial = safeTrim(
      parsedSession?.user?.companyCommercialName ??
        parsedSession?.companiaComercial ??
        "",
    );
    const companyRuc = safeTrim(
      parsedSession?.user?.companyRuc ?? parsedSession?.companiaRuc ?? "",
    );
    const companyUbigeoName = safeTrim(
      parsedSession?.user?.companyUbigeoName ??
        parsedSession?.companiaNomUbg ??
        "",
    );
    const companyUbigeoCode = safeTrim(
      parsedSession?.user?.companyUbigeoCode ??
        parsedSession?.companiaCodUbg ??
        parsedSession?.companiaUbg ??
        "",
    );
    const companySunatAddress = safeTrim(
      parsedSession?.user?.companySunatAddress ??
        parsedSession?.companiaDirecSunat ??
        "",
    );
    const usuarioSol = safeTrim(
      parsedSession?.user?.usuarioSol ??
        parsedSession?.usuarioSol ??
        parsedSession?.loginPayload?.usuarioSol ??
        "",
    );
    const claveSol = safeTrim(
      parsedSession?.user?.claveSol ??
        parsedSession?.claveSol ??
        parsedSession?.loginPayload?.claveSol ??
        "",
    );
    const claveCertificado = safeTrim(
      parsedSession?.user?.claveCertificado ??
        parsedSession?.claveCertificado ??
        parsedSession?.loginPayload?.claveCertificado ??
        "",
    );
    const certificadoBase64 = safeTrim(
      parsedSession?.user?.certificadoBase64 ??
        parsedSession?.certificadoBase64 ??
        parsedSession?.loginPayload?.certificadoBase64 ??
        "",
    );
    const entorno = safeTrim(
      parsedSession?.user?.entorno ??
        parsedSession?.entorno ??
        parsedSession?.loginPayload?.entorno ??
        "",
    );
    const boletaPorLoteRaw =
      parsedSession?.user?.boletaPorLote ??
      parsedSession?.user?.BoletaPorLote ??
      parsedSession?.boletaPorLote ??
      parsedSession?.BoletaPorLote ??
      parsedSession?.loginPayload?.boletaPorLote ??
      parsedSession?.loginPayload?.BoletaPorLote ??
      false;
    const boletaPorLoteFromSession = (() => {
      if (typeof boletaPorLoteRaw === "boolean") return boletaPorLoteRaw;
      const normalized = String(boletaPorLoteRaw ?? "")
        .trim()
        .toLowerCase();
      if (
        normalized === "true" ||
        normalized === "1" ||
        normalized === "si" ||
        normalized === "yes" ||
        normalized === "verdadero"
      ) {
        return true;
      }
      if (
        normalized === "false" ||
        normalized === "0" ||
        normalized === "no" ||
        normalized === "falso"
      ) {
        return false;
      }
      const numericValue = Number(boletaPorLoteRaw);
      if (Number.isFinite(numericValue)) {
        return numericValue === 1;
      }
      return false;
    })();

    return {
      companyId: safeCompanyId,
      usernameFromSession: username || "USUARIO",
      discountMaxFromSession: safeDiscountMax,
      companyNameFromSession: companyName,
      companyCommercialFromSession: companyCommercial,
      companyRucFromSession: companyRuc,
      companyUbigeoNameFromSession: companyUbigeoName,
      companyAddressSunatFromSession: companySunatAddress,
      companyUbigeoCodeFromSession: companyUbigeoCode,
      usuarioSolFromSession: usuarioSol,
      claveSolFromSession: claveSol,
      claveCertificadoFromSession: claveCertificado,
      certificadoBase64FromSession: certificadoBase64,
      entornoFromSession: entorno,
      boletaPorLoteFromSession,
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(max-width: 767px)");
    const updateViewport = (matches: boolean) => {
      setIsMobileViewport(matches);
    };

    updateViewport(media.matches);

    const onChange = (event: MediaQueryListEvent) => {
      updateViewport(event.matches);
    };

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }

    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, []);

  useEffect(() => {
    if (!isMobileViewport) return;
    if (activeTab !== "pdf") return;
    setActiveTab("items");
  }, [activeTab, isMobileViewport]);

  useEffect(() => {
    if (!routeNotaId) return;

    if (isOrderNotesFlow) {
      setPurchasedItems([]);
      setServerItems([]);
      setPaidTotals({ subTotal: 0, total: 0, itemCount: 0 });
      setLoadedNotaMonetaryTotals(null);
      setLoadedNotePricesIncludeIgv(true);
    }

    setNotaId(routeNotaId);
    setHasLoadedNotaMeta(false);
    setEditingNotaInStore(routeNotaId);

    if (forcedMode === "view") {
      setEditingModeInStore(false);
      setIsConfirmed(true);
      setConfirmedFlowType(null);
      return;
    }

    setEditingModeInStore(true);
    setIsConfirmed(false);
    setConfirmedFlowType(null);
  }, [
    forcedMode,
    isOrderNotesFlow,
    routeNotaId,
    setEditingModeInStore,
    setEditingNotaInStore,
  ]);

  const hasLiveItems = !isOrderNotesFlow && items.length > 0;
  const itemsToRender = hasLiveItems ? items : purchasedItems;
  const totalsToRender = hasLiveItems ? totals : paidTotals;
  const canEditItems =
    !isConfirmed && !isReadOnlyNoteView && (hasLiveItems || isEditingMode);
  const ticketIdNumber = Number(notaId ?? 0);
  const hasTicketId = Number.isFinite(ticketIdNumber) && ticketIdNumber > 0;
  const previousItemsCountRef = useRef(items.length);
  const previousLocalItemsCountRef = useRef(purchasedItems.length);
  const hasRedirectedOnEmptyRef = useRef(false);
  const redirectToPosWithEmptyCart = useCallback(() => {
    if (hasRedirectedOnEmptyRef.current) return;
    hasRedirectedOnEmptyRef.current = true;
    clearCart();
    setPurchasedItems([]);
    setPaidTotals({ subTotal: 0, total: 0, itemCount: 0 });
    clearEditingNota();
    void resetDraftForNewSale()
      .catch(() => undefined)
      .finally(() => {
        navigate(backRoute, { state: { resetCart: true } });
      });
  }, [backRoute, clearCart, clearEditingNota, navigate, resetDraftForNewSale]);

  useEffect(() => {
    if (items.length > 0 || purchasedItems.length > 0) {
      hasRedirectedOnEmptyRef.current = false;
    }
  }, [items.length, purchasedItems.length]);

  useEffect(() => {
    const previousCount = previousItemsCountRef.current;
    const currentCount = items.length;
    const removedAllItems = previousCount > 0 && currentCount === 0;

    if (
      !hasRedirectedOnEmptyRef.current &&
      !isOrderNotesFlow &&
      !isConfirmed &&
      removedAllItems
    ) {
      redirectToPosWithEmptyCart();
    }

    previousItemsCountRef.current = currentCount;
  }, [isOrderNotesFlow, isConfirmed, items.length, redirectToPosWithEmptyCart]);

  useEffect(() => {
    const previousCount = previousLocalItemsCountRef.current;
    const currentCount = purchasedItems.length;
    const removedAllLocalItems = previousCount > 0 && currentCount === 0;

    if (
      !hasRedirectedOnEmptyRef.current &&
      !hasLiveItems &&
      !isOrderNotesFlow &&
      !isConfirmed &&
      removedAllLocalItems
    ) {
      redirectToPosWithEmptyCart();
    }

    previousLocalItemsCountRef.current = currentCount;
  }, [
    hasLiveItems,
    isConfirmed,
    isOrderNotesFlow,
    purchasedItems.length,
    redirectToPosWithEmptyCart,
  ]);

  const focusVerticalInput = useCallback(
    (
      sourceElement: HTMLElement,
      column: "quantity" | "price",
      currentRowIndex: number,
      direction: "up" | "down",
    ) => {
      const nextRowIndex =
        direction === "up" ? currentRowIndex - 1 : currentRowIndex + 1;

      if (nextRowIndex < 0 || nextRowIndex >= itemsToRender.length) {
        return false;
      }

      const scope = sourceElement.closest('[data-payment-items-list="true"]');
      const queryRoot = scope ?? document;
      const target = queryRoot.querySelector<HTMLInputElement>(
        `[data-payment-column="${column}"][data-payment-row-index="${nextRowIndex}"]`,
      );

      if (!target || target.disabled) {
        return false;
      }

      target.focus({ preventScroll: true });
      target.select?.();
      return true;
    },
    [itemsToRender.length],
  );

  const handleColumnArrowNavigation = useCallback(
    (
      event: KeyboardEvent<HTMLInputElement>,
      column: "quantity" | "price",
      rowIndex: number,
    ) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
        return;
      }

      event.preventDefault();
      const direction = event.key === "ArrowUp" ? "up" : "down";
      const moved = focusVerticalInput(
        event.currentTarget,
        column,
        rowIndex,
        direction,
      );
      if (!moved) {
        event.currentTarget.select?.();
      }
    },
    [focusVerticalInput],
  );

  const adjustLocalItems = (
    updater: (prev: PosCartItem[]) => PosCartItem[],
  ) => {
    setPurchasedItems((prev) => {
      const next = updater(prev);
      setPaidTotals(computeTotalsFromItems(next));
      return next;
    });
  };

  const handleQuantityChange = (item: PosCartItem, delta: number) => {
    if (!canEditItems) return;
    const itemKey = getCartItemKey(item);
    const desired = Math.max(0, (item.cantidad ?? 0) + delta);
    if (hasLiveItems) {
      updateQuantity(itemKey, desired);
      return;
    }
    adjustLocalItems((prev) =>
      prev.map((it) =>
        getCartItemKey(it) === itemKey ? { ...it, cantidad: desired } : it,
      ),
    );
  };

  const handleRemoveItem = (itemKey: number) => {
    if (!canEditItems) return;
    if (hasLiveItems) {
      removeItem(itemKey);
      return;
    }
    adjustLocalItems((prev) =>
      prev.filter((it) => getCartItemKey(it) !== itemKey),
    );
  };

  const applyPriceToItem = (item: PosCartItem, price: number) => {
    const itemKey = getCartItemKey(item);
    if (hasLiveItems) {
      updatePrice(itemKey, price);
      return;
    }
    adjustLocalItems((prev) =>
      prev.map((it) =>
        getCartItemKey(it) === itemKey ? { ...it, precio: price } : it,
      ),
    );
  };

  const handlePriceChange = (item: PosCartItem, value: string) => {
    if (!canEditItems) return;
    if (!/^\d*\.?\d*$/.test(value)) return;

    const itemKey = getCartItemKey(item);
    setPriceDrafts((prev) => ({ ...prev, [itemKey]: value }));

    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      applyPriceToItem(item, parsed);
    }
  };

  const handlePriceBlur = (item: PosCartItem, value: string) => {
    if (!canEditItems) return;

    if (value.trim() === "") {
      return;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      setPriceDrafts((prev) => ({
        ...prev,
        [getCartItemKey(item)]: String(item.precio ?? 0),
      }));
      return;
    }

    setPriceDrafts((prev) => ({
      ...prev,
      [getCartItemKey(item)]: String(parsed),
    }));
    applyPriceToItem(item, parsed);
  };

  const formMethods = useForm({
    defaultValues: {
      docTypeCode: "SELECCIONAR" as "03" | "01" | "101" | "SELECCIONAR",
      paymentMethod: "EFECTIVO" as
        | "EFECTIVO"
        | "TARJETA"
        | "TRANSFERENCIA"
        | "YAPE",
      clienteId: null as number | null,
      customerName: "",
      customerId: "",
      bankEntity: "-",
      nroOperacion: "",
      notes: "",
      applyDiscount: false,
      discount: 0,
    },
  });

  const {
    watch,
    setValue,
    setFocus,
    getValues,
    register,
    control,
    formState: { isSubmitting, dirtyFields },
  } = formMethods;

  const queueClientSearch = useCallback(
    (value: string) => {
      const term = safeTrim(value);
      if (clientSearchTimerRef.current) {
        window.clearTimeout(clientSearchTimerRef.current);
      }
      if (term.length < 2) return;
      clientSearchTimerRef.current = window.setTimeout(() => {
        void searchClients(term);
      }, 300);
    },
    [searchClients],
  );

  useEffect(
    () => () => {
      if (clientSearchTimerRef.current) {
        window.clearTimeout(clientSearchTimerRef.current);
      }
    },
    [],
  );

  const docTypeCode = watch("docTypeCode");
  const paymentMethod = watch("paymentMethod");
  const clienteId = watch("clienteId");
  const customerName = watch("customerName");
  const customerId = watch("customerId");
  const bankEntity = watch("bankEntity");
  const nroOperacion = watch("nroOperacion");
  const notes = watch("notes");
  const applyDiscount = useWatch({
    control,
    name: "applyDiscount",
    defaultValue: false,
  }) as boolean;
  const discountInput = watch("discount");

  const docLabel = docTypeCode === "01" ? "RUC" : "DNI";
  const docConfig = docTypeConfig[docTypeCode as keyof typeof docTypeConfig];
  const notaSerie = (notaSerieOverride || docConfig?.serie || "BA01").trim();
  const paddedNotaNumero = useMemo(() => {
    const digitsOnly = (notaNumero || "").replace(/\D/g, "");
    if (!digitsOnly) return "";
    const padded = digitsOnly.padStart(8, "0");
    return /^0+$/.test(padded) ? "" : padded;
  }, [notaNumero]);
  const documentNumber = useMemo(() => {
    if (!paddedNotaNumero) return "";
    const serie = notaSerie || "BA01";
    return `${serie}-${paddedNotaNumero}`;
  }, [notaSerie, paddedNotaNumero]);
  const docTypeName = docConfig?.docu ?? "BOLETA";
  const docTypeForTicket: "boleta" | "factura" | "proforma" =
    docTypeCode === "01"
      ? "factura"
      : docTypeCode === "101"
        ? "proforma"
        : "boleta";
  const isFactura = docTypeCode === "01";
  const isProforma = docTypeCode === "101";
  const normalizedNotaEstado = safeTrim(notaEstadoActual).toUpperCase();
  const resolvedDocTypeCodeForResend = (() => {
    const fromHeader = safeTrim(
      notaCabeceraActual?.codTipoDocumento ??
        notaCabeceraActual?.CodTipoDocumento ??
        notaCabeceraActual?.COD_TIPO_DOCUMENTO ??
        notaCabeceraActual?.tipoDocumento ??
        notaCabeceraActual?.TipoDocumento ??
        "",
    );
    if (fromHeader === "01" || fromHeader === "03" || fromHeader === "07") {
      return fromHeader;
    }

    const fromName = resolveDocTypeCodeFromName(
      notaCabeceraActual?.notaDocu ??
        notaCabeceraActual?.docu ??
        notaCabeceraActual?.notaTipo ??
        "",
    );
    if (fromName) return fromName;

    const fromSerie = resolveDocTypeCodeFromSerie(notaSerie);
    if (fromSerie) return fromSerie;

    if (docTypeCode === "01" || docTypeCode === "03") return docTypeCode;
    return "";
  })();
  const canManageDocumentFromOrderNotes =
    isReadOnlyNoteView || cameFromOrderNotesViewButton;
  const isNotaAnulada = isCancelledStatusValue(normalizedNotaEstado);
  const isNotaRechazada = isRejectedStatusValue(normalizedNotaEstado);
  const canVoidBoletaFromOrderNotes =
    hasTicketId &&
    canManageDocumentFromOrderNotes &&
    docTypeCode === "03" &&
    !isNotaAnulada &&
    !isNotaRechazada;
  const canVoidProformaFromOrderNotes =
    hasTicketId &&
    canManageDocumentFromOrderNotes &&
    docTypeCode === "101" &&
    !isNotaAnulada &&
    !isNotaRechazada;
  const canVoidDocumentFromOrderNotes =
    canVoidBoletaFromOrderNotes || canVoidProformaFromOrderNotes;
  const canCreateCreditNoteFromOrderNotes =
    hasTicketId &&
    canManageDocumentFromOrderNotes &&
    docTypeCode === "01" &&
    !isNotaRechazada &&
    (normalizedNotaEstado === "EMITIDO" ||
      normalizedNotaEstado === "CANCELADO" ||
      normalizedNotaEstado === "PENDIENTE");
  const canResendRejectedDocumentFromOrderNotes =
    hasTicketId &&
    canManageDocumentFromOrderNotes &&
    isNotaRechazada &&
    (resolvedDocTypeCodeForResend === "01" ||
      resolvedDocTypeCodeForResend === "03" ||
      resolvedDocTypeCodeForResend === "07");
  const canCreateBoletaCreditNoteFromOrderNotes =
    canVoidBoletaFromOrderNotes && !boletaPorLoteFromSession;
  const shouldShowCreditNoteAction =
    canCreateCreditNoteFromOrderNotes ||
    canCreateBoletaCreditNoteFromOrderNotes;
  const formLocked = isConfirmed || isReadOnlyNoteView;
  const isPersistingToDb =
    isSubmitting ||
    isVoidingTicket ||
    isSendingCreditNote ||
    isResendingDocument;
  const persistDbMessage = isSubmitting
    ? "Guardando..."
    : isVoidingTicket
      ? "Anulando documento..."
      : isSendingCreditNote
        ? "Enviando nota de credito..."
        : isResendingDocument
          ? "Reenviando documento..."
          : "Procesando...";
  const shouldShowOrderNotesDocumentAction =
    canResendRejectedDocumentFromOrderNotes ||
    canVoidDocumentFromOrderNotes ||
    canCreateCreditNoteFromOrderNotes;
  const orderNotesDocumentActionPending =
    canResendRejectedDocumentFromOrderNotes
      ? isResendingDocument
      : canCreateCreditNoteFromOrderNotes
        ? isSendingCreditNote
        : isVoidingTicket;
  const orderNotesDocumentActionClass = canResendRejectedDocumentFromOrderNotes
    ? "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
    : "border border-[#B23636]/25 bg-[#B23636]/10 text-[#B23636] hover:bg-[#B23636]/15";
  const orderNotesDocumentActionLabel = canResendRejectedDocumentFromOrderNotes
    ? isResendingDocument
      ? "Reenviando..."
      : "Reenviar documento"
    : shouldShowCreditNoteAction
      ? canCreateCreditNoteFromOrderNotes
        ? isSendingCreditNote
          ? "Enviando..."
          : "Nota de credito"
        : isVoidingTicket
          ? "Generando..."
          : "Nota de credito"
      : isVoidingTicket
        ? "Anulando..."
        : canVoidProformaFromOrderNotes
          ? "Anular proforma"
          : "Anular boleta";
  const handleOrderNotesDocumentAction = () => {
    if (canResendRejectedDocumentFromOrderNotes) {
      void handleResendDocument();
      return;
    }
    if (canCreateCreditNoteFromOrderNotes) {
      void handleOpenCreditNote();
      return;
    }
    void handleVoidTicket();
  };
  const safeItemsForFiscal = useMemo(
    () => (itemsToRender.length ? itemsToRender : purchasedItems),
    [itemsToRender, purchasedItems],
  );
  const totalAmount = useMemo(() => {
    if (!(isOrderNotesFlow && !loadedNotePricesIncludeIgv)) {
      return roundCurrency(totalsToRender?.total ?? 0);
    }

    const grossSummary = buildSaleMonetarySummary({
      lines: safeItemsForFiscal.map((item) => ({
        quantity: Number(item.cantidad ?? 0),
        unitPrice: Number(item.precio ?? 0),
        unitMeasure: item.unidadMedida ?? "UND",
      })),
      pricesIncludeIgv: false,
    });
    return roundCurrency(grossSummary.totalWithIgv);
  }, [
    isOrderNotesFlow,
    loadedNotePricesIncludeIgv,
    safeItemsForFiscal,
    totalsToRender,
  ]);
  const maxDiscount = Math.max(0, Number(discountMaxFromSession) || 0);
  const clampDiscount = useCallback(
    (value: unknown) => {
      const numeric = Number(value ?? 0);
      if (!Number.isFinite(numeric)) return 0;
      return Math.min(maxDiscount, Math.max(0, numeric));
    },
    [maxDiscount],
  );
  const viewTotalsOverride =
    isReadOnlyNoteView && loadedNotaMonetaryTotals
      ? loadedNotaMonetaryTotals
      : null;
  const descuento = viewTotalsOverride
    ? roundCurrency(Number(discountInput ?? 0))
    : roundCurrency(applyDiscount ? clampDiscount(discountInput) : 0);
  const discountedTotal = viewTotalsOverride
    ? viewTotalsOverride.totalWithIgv
    : roundCurrency(Math.max(0, totalAmount - descuento));
  const monetarySummary = useMemo(() => {
    if (isProforma) {
      const proformaLines = safeItemsForFiscal.map((item) => {
        const quantity = Number(item.cantidad ?? 0);
        const safeQuantity =
          Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
        const unitPriceWithoutIgv = roundCurrency(Number(item.precio ?? 0));
        const importeWithoutIgv = roundCurrency(
          safeQuantity * unitPriceWithoutIgv,
        );
        return {
          quantity: safeQuantity,
          unitCode: normalizeSunatUnitCode(item.unidadMedida ?? "UND"),
          unitPriceWithoutIgv,
          importeWithoutIgv,
          igv: 0,
          totalWithIgv: importeWithoutIgv,
        };
      });

      const subtotalWithoutIgv = roundCurrency(
        proformaLines.reduce((acc, line) => acc + line.importeWithoutIgv, 0),
      );
      return {
        subtotalWithoutIgv,
        igv: 0,
        totalWithIgv: subtotalWithoutIgv,
        lines: proformaLines,
      };
    }

    return buildSaleMonetarySummary({
      lines: safeItemsForFiscal.map((item) => ({
        quantity: Number(item.cantidad ?? 0),
        unitPrice: Number(item.precio ?? 0),
        unitMeasure: item.unidadMedida ?? "UND",
      })),
      pricesIncludeIgv: isOrderNotesFlow ? loadedNotePricesIncludeIgv : true,
      targetTotalWithIgv: discountedTotal,
    });
  }, [
    discountedTotal,
    isOrderNotesFlow,
    isProforma,
    loadedNotePricesIncludeIgv,
    safeItemsForFiscal,
  ]);
  const gravada = viewTotalsOverride
    ? viewTotalsOverride.subtotalWithoutIgv
    : isProforma
      ? discountedTotal
      : roundCurrency(monetarySummary.subtotalWithoutIgv);
  const igvAmount = viewTotalsOverride
    ? roundCurrency(
        viewTotalsOverride.totalWithIgv - viewTotalsOverride.subtotalWithoutIgv,
      )
    : isProforma
      ? 0
      : roundCurrency(monetarySummary.igv);
  const documentTotalWithIgv = viewTotalsOverride
    ? viewTotalsOverride.totalWithIgv
    : isProforma
      ? discountedTotal
      : roundCurrency(monetarySummary.totalWithIgv);

  const notaAdicional = viewTotalsOverride
    ? roundCurrency(
        Math.max(
          viewTotalsOverride.totalToPay - viewTotalsOverride.totalWithIgv,
          0,
        ),
      )
    : paymentMethod === "TARJETA"
      ? documentTotalWithIgv * 0.05
      : 0;
  const totalAPagar = viewTotalsOverride
    ? viewTotalsOverride.totalToPay
    : documentTotalWithIgv + notaAdicional;
  const getDisplayLineAmounts = (item: PosCartItem, rowIndex?: number) => {
    void rowIndex;
    const unitPrice = roundCurrency(Number(item.precio ?? 0));
    const totalWithIgv = roundCurrency(unitPrice * Number(item.cantidad ?? 0));
    return {
      unitPriceWithIgv: unitPrice,
      totalWithIgv,
    };
  };
  const isCash = paymentMethod === "EFECTIVO";
  const isCard = paymentMethod === "TARJETA";
  const requiresBankSelection =
    paymentMethod === "TRANSFERENCIA" || paymentMethod === "YAPE";

  const resolvedNotaUsuario = useMemo(
    () => safeTrim(usernameFromSession) || "USUARIO",
    [usernameFromSession],
  );

  useEffect(() => {
    if (!hasMountedApplyDiscountRef.current) {
      hasMountedApplyDiscountRef.current = true;
      prevApplyDiscountRef.current = applyDiscount;
      return;
    }

    const wasChecked = prevApplyDiscountRef.current;
    if (applyDiscount && !wasChecked && !formLocked) {
      let attempts = 0;
      const maxAttempts = 8;

      const focusDiscountInput = () => {
        setFocus("discount");
        const input = document.querySelector<HTMLInputElement>(
          '[data-discount-input="true"]',
        );
        if (!input || input.disabled) {
          if (attempts >= maxAttempts) return;
          attempts += 1;
          window.setTimeout(focusDiscountInput, 30);
          return;
        }

        input.focus();

        if (document.activeElement === input) {
          input.select?.();
          return;
        }

        if (attempts >= maxAttempts) return;
        attempts += 1;
        window.setTimeout(focusDiscountInput, 30);
      };

      window.requestAnimationFrame(focusDiscountInput);
    }
    prevApplyDiscountRef.current = applyDiscount;
  }, [applyDiscount, formLocked, setFocus]);

  const mapApiDetalleToItem = (detalle: any): PosCartItem => {
    const detalleId = Number(
      detalle?.detalleId ??
        detalle?.idDetalle ??
        detalle?.DetalleId ??
        detalle?.id ??
        0,
    );
    const cantidad = Number(
      detalle?.detalleCantidad ?? detalle?.cantidad ?? detalle?.Cantidad ?? 0,
    );
    const precio = Number(
      detalle?.detallePrecio ??
        detalle?.detalleCosto ??
        detalle?.precio ??
        detalle?.Precio ??
        0,
    );
    const detalleImporte = Number(
      detalle?.detalleImporte ?? detalle?.importe ?? detalle?.Importe ?? 0,
    );
    const precioMinimo = Number(
      detalle?.precioMinimo ??
        detalle?.preVentaB ??
        detalle?.PrecioMinimo ??
        detalle?.PrecioB ??
        0,
    );
    const productId = Number(
      detalle?.idProducto ??
        detalle?.productoId ??
        detalle?.productId ??
        detalle?.ProductoId ??
        0,
    );
    const valorUM = Number(
      detalle?.valorUM ?? detalle?.ValorUM ?? detalle?.factor ?? 1,
    );
    const precioFromImporte =
      Number.isFinite(detalleImporte) &&
      Number.isFinite(cantidad) &&
      cantidad > 0
        ? Number((detalleImporte / cantidad).toFixed(6))
        : Number.NaN;

    return {
      productId: Number.isFinite(productId) ? productId : 0,
      codigo:
        safeTrim(
          detalle?.codigo ??
            detalle?.productoCodigo ??
            detalle?.codigoProducto ??
            "",
        ) || String(productId || ""),
      codigoSunat: safeTrim(
        detalle?.codigoSunat ??
          detalle?.CodigoSunat ??
          detalle?.codigoSUNAT ??
          detalle?.codigo_sunat ??
          "",
      ),
      nombre:
        safeTrim(
          detalle?.detalleDescripcion ??
            detalle?.descripcion ??
            detalle?.productoNombre ??
            "",
        ) || "Producto",
      unidadMedida:
        safeTrim(detalle?.detalleUm ?? detalle?.unidadMedida ?? "") || "UND",
      precio: Math.max(
        Number.isFinite(precioFromImporte)
          ? precioFromImporte
          : Number.isFinite(precio)
            ? precio
            : 0,
        Number.isFinite(precioMinimo) ? Math.max(precioMinimo, 0) : 0,
      ),
      precioMinimo: Number.isFinite(precioMinimo)
        ? Math.max(precioMinimo, 0)
        : 0,
      cantidad: Number.isFinite(cantidad) ? cantidad : 0,
      valorUM: Number.isFinite(valorUM) && valorUM > 0 ? valorUM : 1,
      stock: Number(detalle?.stock ?? detalle?.cantidadSaldo ?? 0) || undefined,
      detalleId:
        Number.isFinite(detalleId) && detalleId > 0 ? detalleId : undefined,
    };
  };

  const getNotaAmount = (
    notaData: Record<string, unknown> | null,
    keys: string[],
  ) => {
    if (!notaData) return 0;
    for (const key of keys) {
      const rawValue = (notaData as any)?.[key];
      if (rawValue === null || rawValue === undefined || rawValue === "") {
        continue;
      }
      const value = Number(rawValue);
      if (Number.isFinite(value) && value >= 0) {
        return roundCurrency(value);
      }
    }
    return 0;
  };

  const amountsAreClose = (left: number, right: number, tolerance = 0.05) =>
    Math.abs(roundCurrency(left) - roundCurrency(right)) <= tolerance;

  const shouldConvertDetailPricesToIgvIncluded = (
    sourceItems: PosCartItem[],
    notaData: Record<string, unknown> | null,
    notaDocuRaw: string,
  ) => {
    if (!sourceItems.length) return false;
    if (safeTrim(notaDocuRaw).toUpperCase().includes("PROFORMA")) return false;

    const rawDetailTotal = roundCurrency(
      sourceItems.reduce(
        (acc, item) =>
          acc + Number(item.precio ?? 0) * Number(item.cantidad ?? 0),
        0,
      ),
    );
    if (!(rawDetailTotal > 0)) return false;

    const notaSubtotal = getNotaAmount(notaData, [
      "notaSubtotal",
      "subTotal",
      "subtotal",
      "SubTotal",
    ]);
    const notaTotal = getNotaAmount(notaData, [
      "notaTotal",
      "total",
      "Total",
      "notaPagar",
      "pagar",
      "Pagar",
    ]);
    const subtotalDerivedFromTotal =
      notaTotal > 0 ? roundCurrency(notaTotal / IGV_FACTOR) : 0;

    const alreadyIgvIncluded =
      notaTotal > 0 && amountsAreClose(rawDetailTotal, notaTotal);
    const looksLikeWithoutIgv =
      (notaSubtotal > 0 && amountsAreClose(rawDetailTotal, notaSubtotal)) ||
      (subtotalDerivedFromTotal > 0 &&
        amountsAreClose(rawDetailTotal, subtotalDerivedFromTotal)) ||
      (notaTotal > 0 &&
        amountsAreClose(roundCurrency(rawDetailTotal * IGV_FACTOR), notaTotal));

    return looksLikeWithoutIgv && !alreadyIgvIncluded;
  };

  function computeTotalsFromItems(itemsList: PosCartItem[]) {
    const subTotal = itemsList.reduce(
      (acc, item) =>
        acc + Number(item.precio ?? 0) * Number(item.cantidad ?? 0),
      0,
    );
    const itemCount = itemsList.reduce(
      (acc, item) => acc + Number(item.cantidad ?? 0),
      0,
    );
    return { subTotal, total: subTotal, itemCount };
  }

  const buildRequestDetalle = (
    currentDetails: NotaDetallePayload[],
    previousItems: PosCartItem[],
  ) => {
    const serverById = new Map<number, PosCartItem>();
    previousItems.forEach((item) => {
      if (item.detalleId && item.detalleId > 0) {
        serverById.set(item.detalleId, item);
      }
    });

    const requestDetalle: Array<Record<string, any>> = [];

    const isDifferent = (curr: NotaDetallePayload, prev: PosCartItem) => {
      const currPrice = Number(curr.detallePrecio ?? 0);
      const prevPrice = Number(prev.precio ?? 0);
      const currPriceNorm = Number(currPrice.toFixed(6));
      const prevPriceNorm = Number(prevPrice.toFixed(6));
      const prevPriceWithoutIgvNorm = Number(
        (prevPrice / IGV_FACTOR).toFixed(6),
      );
      const samePrice =
        currPriceNorm === prevPriceNorm ||
        currPriceNorm === prevPriceWithoutIgvNorm;

      return (
        Number(curr.detalleCantidad ?? 0).toFixed(4) !==
          Number(prev.cantidad ?? 0).toFixed(4) ||
        !samePrice ||
        safeTrim(curr.detalleDescripcion) !== safeTrim(prev.nombre) ||
        normalizeSunatUnitCode(curr.detalleUm) !==
          normalizeSunatUnitCode(prev.unidadMedida ?? "UND") ||
        Number(curr.valorUM ?? 1) !== Number(prev.valorUM ?? 1)
      );
    };

    currentDetails.forEach((detalle) => {
      const detalleIdRaw = Number(detalle.detalleId ?? 0);
      const detalleId =
        Number.isFinite(detalleIdRaw) && detalleIdRaw > 0 ? detalleIdRaw : 0;
      const unidadRaw = safeTrim(detalle.detalleUm ?? "") || "UND";
      const payloadBase = {
        DetalleId: detalleId,
        productId: detalle.idProducto,
        cantidad: detalle.detalleCantidad,
        unidad: unidadRaw,
        producto: detalle.detalleDescripcion,
        costo: detalle.detalleCosto,
        precio: detalle.detallePrecio,
        importe: Number(detalle.detalleImporte ?? 0),
        valorUM: detalle.valorUM ?? 1,
        DetalleEstado: detalle.detalleEstado ?? "PENDIENTE",
      };

      if (detalleId && serverById.has(detalleId)) {
        const prev = serverById.get(detalleId)!;
        if (isDifferent(detalle, prev)) {
          requestDetalle.push({ ...payloadBase, action: "update" });
        }
        serverById.delete(detalleId);
      } else {
        // Item nuevo; sin action explícito para respetar el formato esperado
        requestDetalle.push(payloadBase);
      }
    });

    serverById.forEach((item) => {
      const importe = Number(
        (item as any).detalleImporte ??
          (item as any).importe ??
          Number(item.precio ?? 0) * Number(item.cantidad ?? 0),
      );
      requestDetalle.push({
        DetalleId: item.detalleId ?? 0,
        productId: item.productId,
        cantidad: item.cantidad,
        unidad: safeTrim(item.unidadMedida ?? "") || "UND",
        producto: item.nombre,
        costo: item.precio,
        precio: item.precio,
        importe,
        valorUM:
          Number.isFinite(Number(item.valorUM)) && Number(item.valorUM) > 0
            ? Number(item.valorUM)
            : 1,
        DetalleEstado: "PENDIENTE",
        action: "delete",
      });
    });

    return requestDetalle.length ? requestDetalle : null;
  };
  const fetchNotaFromServer = async (notaIdToLoad: number) => {
    if (!Number.isFinite(notaIdToLoad) || notaIdToLoad <= 0) return;
    setNotaEstadoActual("");
    setDocuIdActual(null);
    setNotaCabeceraActual(null);

    try {
      const [notaResponse, detallesResponse] = await Promise.all([
        apiRequest({
          url: buildApiUrl(`/Nota/${notaIdToLoad}`),
          method: "GET",
          config: { headers: { Accept: "text/plain" } },
          fallback: null,
        }),
        apiRequest({
          url: buildApiUrl(`/Nota/${notaIdToLoad}/detalles`),
          method: "GET",
          config: { headers: { Accept: "text/plain" } },
          fallback: [],
        }),
      ]);

      if (!Array.isArray(detallesResponse)) {
        throw new Error("No se pudo obtener los detalles de la nota.");
      }

      const notaRaw =
        (notaResponse as any)?.nota ?? (notaResponse as any) ?? null;
      const notaData =
        notaRaw && typeof notaRaw === "object" && !(notaRaw instanceof Error)
          ? notaRaw
          : null;

      const notaDocuRaw = safeTrim(
        (notaData as any)?.notaDocu ??
          (notaData as any)?.docu ??
          (notaData as any)?.notaTipo ??
          "",
      );
      const estadoSunatFromNota = resolveEstadoSunatFromNota(notaData);
      const estadoSunatFromDetalles =
        resolveEstadoSunatFromDetalles(detallesResponse);
      const mappedServerItems = detallesResponse.map(mapApiDetalleToItem);
      const serverLooksWithoutIgv = shouldConvertDetailPricesToIgvIncluded(
        mappedServerItems,
        notaData,
        notaDocuRaw,
      );
      // En flujo de notas no reconvertimos precios en frontend:
      // usamos exactamente lo guardado en detalle para evitar descuadres.
      const mappedDisplayItems = mappedServerItems;
      setLoadedNotePricesIncludeIgv(!serverLooksWithoutIgv);

      setPurchasedItems(mappedDisplayItems);
      setPaidTotals(computeTotalsFromItems(mappedDisplayItems));
      setServerItems(mappedServerItems);
      setServerItemsInStore(mappedServerItems);
      setEditingNotaInStore(notaIdToLoad);
      const shouldSeedStoreForEdit =
        !isOrderNotesFlow && (forcedMode === "edit" || isEditingMode);
      if (shouldSeedStoreForEdit) {
        const currentStoreItems = usePosStore.getState().items;
        if (!currentStoreItems.length && mappedDisplayItems.length) {
          setStoreItems(mappedDisplayItems);
        }
      }

      if (notaData) {
        setNotaCabeceraActual(notaData as Record<string, unknown>);
        const resolvedDocuId = Number(
          (notaData as any).docuId ??
            (notaData as any).DocuId ??
            (notaData as any).documentoVentaId ??
            (notaData as any).DocumentoVentaId ??
            (notaData as any).idDocumentoVenta ??
            (notaData as any).IdDocumentoVenta ??
            0,
        );
        setDocuIdActual(
          Number.isFinite(resolvedDocuId) && resolvedDocuId > 0
            ? resolvedDocuId
            : null,
        );

        const loadedSubtotal = getNotaAmount(notaData, [
          "notaSubtotal",
          "subTotal",
          "subtotal",
          "SubTotal",
        ]);
        const loadedTotal = getNotaAmount(notaData, [
          "notaTotal",
          "total",
          "Total",
        ]);
        const loadedPagar = getNotaAmount(notaData, [
          "notaPagar",
          "pagar",
          "Pagar",
        ]);
        const finalTotal = loadedTotal > 0 ? loadedTotal : loadedPagar;
        if (finalTotal > 0) {
          const finalSubtotal =
            loadedSubtotal > 0
              ? loadedSubtotal
              : roundCurrency(finalTotal / IGV_FACTOR);
          const rawToPay = loadedPagar > 0 ? loadedPagar : finalTotal;
          const finalToPay = amountsAreClose(rawToPay, finalTotal)
            ? finalTotal
            : rawToPay;
          setLoadedNotaMonetaryTotals({
            subtotalWithoutIgv: finalSubtotal,
            totalWithIgv: finalTotal,
            totalToPay: finalToPay,
          });
        } else {
          setLoadedNotaMonetaryTotals(null);
        }

        setNotaEstadoActual(
          resolveUiNotaStatus(
            (notaData as any).notaEstado ?? (notaData as any).estado ?? "",
            estadoSunatFromNota || estadoSunatFromDetalles,
          ),
        );

        const notaDocu = notaDocuRaw;
        if (notaDocu) {
          const match = Object.entries(docTypeConfig).find(
            ([, cfg]) =>
              safeTrim(cfg.docu).toUpperCase() === notaDocu.toUpperCase(),
          );
          if (match) {
            setValue("docTypeCode", match[0] as any, { shouldDirty: false });
          }
        }

        const notaClienteId = Number(
          (notaData as any).clienteId ?? (notaData as any).ClienteId ?? 0,
        );
        if (Number.isFinite(notaClienteId) && notaClienteId > 0) {
          setValue("clienteId", notaClienteId, { shouldDirty: false });
        }

        const notaClienteNombre = safeTrim(
          (notaData as any).clienteNombre ??
            (notaData as any).clienteRazon ??
            (notaData as any).clienteRazonSocial ??
            "",
        );
        if (notaClienteNombre) {
          setValue("customerName", notaClienteNombre, { shouldDirty: false });
        }

        const notaDocValue =
          safeTrim(
            (notaData as any).clienteRuc ??
              (notaData as any).clienteDni ??
              (notaData as any).notaRuc ??
              (notaData as any).notaDni ??
              "",
          ) || "";
        if (notaDocValue) {
          setValue("customerId", notaDocValue, { shouldDirty: false });
        }

        const serieNota = safeTrim(
          (notaData as any).notaSerie ?? (notaData as any).serie ?? "",
        );
        if (serieNota) {
          setNotaSerieOverride(serieNota);
        }

        const notaNumeroRaw = safeTrim(
          (notaData as any).notaNumero ?? (notaData as any).numero ?? "",
        );
        const notaNumeroDigits = notaNumeroRaw.replace(/\D/g, "");
        if (notaNumeroDigits) {
          setNotaNumero(notaNumeroDigits.padStart(8, "0"));
        }

        const formaPago = safeTrim(
          (notaData as any).notaFormaPago ?? (notaData as any).formaPago ?? "",
        );
        if (formaPago) {
          setValue("paymentMethod", formaPago as any, { shouldDirty: false });
        }

        const banco = safeTrim(
          (notaData as any).entidadBancaria ?? (notaData as any).banco ?? "",
        );
        if (banco) {
          setValue("bankEntity", banco, { shouldDirty: false });
        }

        const nroOperacionNota = safeTrim(
          (notaData as any).nroOperacion ??
            (notaData as any).numeroOperacion ??
            "",
        );
        if (nroOperacionNota) {
          setValue("nroOperacion", nroOperacionNota, { shouldDirty: false });
        }

        const descuentoNota = Number(
          (notaData as any).notaDescuento ?? (notaData as any).descuento ?? 0,
        );
        if (Number.isFinite(descuentoNota) && descuentoNota > 0) {
          setValue("applyDiscount", true, { shouldDirty: false });
          setValue("discount", descuentoNota, { shouldDirty: false });
        }
      }
      if (!notaData && estadoSunatFromDetalles) {
        setNotaEstadoActual(resolveUiNotaStatus("", estadoSunatFromDetalles));
      }
    } catch (error) {
      console.error("Error al cargar la nota por id", error);
      toast.error("No se pudo sincronizar la nota creada.");
      setLoadedNotaMonetaryTotals(null);
      setLoadedNotePricesIncludeIgv(true);
    }
  };

  useEffect(() => {
    const currentBank = String(getValues("bankEntity") ?? "").trim();
    if (paymentMethod === "EFECTIVO") {
      if (currentBank !== "-") {
        setValue("bankEntity", "-", { shouldDirty: false });
      }
      setValue("nroOperacion", "", { shouldDirty: false });
    } else if (paymentMethod === "TARJETA") {
      if (!currentBank || currentBank === "-") {
        setValue("bankEntity", "BCP", { shouldDirty: false });
      }
      setValue("nroOperacion", "", { shouldDirty: false });
    } else {
      if (currentBank === "-") {
        setValue("bankEntity", "", { shouldDirty: false });
      }
    }
  }, [getValues, paymentMethod, setValue]);

  const lastDocTypeRef = useRef<string | null>(null);
  const defaultCustomerAppliedRef = useRef(false);

  useEffect(() => {
    if (!htmlCapture || typeof htmlCapture !== "object") return;

    const data = htmlCapture;
    const rucText = safeTrim(data.ruc);
    const memberCode = safeTrim(data.memberCode);
    const customer = safeTrim(data.customerName);
    const transaction = safeTrim(data.transactionNumber);
    const date = safeTrim(data.date);
    const docValue =
      rucText
        .replace(/FACTURA|BOLETA|RUC|DNI|DOCUMENTO|:/gi, " ")
        .match(/\d{8,11}/)?.[0] ?? memberCode;

    if (rucText.toUpperCase().includes("FACTURA") || docValue.length === 11) {
      setValue("docTypeCode", "01", { shouldDirty: false });
    } else {
      setValue("docTypeCode", "03", { shouldDirty: false });
    }
    if (customer) setValue("customerName", customer, { shouldDirty: false });
    if (docValue) setValue("customerId", docValue, { shouldDirty: false });

    const discount = Number(data.discount ?? 0);
    if (Number.isFinite(discount) && discount > 0) {
      setValue("applyDiscount", true, { shouldDirty: false });
      setValue("discount", discount, { shouldDirty: false });
    }

    const notes = [
      transaction ? `Transaccion: ${transaction}` : "",
      memberCode ? `Membresia: ${memberCode}` : "",
      date ? `Fecha HTML: ${date}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
    if (notes && !safeTrim(getValues("notes"))) {
      setValue("notes", notes, { shouldDirty: false });
    }

    defaultCustomerAppliedRef.current = true;
  }, [getValues, htmlCapture, setValue]);

  useEffect(() => {
    if (!clients.length) {
      fetchClients();
    }
  }, [clients.length, fetchClients]);

  // En nuevo registro, preselecciona cliente ID 1 (sin afectar edici�n)
  useEffect(() => {
    if (notaId || isEditingMode || hasLoadedNotaMeta) return;
    if (defaultCustomerAppliedRef.current) return;
    const hasClientAlready =
      Number(clienteId) > 0 || safeTrim(customerName) || safeTrim(customerId);
    if (hasClientAlready) return;

    const defaultClient =
      clients.find((c) => Number(c.id) === 1) ??
      ({} as (typeof clients)[number]);

    const defaultId = Number(defaultClient?.id ?? 1);
    if (Number.isFinite(defaultId) && defaultId > 0) {
      setValue("clienteId", defaultId, { shouldDirty: false });
    }

    const defaultName = safeTrim((defaultClient as any)?.nombreRazon ?? "");
    if (defaultName) {
      setValue("customerName", defaultName, { shouldDirty: false });
    }

    const defaultDoc =
      docTypeCode === "01"
        ? safeTrim((defaultClient as any)?.ruc ?? "")
        : safeTrim((defaultClient as any)?.dni ?? "");
    if (defaultDoc) {
      setValue("customerId", defaultDoc, { shouldDirty: false });
    }

    defaultCustomerAppliedRef.current = true;
  }, [
    notaId,
    isEditingMode,
    hasLoadedNotaMeta,
    clienteId,
    customerName,
    customerId,
    clients,
    docTypeCode,
    setValue,
  ]);

  // Hidratamos nombre/documento del cliente al volver con datos de nota
  useEffect(() => {
    if (!hasLoadedNotaMeta) return;
    if (dirtyFields?.customerName || dirtyFields?.customerId) return;
    const clientIdNumeric = Number(clienteId);
    if (!Number.isFinite(clientIdNumeric) || clientIdNumeric <= 0) return;
    const client = clients.find((c) => Number(c.id) === clientIdNumeric);
    if (!client) return;

    const currentName = safeTrim(customerName);
    const currentDoc = safeTrim(customerId);
    const suggestedName = safeTrim(client.nombreRazon ?? "");
    const suggestedDoc =
      docTypeCode === "01"
        ? safeTrim((client as any).ruc ?? "")
        : safeTrim(client.dni ?? "");

    if (!currentName && suggestedName) {
      setValue("customerName", suggestedName, { shouldDirty: false });
    }
    if (!currentDoc && suggestedDoc) {
      setValue("customerId", suggestedDoc, { shouldDirty: false });
    }
  }, [
    hasLoadedNotaMeta,
    clienteId,
    clients,
    docTypeCode,
    dirtyFields?.customerName,
    dirtyFields?.customerId,
    setValue,
  ]);

  useEffect(() => {
    if (!applyDiscount) {
      if (Number(discountInput ?? 0) !== 0) {
        setValue("discount", 0, { shouldDirty: true, shouldValidate: true });
      }
      return;
    }

    const currentValue = Number(discountInput ?? 0);
    const clampedValue = clampDiscount(discountInput);
    if (!Number.isFinite(currentValue) || currentValue !== clampedValue) {
      setValue("discount", clampedValue, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [applyDiscount, discountInput, clampDiscount, setValue]);

  useEffect(() => {
    // Solo resetea en flujo nuevo; en edicion o con cliente cargado no limpiar
    if (!dirtyFields?.docTypeCode) {
      lastDocTypeRef.current = docTypeCode;
      return;
    }

    const previousDocType = lastDocTypeRef.current;
    lastDocTypeRef.current = docTypeCode;

    // Al cambiar a Factura, no autoseleccionar cliente: limpiar seleccion previa.
    if (docTypeCode !== "01" || previousDocType === docTypeCode) return;
    if (notaId || isEditingMode || hasLoadedNotaMeta) return;

    setValue("clienteId", null, { shouldDirty: false });
    setValue("customerName", "", { shouldDirty: false });
    setValue("customerId", "", { shouldDirty: false });
    hasInvalidCustomerSelectionRef.current = false;
  }, [
    docTypeCode,
    dirtyFields?.docTypeCode,
    notaId,
    isEditingMode,
    hasLoadedNotaMeta,
    setValue,
  ]);

  // Asegura que el formulario siga editable mientras no se haya confirmado
  useEffect(() => {
    if (!notaId) {
      setIsConfirmed(false);
    }
  }, [notaId, items.length]);

  const setClienteIdFromOption = useCallback(
    (opt: any, options?: { shouldDirty?: boolean }) => {
      const shouldDirty = options?.shouldDirty ?? true;
      const candidate = opt?.id ?? opt?.clienteId ?? opt?.clientId;
      const numeric = Number(candidate);
      if (Number.isFinite(numeric) && numeric > 0) {
        setValue("clienteId", numeric, { shouldDirty });
        return;
      }

      setValue("clienteId", null, { shouldDirty });
    },
    [setValue],
  );

  // Si el usuario borra manualmente el DNI/RUC, se mantiene el nombre
  // y solo se desvincula clienteId para no rehidratar el documento anterior.
  useEffect(() => {
    if (!dirtyFields?.customerId) return;
    if (safeTrim(customerId)) return;
    if (Number(clienteId) <= 0) return;
    setClienteIdFromOption(null, { shouldDirty: true });
  }, [customerId, clienteId, dirtyFields?.customerId, setClienteIdFromOption]);

  const handleOpenCreateClientModal = useCallback(() => {
    if (formLocked) return;

    openDialog({
      title: "Registrar cliente",
      maxWidth: "lg",
      fullWidth: true,
      confirmText: "Guardar",
      cancelText: "Cancelar",
      content: (
        <CustomerFormBase
          mode="create"
          variant="modal"
          onSave={async () => false}
          onNew={() => {}}
        />
      ),
      onConfirm: async (rawData) => {
        const data = (rawData ?? {}) as Partial<Client>;
        const payload: Omit<Client, "id"> = {
          clienteCodigo: safeTrim(data.clienteCodigo),
          nombreRazon: safeTrim(data.nombreRazon).toUpperCase(),
          ruc: safeTrim(data.ruc),
          dni: safeTrim(data.dni),
          direccionFiscal: safeTrim(data.direccionFiscal),
          direccionDespacho: safeTrim(data.direccionDespacho),
          telefonoMovil: safeTrim(data.telefonoMovil),
          email: safeTrim(data.email),
          registradoPor: safeTrim(data.registradoPor) || resolvedNotaUsuario,
          estado: safeTrim(data.estado) || "ACTIVO",
          fecha: data.fecha ?? null,
        };

        if (!payload.nombreRazon) {
          toast.error("El nombre o razon social es obligatorio.");
          return false;
        }

        const result = await addClient(payload);
        if (!result.ok) {
          toast.error(result.error ?? "No se pudo crear el cliente.");
          return false;
        }

        const normalizedName = safeTrim(payload.nombreRazon).toLowerCase();
        const normalizedRuc = safeTrim(payload.ruc);
        const normalizedDni = safeTrim(payload.dni);
        const refreshedClients = await searchClients(
          normalizedRuc || normalizedDni || normalizedName,
          "ACTIVO",
          10,
        );

        const createdClient =
          refreshedClients.find((client) => {
            const clientRuc = safeTrim(client.ruc);
            const clientDni = safeTrim(client.dni);
            const clientName = safeTrim(client.nombreRazon).toLowerCase();
            return (
              (normalizedRuc && clientRuc === normalizedRuc) ||
              (normalizedDni && clientDni === normalizedDni) ||
              (!!normalizedName && clientName === normalizedName)
            );
          }) ?? null;

        const selectedName =
          safeTrim(createdClient?.nombreRazon) || payload.nombreRazon;
        const selectedDoc =
          docTypeCode === "01"
            ? safeTrim(createdClient?.ruc) ||
              safeTrim(createdClient?.dni) ||
              payload.ruc ||
              payload.dni
            : safeTrim(createdClient?.dni) ||
              safeTrim(createdClient?.ruc) ||
              payload.dni ||
              payload.ruc;

        setValue("customerName", selectedName, { shouldDirty: true });
        setValue("customerId", selectedDoc, { shouldDirty: true });
        setClienteIdFromOption({
          id: createdClient?.id ?? null,
          clienteId: createdClient?.id ?? null,
        });
        toast.success("Cliente creado correctamente.");
        return true;
      },
    });
  }, [
    addClient,
    docTypeCode,
    fetchClients,
    formLocked,
    openDialog,
    resolvedNotaUsuario,
    searchClients,
    setClienteIdFromOption,
    setValue,
  ]);

  const confirmWithAppDialog = useCallback(
    ({
      title,
      content,
      confirmText,
      cancelText = "Cancelar",
    }: {
      title: string;
      content: ReactNode;
      confirmText: string;
      cancelText?: string;
    }) =>
      new Promise<boolean>((resolve) => {
        openDialog({
          title,
          content,
          confirmText,
          cancelText,
          onConfirm: () => {
            resolve(true);
          },
          onCancel: () => {
            resolve(false);
          },
        });
      }),
    [openDialog],
  );

  const uniqueClients = useMemo(() => {
    const seen = new Set<string>();
    const result: typeof clients = [];
    clients.forEach((client, index) => {
      const dniKey = client.dni ? safeTrim(client.dni) : "";
      const rucKey = (client as any).ruc ? safeTrim((client as any).ruc) : "";
      const idKey =
        client.id !== undefined && client.id !== null ? `id-${client.id}` : "";
      const nameKey = client.nombreRazon ? `name-${client.nombreRazon}` : "";
      const key =
        (dniKey && `dni-${dniKey}`) ||
        (rucKey && `ruc-${rucKey}`) ||
        idKey ||
        nameKey ||
        `idx-${index}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push(client);
    });
    return result;
  }, [clients]);

  const clientOptions = useMemo(
    () =>
      uniqueClients.map((client) => ({
        value: client.nombreRazon ?? "",
        label: client.nombreRazon ?? "",
        dni: client.dni ?? "",
        ruc: client.ruc ?? "",
        id: client.id,
      })),
    [uniqueClients],
  );

  const facturaClientOptions = useMemo(
    () =>
      clientOptions.filter(
        (client) => safeTrim(client.label).toUpperCase() !== "VARIOS",
      ),
    [clientOptions],
  );

  const dniOptions = useMemo(
    () =>
      uniqueClients
        .filter((client) => client.dni?.trim())
        .map((client) => ({
          value: (client.dni ?? "").trim(),
          label: (client.dni ?? "").trim(),
          dni: (client.dni ?? "").trim(),
          nombreRazon: (client.nombreRazon ?? "").trim(),
          id: client.id,
        })),
    [uniqueClients],
  );

  const rucOptions = useMemo(
    () =>
      uniqueClients
        .filter((client) => client.ruc?.trim())
        .map((client) => ({
          value: (client.ruc ?? "").trim(),
          label: (client.ruc ?? "").trim(),
          ruc: (client.ruc ?? "").trim(),
          nombreRazon: (client.nombreRazon ?? "").trim(),
          id: client.id,
        })),
    [uniqueClients],
  );

  const facturaRucOptions = useMemo(
    () =>
      rucOptions.filter(
        (option) => safeTrim(option.nombreRazon).toUpperCase() !== "VARIOS",
      ),
    [rucOptions],
  );

  const selectedDocument = useMemo(() => {
    const source = docTypeCode === "01" ? rucOptions : dniOptions;
    const match = source.find(
      (opt) => String(opt.value) === String(customerId),
    );
    if (match?.label) return match.label;
    return typeof customerId === "string" ? customerId : "";
  }, [customerId, docTypeCode, dniOptions, rucOptions]);

  const ensureExistingCustomerByName = useCallback(
    (rawName?: string) => {
      if (formLocked) return true;

      const currentNameFromForm = safeTrim(getValues("customerName"));
      const typedName = safeTrim(rawName ?? currentNameFromForm);
      if (!typedName) {
        if (!hasInvalidCustomerSelectionRef.current) return true;
        window.requestAnimationFrame(() => {
          setFocus("customerName");
        });
        return false;
      }

      const typedNameNormalized = typedName.toLowerCase();
      const availableClients =
        docTypeCode === "01" ? facturaClientOptions : clientOptions;
      const matchedOption = availableClients.find(
        (opt) => safeTrim(opt.label).toLowerCase() === typedNameNormalized,
      );

      if (!matchedOption) {
        hasInvalidCustomerSelectionRef.current = true;
        toast.error(
          "Intentaste seleccionar un cliente que no existe, por favor agrega el cliente y seleccionalo.",
        );
        setValue("customerName", "", { shouldDirty: true });
        setValue("customerId", "", { shouldDirty: true });
        setClienteIdFromOption(null, { shouldDirty: true });
        window.requestAnimationFrame(() => {
          setFocus("customerName");
        });
        return false;
      }

      hasInvalidCustomerSelectionRef.current = false;
      const selectedName = safeTrim(matchedOption.label ?? "");
      const docValue =
        docTypeCode === "01"
          ? safeTrim((matchedOption as any).ruc ?? "")
          : safeTrim((matchedOption as any).dni ?? "");

      setValue("customerName", selectedName, { shouldDirty: true });
      setValue("customerId", docValue || "", { shouldDirty: true });
      setClienteIdFromOption(matchedOption, { shouldDirty: true });
      return true;
    },
    [
      formLocked,
      clientOptions,
      facturaClientOptions,
      docTypeCode,
      getValues,
      setValue,
      setFocus,
      setClienteIdFromOption,
    ],
  );

  // Sincronizacion consistente: si hay clienteId seleccionado, nombre/documento
  // se alinean a ese cliente (especialmente al cambiar tipo de documento).
  useEffect(() => {
    const clientIdNumeric = Number(clienteId);
    if (!Number.isFinite(clientIdNumeric) || clientIdNumeric <= 0) return;

    const clientById = uniqueClients.find(
      (client) => Number(client.id) === clientIdNumeric,
    );
    if (!clientById) return;

    const nameFromId = safeTrim(clientById.nombreRazon ?? "");
    const docFromId =
      docTypeCode === "01"
        ? safeTrim((clientById as any).ruc ?? "")
        : safeTrim((clientById as any).dni ?? "");

    if (nameFromId && safeTrim(customerName) !== nameFromId) {
      setValue("customerName", nameFromId, { shouldDirty: false });
    }

    if (safeTrim(customerId) !== docFromId) {
      setValue("customerId", docFromId, { shouldDirty: false });
    }
  }, [
    clienteId,
    docTypeCode,
    uniqueClients,
    customerName,
    customerId,
    setValue,
  ]);

  const resolveDocumentValue = useCallback(
    (value: any, type: "dni" | "ruc") => {
      const source = type === "ruc" ? rucOptions : dniOptions;
      const match = source.find(
        (opt) => String(opt.value) === String((value as any)?.value ?? value),
      );

      const docFromMatch = match
        ? safeTrim(
            type === "ruc"
              ? ((match as any).ruc ?? match.label ?? "")
              : ((match as any).dni ?? match.label ?? ""),
          )
        : "";

      if (docFromMatch) return docFromMatch;

      const fallback =
        (value as any)?.inputValue ??
        (value as any)?.label ??
        (value as any)?.value ??
        value;

      return safeTrim(fallback);
    },
    [dniOptions, rucOptions],
  );

  const validateDniLength = useCallback(
    (value: any) => {
      const doc = resolveDocumentValue(value, "dni");
      if (!doc) return true;
      return /^\d{8}$/.test(doc) || "El DNI debe tener 8 digitos";
    },
    [resolveDocumentValue],
  );

  const validateRucLength = useCallback(
    (value: any) => {
      const doc = resolveDocumentValue(value, "ruc");
      if (!doc) return "El RUC es obligatorio para Factura";
      return /^\d{11}$/.test(doc) || "El RUC debe tener 11 digitos";
    },
    [resolveDocumentValue],
  );

  const ensureFacturaCustomerAndRuc = useCallback(() => {
    if (docTypeCode !== "01") return true;

    const selectedClientId = Number(getValues("clienteId") ?? 0);
    const selectedName = safeTrim(getValues("customerName"));
    const resolvedRuc = resolveDocumentValue(getValues("customerId"), "ruc");
    const ruc = safeTrim(resolvedRuc);

    if (!selectedName || selectedName.toUpperCase() === "VARIOS") {
      toast.error(
        "Para Factura el nombre del cliente es obligatorio y no puede ser VARIOS.",
      );
      window.requestAnimationFrame(() => {
        setFocus("customerName");
      });
      return false;
    }

    if (selectedClientId <= 0) {
      toast.error("Para Factura debes seleccionar un cliente valido.");
      window.requestAnimationFrame(() => {
        setFocus("customerName");
      });
      return false;
    }

    if (!/^\d{11}$/.test(ruc)) {
      toast.error("Para Factura debes ingresar un RUC valido de 11 digitos.");
      window.requestAnimationFrame(() => {
        setFocus("customerId");
      });
      return false;
    }

    return true;
  }, [docTypeCode, getValues, resolveDocumentValue, setFocus]);
  const documentFilterOptions = useCallback(
    (
      options: Array<(typeof dniOptions)[number] | (typeof rucOptions)[number]>,
      state: { inputValue: string },
    ) => {
      const input = (state.inputValue ?? "").trim().toLowerCase();
      const filtered = options.filter((opt) => {
        const label = (opt.label ?? "").toLowerCase();
        const valueStr = String(opt.value ?? "").toLowerCase();
        const docStr = (
          (opt as any)?.dni ??
          (opt as any)?.ruc ??
          opt.label ??
          ""
        )
          .toString()
          .toLowerCase();
        return (
          input === "" ||
          label.includes(input) ||
          valueStr.includes(input) ||
          docStr.includes(input)
        );
      });

      if (input) {
        const exists = filtered.some((opt) => {
          const label = (opt.label ?? "").toLowerCase();
          const valueStr = String(opt.value ?? "").toLowerCase();
          const docStr = (
            (opt as any)?.dni ??
            (opt as any)?.ruc ??
            opt.label ??
            ""
          )
            .toString()
            .toLowerCase();
          return label === input || valueStr === input || docStr === input;
        });

        if (!exists) {
          filtered.push({
            label: `Usar ${docLabel}: ${state.inputValue}`,
            value: state.inputValue,
            inputValue: state.inputValue,
          } as any);
        }
      }

      return filtered;
    },
    [docLabel],
  );

  const ticketPreviewProps = useMemo(() => {
    const safeItems = itemsToRender.length ? itemsToRender : purchasedItems;
    const safeTotals = itemsToRender.length ? totalsToRender : paidTotals;
    const selectedClientById = uniqueClients.find(
      (client) => Number(client.id) === Number(clienteId),
    );
    const selectedClientByName = uniqueClients.find(
      (client) =>
        safeTrim(client.nombreRazon).toLowerCase() ===
        safeTrim(customerName).toLowerCase(),
    );
    const selectedClient = selectedClientById ?? selectedClientByName ?? null;
    return {
      clientName: safeTrim(customerName) || "Ultimo cliente",
      clientId: safeTrim(selectedDocument),
      clientAddress:
        safeTrim((selectedClient as any)?.direccionFiscal ?? "") ||
        safeTrim((selectedClient as any)?.direccionDespacho ?? "") ||
        "-",
      docType: docTypeForTicket,
      paymentMethod,
      items: safeItems,
      totals: safeTotals,
      noteId: notaId,
      summary: {
        operacionGravada: Number(gravada.toFixed(2)),
        descuento: Number(descuento.toFixed(2)),
        showDiscount: applyDiscount,
        subtotal: Number(gravada.toFixed(2)),
        igv: Number(igvAmount.toFixed(2)),
        total: Number(totalAPagar.toFixed(2)),
      },
      documentNumber,
      companyName:
        companyCommercialFromSession ||
        companyNameFromSession ||
        "CONSORCIO FERRETERO ROSITA E.I.R.L.",
      companyRuc: companyRucFromSession || "20601070155",
      companyAddress: companyAddressSunatFromSession || "Calle 2 Mz B Lote 1",
      companyDistrict: companyUbigeoNameFromSession || "LIMA",
    };
  }, [
    selectedDocument,
    uniqueClients,
    clienteId,
    customerName,
    docTypeForTicket,
    documentNumber,
    notaId,
    paymentMethod,
    itemsToRender,
    totalsToRender,
    purchasedItems,
    paidTotals,
    gravada,
    descuento,
    applyDiscount,
    documentTotalWithIgv,
    igvAmount,
    totalAPagar,
    companyCommercialFromSession,
    companyNameFromSession,
    companyRucFromSession,
    companyAddressSunatFromSession,
    companyUbigeoNameFromSession,
  ]);
  const previewKey = useMemo(
    () =>
      [
        docTypeCode,
        paymentMethod,
        ticketPreviewProps.clientName,
        ticketPreviewProps.clientId,
        ticketPreviewProps.documentNumber,
        totalAPagar.toFixed(2),
        descuento.toFixed(2),
        itemsToRender.length,
      ].join("|"),
    [
      docTypeCode,
      itemsToRender.length,
      paymentMethod,
      ticketPreviewProps.clientId,
      ticketPreviewProps.clientName,
      ticketPreviewProps.documentNumber,
      totalAPagar,
      descuento,
    ],
  );

  const notaPayload = useMemo(() => {
    const now = new Date();
    const today = getLocalDateISO(now);
    const safeItems = safeItemsForFiscal;
    const base = gravada;
    const clienteIdNumber = Number(clienteId ?? 1) || 1;
    const captureTransaction = safeTrim(htmlCapture?.transactionNumber);
    const captureMemberCode = safeTrim(htmlCapture?.memberCode);
    const captureCustomer = safeTrim(htmlCapture?.customerName) || safeTrim(customerName);
    const pvTotal = safeItems.reduce(
      (sum, item) => sum + Number(item.pv ?? 0) * Number(item.cantidad ?? 0),
      0,
    );

    const bankValue = bankEntity?.trim() || "-";

    return {
      nota: {
        notaId: notaId ?? 0,
        notaDocu: docTypeName,
        clienteId: clienteIdNumber,
        notaFecha: `${today}T00:00:00`,
        notaUsuario: resolvedNotaUsuario,
        notaFormaPago: paymentMethod,
        notaCondicion: "ALCONTADO",
        notaDias: 1,
        notaFechaPago: now.toISOString(),
        notaDireccion: null,
        notaTelefono: null,
        notaSubtotal: Number(base.toFixed(2)),
        notaMovilidad: 0,
        notaDescuento: Number(descuento.toFixed(2)),
        notaTotal: Number(documentTotalWithIgv.toFixed(2)),
        notaAcuenta: 0,
        notaSaldo: Number(documentTotalWithIgv.toFixed(2)),
        notaAdicional: Number(notaAdicional.toFixed(2)),
        notaTarjeta: 0,
        notaPagar: Number(totalAPagar.toFixed(2)),
        notaEstado: "CANCELADO",
        companiaId: companyId,
        notaEntrega: "INMEDIATA",
        modificadoPor: null,
        fechaEdita: null,
        notaConcepto: "MERCADERIA",
        notaSerie,
        notaNumero: paddedNotaNumero || "00000000",
        notaGanancia: 0,
        icbper: 0,
        entidadBancaria: bankValue,
        nroOperacion: isCash ? "" : safeTrim(nroOperacion) || "",
        efectivo: isCash ? Number(totalAPagar.toFixed(2)) : 0,
        deposito: isCash ? 0 : Number(totalAPagar.toFixed(2)),
        notaTransaccion: captureTransaction,
        miembro: captureCustomer || "VARIOS",
        codigoCliente: captureMemberCode,
        conceptoOBS: "VENTA",
        estadoOBS: "EMITIDO",
        pv: `${Number(pvTotal.toFixed(2))} PV`,
        image: "",
        codigoRes: "",
        responsable: "",
      },
      detalles: safeItems.map((item) => {
        const detalleCantidad = Number(item.cantidad ?? 0);
        const detallePrecio = Number(item.precio ?? 0);
        const detallePV = Number(
          (item as any).detallePV ?? Number(item.pv ?? 0) * detalleCantidad,
        );
        const detalleSV = Number(
          (item as any).detalleSV ?? Number(item.sv ?? 0) * detalleCantidad,
        );
        const detalleImporte = Number(
          (item as any).detalleImporte ??
            (item as any).importe ??
            detallePrecio * detalleCantidad,
        );
        const detalleUnidad = safeTrim(item.unidadMedida ?? "") || "UND";
        const detalleCosto = Number(
          (item as any).detalleCosto ?? (item as any).costo ?? item.precio ?? 0,
        );
        const detalleEstado =
          safeTrim((item as any).detalleEstado ?? "") || "PENDIENTE";
        const cantidadSaldo = Number(
          (item as any).cantidadSaldo ?? item.stock ?? 0,
        );
        const valorUMRaw = Number(item.valorUM ?? 1);

        return {
          detalleId:
            Number.isFinite(Number((item as any).detalleId)) &&
            Number((item as any).detalleId) > 0
              ? Number((item as any).detalleId)
              : 0,
          idProducto: item.productId,
          detalleCantidad,
          detalleUm: detalleUnidad,
          detalleDescripcion: item.nombre,
          detalleCosto,
          detallePrecio,
          detallePV,
          detalleSV,
          detalleImporte,
          detalleEstado,
          cantidadSaldo,
          valorUM:
            Number.isFinite(valorUMRaw) && valorUMRaw > 0 ? valorUMRaw : 1,
        };
      }),
    };
  }, [
    bankEntity,
    notaId,
    companyId,
    clienteId,
    customerName,
    notaSerie,
    docTypeName,
    paddedNotaNumero,
    descuento,
    documentTotalWithIgv,
    gravada,
    notaAdicional,
    nroOperacion,
    htmlCapture,
    resolvedNotaUsuario,
    paymentMethod,
    monetarySummary,
    safeItemsForFiscal,
    totalAPagar,
    isCash,
  ]);

  useEffect(() => {
    setCanPreviewPdf(true);
  }, []);

  useEffect(() => {
    if (!notaId || hasLoadedNotaMeta) return;
    fetchNotaFromServer(notaId).finally(() => setHasLoadedNotaMeta(true));
  }, [notaId, hasLoadedNotaMeta]);

  const confirmPayment = async () => {
    if (isReadOnlyNoteView) return;
    if (!ensureExistingCustomerByName(getValues("customerName"))) return;
    if (!ensureFacturaCustomerAndRuc()) return;

    const sourceItems = hasLiveItems ? items : purchasedItems;
    const invalidItems = sourceItems.filter(
      hasInvalidQuantityOrStockForPayment,
    );
    if (invalidItems.length) {
      toast.error("No puede agregar productos en 0.");
      return;
    }

    const invalidPriceItems = sourceItems.filter((item) => {
      const minPrice = Math.max(0, Number(item.precioMinimo ?? 0) || 0);
      const draftValue = priceDrafts[getCartItemKey(item)];
      if (draftValue === undefined) {
        const storedPrice = Number(item.precio ?? 0);
        return !Number.isFinite(storedPrice) || storedPrice < minPrice;
      }

      const normalizedDraft = draftValue.trim();
      if (!normalizedDraft) return true;
      const draftPrice = Number(normalizedDraft);
      return !Number.isFinite(draftPrice) || draftPrice < minPrice;
    });
    if (invalidPriceItems.length) {
      toast.error("El precio no debe ser menor al precio base.");
      return;
    }

    const sourceTotals = hasLiveItems ? totals : paidTotals;
    setPurchasedItems(sourceItems);
    setPaidTotals(sourceTotals);

    const isEditing = Boolean(notaId) && isEditingMode;
    const baseNota = { ...notaPayload.nota, notaId: notaId ?? 0 };
    const editNota = isEditing
      ? {
          notaId: baseNota.notaId,
          notaDocu: baseNota.notaDocu,
          clienteId: baseNota.clienteId,
          notaUsuario: baseNota.notaUsuario,
          notaFormaPago: baseNota.notaFormaPago,
          notaCondicion: baseNota.notaCondicion,
          notaSubtotal: baseNota.notaSubtotal,
          notaTotal: baseNota.notaTotal,
          notaPagar: baseNota.notaPagar,
          notaEntrega: baseNota.notaEntrega,
          notaSerie: baseNota.notaSerie,
          notaNumero: baseNota.notaNumero,
          companiaId: baseNota.companiaId,
          icbper: baseNota.icbper,
          entidadBancaria: baseNota.entidadBancaria,
          efectivo: baseNota.efectivo,
          deposito: baseNota.deposito,
          notaGanancia: baseNota.notaGanancia,
          notaConcepto: baseNota.notaConcepto,
          notaEstado: baseNota.notaEstado,
          modificadoPor: resolvedNotaUsuario,
          nroOperacion: baseNota.nroOperacion ?? "",
        }
      : baseNota;

    const detallesPayload: NotaDetallePayload[] = notaPayload.detalles.map(
      (detalle) => {
        const baseDetalle = {
          ...detalle,
          detalleId: (detalle as any).detalleId ?? 0,
        };
        if (!isEditing) return baseDetalle;
        return {
          detalleId: baseDetalle.detalleId,
          idProducto: baseDetalle.idProducto,
          detalleCantidad: baseDetalle.detalleCantidad,
          detalleUm: baseDetalle.detalleUm,
          detalleDescripcion: baseDetalle.detalleDescripcion,
          detalleCosto: baseDetalle.detalleCosto,
          detallePrecio: baseDetalle.detallePrecio,
          detalleImporte: baseDetalle.detalleImporte,
          detalleEstado: baseDetalle.detalleEstado,
          valorUM: baseDetalle.valorUM,
        };
      },
    );

    if (!isProforma) {
      const totalDetalle = roundCurrency(
        detallesPayload.reduce(
          (acc, detalle) => acc + Number(detalle.detalleImporte ?? 0),
          0,
        ),
      );
      const descuentoCabecera = roundCurrency(
        Number(editNota.notaDescuento ?? 0),
      );
      const totalEsperadoDocumento = roundCurrency(
        Math.max(totalDetalle - descuentoCabecera, 0),
      );
      const totalCabecera = roundCurrency(Number(editNota.notaTotal ?? 0));
      if (Math.abs(totalEsperadoDocumento - totalCabecera) > 0.05) {
        toast.error(
          "Documento inconsistente: (items - descuento) no coincide con total.",
        );
        return;
      }
    }

    const basePayload = {
      nota: editNota,
      detalles: detallesPayload,
    };

    const requestDetalle = isEditing
      ? buildRequestDetalle(
          detallesPayload as any,
          serverItems.length ? serverItems : purchasedItems,
        )
      : undefined;
    const requestDetallePayload =
      requestDetalle && requestDetalle.length > 0 ? requestDetalle : undefined;

    const extractApiMessage = (val: any): string => {
      if (!val) return "";
      if (typeof val === "string") return val;
      if (typeof val === "object") {
        const msg =
          (val as any).message ??
          (val as any).Message ??
          (val as any).error ??
          (val as any).Error ??
          (val as any).data ??
          (val as any).response?.data ??
          (val as any).response?.data?.message ??
          (val as any).response?.data?.error;
        if (typeof msg === "string") return msg;
      }
      return "";
    };

    const editPayloadForApi = isEditing
      ? {
          NotaId: editNota.notaId ?? 0,
          NotaDocu: editNota.notaDocu,
          ClienteId: editNota.clienteId,
          Usuario: editNota.notaUsuario,
          FormaPago: editNota.notaFormaPago,
          Condicion: editNota.notaCondicion,
          Direccion: editNota.notaDireccion ?? "",
          Telefono: editNota.notaTelefono ?? "",
          SubTotal: editNota.notaSubtotal,
          Movilidad: editNota.notaMovilidad,
          Descuento: editNota.notaDescuento,
          Total: editNota.notaTotal,
          Acuenta: editNota.notaAcuenta,
          Saldo: editNota.notaSaldo,
          Adicional: editNota.notaAdicional,
          Tarjeta: editNota.notaTarjeta,
          Pagar: editNota.notaPagar,
          CompaniaId: editNota.companiaId,
          Entrega: editNota.notaEntrega,
          ModificadoPor: editNota.modificadoPor ?? resolvedNotaUsuario,
          Serie: editNota.notaSerie,
          Numero: editNota.notaNumero,
          Ganancia: editNota.notaGanancia,
          NotaConcepto: editNota.notaConcepto ?? "MERCADERIA",
          ICBPER: editNota.icbper,
          IGV: Number(igvAmount.toFixed(2)),
          DocuGravada: Number(gravada.toFixed(2)),
          DocuDescuento: Number(descuento.toFixed(2)),
          EntidadBancaria: editNota.entidadBancaria,
          NroOperacion: editNota.nroOperacion ?? "",
          Efectivo: editNota.efectivo,
          Deposito: editNota.deposito,
          ClienteRazon: safeTrim(customerName),
          ClienteRuc: docTypeCode === "01" ? safeTrim(selectedDocument) : "",
          ClienteDni: docTypeCode !== "01" ? safeTrim(selectedDocument) : "",
          DireccionFiscal: "",
          Items: detallesPayload.length,
          ...(requestDetallePayload
            ? { requestDetalle: requestDetallePayload }
            : {}),
        }
      : basePayload;

    const result = await apiRequest({
      url: isEditing
        ? buildApiUrl("/Nota/editarOrden")
        : buildApiUrl("/Nota/crearOrden"),
      method: isEditing ? "PUT" : "POST",
      data: editPayloadForApi,
      config: {
        headers: {
          Accept: "*/*",
          "Content-Type": "application/json",
        },
      },
      fallback: null,
    });

    const apiMessage = extractApiMessage(result);
    const normalizedMessage = apiMessage
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (normalizedMessage.includes("aperturo caja")) {
      toast.error(apiMessage || "No Aperturó Caja");
      return;
    }

    if (!result || (result as any) === false) {
      toast.error("No se pudo registrar la nota.");
      return;
    }

    const httpStatusFromCreate = resolveHttpStatus(result);
    const createSunatPayload = parseRecordLikeValue(
      (result as Record<string, unknown> | null)?.sunat ??
        (result as Record<string, unknown> | null)?.Sunat,
    );
    const createMessage = resolveApiMessage(result, createSunatPayload);
    const createCode = resolveSunatCode(result, createSunatPayload);
    const createSunatMessage = resolveSunatMessage(result, createSunatPayload);
    const createRegistroBdMessage = resolveRegistroBdMessage(
      result,
      createSunatPayload,
    );
    const createDetail = buildEmissionDetail({
      message: createMessage || apiMessage,
      code: createCode,
      sunatMessage: createSunatMessage,
      registroBdMessage: createRegistroBdMessage,
    });

    if (
      Boolean((result as Record<string, unknown> | null)?.isAxiosError) ||
      httpStatusFromCreate >= 400
    ) {
      if (httpStatusFromCreate >= 500) {
        toast.error(
          createDetail || "Error técnico backend al emitir documento.",
        );
      } else {
        toast.error(createDetail || "No se pudo emitir documento.");
      }
      return;
    }

    const parseNotaId = (val: any): number | null => {
      if (val === null || val === undefined) return null;
      if (typeof val === "number") {
        return Number.isFinite(val) ? val : null;
      }
      if (typeof val === "string") {
        const match = val.match(/\d+/);
        if (match?.[0]) {
          const numeric = Number(match[0]);
          return Number.isFinite(numeric) ? numeric : null;
        }
      }
      const nested =
        (val as any)?.notaId ??
        (val as any)?.nota?.notaId ??
        (val as any)?.idNota ??
        (val as any)?.resultado ??
        (val as any)?.Resultado ??
        (val as any)?.result ??
        (val as any)?.Result ??
        (val as any)?.data?.notaId ??
        (val as any)?.data?.idNota ??
        (val as any)?.data?.resultado ??
        (val as any)?.data?.Resultado ??
        (val as any)?.data;

      if (typeof nested === "number") {
        return Number.isFinite(nested) ? nested : null;
      }
      if (typeof nested === "string") {
        const matchNested = nested.match(/\d+/);
        if (matchNested?.[0]) {
          const numeric = Number(matchNested[0]);
          return Number.isFinite(numeric) ? numeric : null;
        }
      }
      return null;
    };

    const parseNotaCorrelative = (val: any): string | null => {
      if (val && typeof val === "object") {
        const objNumber = safeTrim(
          (val as any).notaNumero ??
            (val as any).numero ??
            (val as any).Numero ??
            (val as any).NotaNumero ??
            (val as any)?.nota?.notaNumero ??
            (val as any)?.data?.notaNumero ??
            (val as any)?.data?.numero ??
            (val as any)?.data?.Numero ??
            "",
        );
        const objDigits = objNumber.replace(/\D/g, "");
        if (objDigits) return objDigits.padStart(8, "0");
      }

      const resolveString = (): string => {
        if (typeof val === "string") return val;
        if (val && typeof (val as any).resultado === "string")
          return (val as any).resultado;
        if (val && typeof (val as any).Resultado === "string")
          return (val as any).Resultado;
        if (val && typeof (val as any).result === "string")
          return (val as any).result;
        if (
          val &&
          (val as any).data &&
          typeof (val as any).data.resultado === "string"
        ) {
          return (val as any).data.resultado;
        }
        if (val && typeof (val as any).data === "string")
          return (val as any).data;
        if (val && typeof (val as any).message === "string")
          return (val as any).message;
        return "";
      };

      const raw = resolveString();
      if (!raw) return null;

      if (raw.includes("¬")) {
        const [, correlativeRaw = ""] = raw.split("¬");
        const digits = correlativeRaw.match(/\d+/)?.[0] ?? correlativeRaw;
        const normalized = (digits ?? "").replace(/\D/g, "");
        return normalized ? normalized.padStart(8, "0") : null;
      }

      const matches = raw.match(/(\d+)/g);
      if (matches && matches.length >= 2) {
        const candidate = matches[matches.length - 1] ?? "";
        const normalized = candidate.replace(/\D/g, "");
        return normalized ? normalized.padStart(8, "0") : null;
      }

      return null;
    };

    const parsedNotaId = isEditing ? notaId : parseNotaId(result);
    const parsedNotaCorrelative = parseNotaCorrelative(result);
    if (parsedNotaCorrelative) {
      setNotaNumero(parsedNotaCorrelative);
    }
    if (!isEditing && parsedNotaId) {
      const numericNotaId = Number(parsedNotaId);
      setNotaId(numericNotaId);
      setEditingNotaInStore(numericNotaId);
      setEditingModeInStore(false); // creación no activa edición
      setServerItemsInStore(
        serverItems.length
          ? serverItems
          : purchasedItems.length
            ? purchasedItems
            : items,
      );
      await fetchNotaFromServer(numericNotaId);

      const isSalesPaymentPath = pathname
        .toLowerCase()
        .includes("/sales/pos/payment");
      const paymentBasePath = isSalesPaymentPath
        ? "/sales/pos/payment"
        : "/pos/payment";
      navigate(`${paymentBasePath}/${numericNotaId}?mode=view`, {
        replace: true,
      });
    }

    if (isEditingMode) {
      setEditingModeInStore(false);
    }

    setIsConfirmed(true);
    const parseAmountLike = (value: unknown): number => {
      if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
      }
      const raw = safeTrim(value);
      if (!raw) return 0;
      const normalized = raw.replace(/,/g, "");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const parseToIsoDate = (value: unknown): string => {
      const raw = safeTrim(value);
      if (!raw) return "";
      const [datePart = ""] = raw.split(" ");
      const slashMatch = datePart.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (slashMatch) {
        const [, dd, mm, yyyy] = slashMatch;
        return `${yyyy}-${mm}-${dd}`;
      }
      const isoMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (isoMatch) return datePart;
      return "";
    };

    const createResponse =
      !isEditing && result && typeof result === "object"
        ? (result as Record<string, unknown>)
        : null;
    const sunatResponse = parseRecordLikeValue(
      createResponse?.sunat ?? createResponse?.Sunat,
    );
    const facturaCodSunat = resolveSunatCode(createResponse, sunatResponse);
    const facturaMsjSunat = resolveSunatMessage(createResponse, sunatResponse);
    const facturaRegistroBdMessage = resolveRegistroBdMessage(
      createResponse,
      sunatResponse,
    );
    const facturaApiMessage = resolveApiMessage(createResponse, sunatResponse);
    const facturaAcceptedState = resolveAcceptedState(
      createResponse,
      sunatResponse,
    );
    const facturaAceptada = facturaAcceptedState.hasAccepted
      ? facturaAcceptedState.accepted
      : parseBooleanLikeValue(
          sunatResponse?.ok ?? sunatResponse?.Ok ?? sunatResponse?.OK,
        ) ||
        safeTrim(sunatResponse?.flg_rta ?? sunatResponse?.FlgRta) === "1" ||
        facturaCodSunat === "0" ||
        facturaCodSunat === "0000";
    let boletaLoteStatus: "success" | "warning" | null = null;
    let boletaLoteMessage = "";

    if (!isEditing && docTypeCode === "03" && boletaPorLoteFromSession) {
      const todayIso = getLocalDateISO(new Date());
      const tipoProcesoRaw = Number(entornoFromSession || 3);
      const tipoProceso =
        Number.isFinite(tipoProcesoRaw) && tipoProcesoRaw > 0
          ? Math.floor(tipoProcesoRaw)
          : 3;

      try {
        const nextSequence = await fetchNextBoletaSummarySequence(companyId);
        if (!nextSequence) {
          boletaLoteStatus = "warning";
          boletaLoteMessage =
            "Boleta registrada, pero no se obtuvo secuencia para enviar resumen.";
        } else {
          await fetchBoletaSummaryDocuments({ dataOverride: companyId });
          const pendingRows = useBoletasSummaryStore.getState().documents ?? [];
          const parsedNotaIdNumber = Number(parsedNotaId ?? 0);
          const targetDocNumber = safeTrim(
            `${safeTrim(notaSerie)}-${safeTrim(parsedNotaCorrelative || paddedNotaNumero)}`,
          ).toUpperCase();
          const rowsByNotaId =
            parsedNotaIdNumber > 0
              ? pendingRows.filter(
                  (row) => Number(row.notaId || 0) === parsedNotaIdNumber,
                )
              : [];
          const rowsByDocumentNumber = targetDocNumber
            ? pendingRows.filter(
                (row) =>
                  safeTrim(row.serieNumero).toUpperCase() === targetDocNumber,
              )
            : [];
          const rowsToSend = rowsByNotaId.length
            ? rowsByNotaId
            : rowsByDocumentNumber.length
              ? rowsByDocumentNumber
              : pendingRows;

          if (!rowsToSend.length) {
            boletaLoteStatus = "warning";
            boletaLoteMessage =
              "Boleta registrada, pero no se encontraron pendientes para resumen.";
          } else {
            const resumenSerie = todayIso.replaceAll("-", "");
            const firstRowDateIso = parseToIsoDate(rowsToSend[0]?.fechaEmision);
            const referenceDateIso = firstRowDateIso || todayIso;
            const firstSerieNumero = safeTrim(rowsToSend[0]?.serieNumero);
            const lastSerieNumero = safeTrim(
              rowsToSend[rowsToSend.length - 1]?.serieNumero,
            );
            const rangoNumeros =
              firstSerieNumero && lastSerieNumero
                ? `${firstSerieNumero} al ${lastSerieNumero}`
                : firstSerieNumero || lastSerieNumero || "";
            const detailRows = rowsToSend.map((row, index) => ({
              item: index + 1,
              tipoComprobante: "03",
              nroComprobante: safeTrim(row.serieNumero),
              tipoDocumento: "1",
              nroDocumento: safeTrim(row.clienteDni) || "00000000",
              tipoComprobanteRef: "",
              nroComprobanteRef: "",
              statu: "1",
              codMoneda: "PEN",
              total: Number(parseAmountLike(row.total).toFixed(2)),
              icbper: Number(parseAmountLike(row.icbper).toFixed(2)),
              gravada: Number(parseAmountLike(row.subTotal).toFixed(2)),
              isc: 0,
              igv: Number(parseAmountLike(row.igv).toFixed(2)),
              otros: 0,
              cargoXAsignacion: 1,
              montoCargoXAsig: 0,
              exonerado: 0,
              inafecto: 0,
              exportacion: 0,
              gratuitas: 0,
              docuId: Number(row.docuId ?? 0),
              notaId: Number(row.notaId ?? 0),
            }));
            const summarySubTotal = detailRows.reduce(
              (acc, row) => acc + row.gravada,
              0,
            );
            const summaryIgv = detailRows.reduce(
              (acc, row) => acc + row.igv,
              0,
            );
            const summaryIcbper = detailRows.reduce(
              (acc, row) => acc + row.icbper,
              0,
            );
            const summaryTotal = detailRows.reduce(
              (acc, row) => acc + row.total,
              0,
            );

            const summaryResponse = await sendBoletaSummary({
              NRO_DOCUMENTO_EMPRESA: safeTrim(companyRucFromSession),
              RAZON_SOCIAL:
                safeTrim(companyNameFromSession) ||
                safeTrim(companyCommercialFromSession) ||
                "EMPRESA",
              USUARIO: resolvedNotaUsuario || "USUARIO",
              Usuario: resolvedNotaUsuario || "USUARIO",
              usuario: resolvedNotaUsuario || "USUARIO",
              USUARIO_REGISTRO: resolvedNotaUsuario || "USUARIO",
              TIPO_DOCUMENTO: "6",
              CODIGO: "RC",
              SERIE: resumenSerie,
              SECUENCIA: String(nextSequence),
              FECHA_REFERENCIA: referenceDateIso,
              FECHA_DOCUMENTO: todayIso,
              TIPO_PROCESO: tipoProceso,
              CONTRA_FIRMA: safeTrim(claveCertificadoFromSession),
              USUARIO_SOL_EMPRESA: safeTrim(usuarioSolFromSession),
              PASS_SOL_EMPRESA: safeTrim(claveSolFromSession),
              RUTA_PFX: safeTrim(certificadoBase64FromSession),
              COMPANIA_ID: companyId,
              detalle: detailRows,
              RANGO_NUMEROS: rangoNumeros,
              SUBTOTAL: Number(summarySubTotal.toFixed(2)),
              IGV: Number(summaryIgv.toFixed(2)),
              ICBPER: Number(summaryIcbper.toFixed(2)),
              TOTAL: Number(summaryTotal.toFixed(2)),
            });
            const summaryOk =
              summaryResponse.ok || safeTrim(summaryResponse.flg_rta) === "1";
            const summaryTicket = safeTrim(
              summaryResponse.ticket || summaryResponse.msj_sunat,
            );

            if (!summaryOk) {
              boletaLoteStatus = "warning";
              boletaLoteMessage =
                safeTrim(
                  summaryResponse.msj_sunat ||
                    summaryResponse.mensaje ||
                    summaryResponse.registro_bd?.mensaje ||
                    summaryResponse.registro_bd?.resultado,
                ) || "Boleta registrada, pero no se pudo enviar el resumen.";
            } else if (!summaryTicket) {
              boletaLoteStatus = "warning";
              boletaLoteMessage =
                "Boleta registrada y resumen enviado, pero SUNAT no devolvió ticket.";
            } else {
              const resumenId =
                Number(
                  safeTrim(summaryResponse.registro_bd?.resultado).match(
                    /\d+/,
                  )?.[0],
                ) || 0;
              const consultResponse = await consultBoletaSummary({
                RESUMEN_ID: resumenId,
                TICKET: summaryTicket,
                CODIGO_SUNAT: "",
                MENSAJE_SUNAT: "",
                ESTADO: "P",
                SECUENCIA: String(nextSequence),
                RUC: safeTrim(companyRucFromSession),
                USUARIO_SOL_EMPRESA: safeTrim(usuarioSolFromSession),
                PASS_SOL_EMPRESA: safeTrim(claveSolFromSession),
                TIPO_DOCUMENTO: "RC",
                TIPO_PROCESO: tipoProceso,
                INTENTOS: 0,
              });
              const consultCode = safeTrim(consultResponse.cod_sunat);
              const consultAction = safeTrim(
                consultResponse.accion,
              ).toLowerCase();
              const consultMessage = safeTrim(
                consultResponse.mensaje || consultResponse.msj_sunat,
              );
              const consultAccepted =
                consultResponse.ok &&
                (consultCode === "0" ||
                  consultAction === "consultado_correctamente");

              if (consultAccepted) {
                boletaLoteStatus = "success";
                boletaLoteMessage =
                  consultMessage ||
                  `Boleta enviada por lote y aceptada por SUNAT. Ticket: ${summaryTicket}.`;
              } else {
                boletaLoteStatus = "warning";
                boletaLoteMessage =
                  consultMessage ||
                  `Boleta registrada y resumen enviado (ticket ${summaryTicket}), pero SUNAT aún no confirmó aceptación final.`;
              }
            }
          }
        }
      } catch (error) {
        console.error("Error en flujo por lote de boletas", error);
        boletaLoteStatus = "warning";
        boletaLoteMessage =
          "Boleta registrada, pero falló el envío/consulta del resumen en SUNAT.";
      }
    }

    if (!isEditing && isPosSaleDraftFlow) {
      const finalNoteId = parsedNotaId ? Number(parsedNotaId) : null;
      try {
        await markDraftAsConfirmed({
          noteId: Number.isFinite(finalNoteId) ? finalNoteId : null,
          documentNumber:
            safeTrim(parsedNotaCorrelative) || safeTrim(documentNumber),
          paymentMethod,
          customerName: safeTrim(customerName),
          total: Number(totalAPagar.toFixed(2)),
        });
      } catch (error) {
        console.error("No se pudo marcar el carrito como confirmado", error);
      }
    }
    if (isEditing && isPosEditDraftFlow) {
      try {
        await discardCurrentDraft();
      } catch (error) {
        console.error("No se pudo limpiar el borrador de edicion", error);
      }
    }

    refetchProducts();

    setConfirmedFlowType(isEditing ? "edit" : "create");
    shouldCleanupOnExitAfterConfirmRef.current = !isEditing;
    if (isEditing) {
      toast.success("Orden actualizada");
    } else if (docTypeCode === "01") {
      if (facturaAceptada) {
        toast.success(
          facturaMsjSunat || "Factura creada y aceptada por SUNAT.",
        );
      } else if (facturaCodSunat || facturaMsjSunat) {
        const detail = [facturaCodSunat, facturaMsjSunat]
          .filter(Boolean)
          .join(" - ");
        toast.warning(
          detail ||
            "Factura creada, pero quedó pendiente de envío o reintento en SUNAT.",
        );
      } else {
        toast.warning(
          "Factura creada. El envío a OCE/SUNAT quedó pendiente de confirmación.",
        );
      }
    } else if (docTypeCode === "03") {
      if (boletaPorLoteFromSession) {
        if (boletaLoteStatus === "success") {
          toast.success(
            boletaLoteMessage ||
              "Boleta creada, resumen enviado y aceptación SUNAT confirmada.",
          );
        } else if (boletaLoteStatus === "warning") {
          toast.warning(
            boletaLoteMessage ||
              "Boleta creada, pero el envío por lote quedó pendiente de confirmación.",
          );
        } else {
          toast.success("Boleta creada.");
        }
      } else if (facturaAceptada) {
        toast.success(facturaMsjSunat || "Boleta creada y aceptada por SUNAT.");
      } else if (facturaCodSunat || facturaMsjSunat) {
        const detail = [facturaCodSunat, facturaMsjSunat]
          .filter(Boolean)
          .join(" - ");
        toast.warning(
          detail ||
            "Boleta creada, pero quedó pendiente de envío o reintento en SUNAT.",
        );
      } else {
        toast.warning(
          "Boleta creada. El envío a OCE/SUNAT quedó pendiente de confirmación.",
        );
      }
    } else {
      toast.success("Pago registrado");
    }
    void handlePrint({ skipConfirmedCheck: true });
  };

  const handleBackToPos = (ev?: MouseEvent) => {
    ev?.preventDefault();
    if (shouldBackToOrderNotesList || cameFromOrderNotesViewButton) {
      clearEditingNota();
      navigate("/sales/order_notes");
      return;
    }
    if (isOrderNotesFlow) {
      clearEditingNota();
      navigate(backRoute);
      return;
    }

    if (isConfirmed) {
      if (
        confirmedFlowType === "create" ||
        shouldCleanupOnExitAfterConfirmRef.current
      ) {
        runConfirmedSaleCleanup();
        navigate(backRoute, { state: { resetCart: true } });
        return;
      }
      clearCart();
      clearEditingNota();
      navigate(backRoute, { state: { preserveCart: true } });
      return;
    }

    const itemsForReturn =
      isEditingMode && items.length
        ? items
        : purchasedItems.length > 0
          ? purchasedItems
          : serverItems.length > 0
            ? serverItems
            : items;

    if (isEditingMode && notaId && itemsForReturn.length) {
      setStoreItems(itemsForReturn);
      setPaidTotals(computeTotalsFromItems(itemsForReturn));
      setEditingNotaInStore(notaId);
      setServerItemsInStore(serverItems.length ? serverItems : itemsForReturn);
      navigate(backRoute, { state: { preserveCart: true } });
      return;
    }

    clearEditingNota();
    // Si aún no se ha confirmado/guardado la nota inicial, conservar el carrito
    if (!notaId && !isConfirmed) {
      navigate(backRoute, { state: { preserveCart: true } });
      return;
    }

    if (items.length) {
      setPurchasedItems(items);
      setPaidTotals(totals);
    }
    navigate(backRoute, { state: { preserveCart: true } });
  };

  const handleEnableEditing = () => {
    if (isNotaAnulada) return;
    if (!notaId) return;
    if (isReadOnlyNoteView) {
      navigate(`/sales/order_notes/${notaId}/edit`);
      return;
    }
    shouldCleanupOnExitAfterConfirmRef.current = false;
    setIsConfirmed(false);
    setConfirmedFlowType(null);
    setEditingNotaInStore(notaId);
    setEditingModeInStore(true);
    const itemsForEditing = serverItems.length ? serverItems : purchasedItems;
    setServerItemsInStore(itemsForEditing);
  };

  const handleVoidTicket = async () => {
    const isProformaVoidFlow = docTypeCode === "101";
    const shouldUseLegacyVoidEndpoint =
      isProformaVoidFlow || boletaPorLoteFromSession;
    const defaultSerieForVoid = isProformaVoidFlow ? "0001" : "BA01";
    const voidDocumentLabel = isProformaVoidFlow ? "proforma" : "ticket";

    if (!hasTicketId) {
      toast.info(
        isProformaVoidFlow
          ? "No hay proforma para anular."
          : "No hay ticket para anular.",
      );
      return;
    }

    const documento =
      safeTrim(documentNumber) ||
      `${safeTrim(notaSerie) || defaultSerieForVoid}-${safeTrim(paddedNotaNumero) || "00000000"}`;

    const confirmed = await confirmWithAppDialog({
      title: isProformaVoidFlow
        ? "Anular proforma"
        : !boletaPorLoteFromSession
          ? "Generar nota de crédito"
          : "Anular boleta",
      content: isProformaVoidFlow ? (
        <p>¿Seguro que deseas anular la proforma {documento}?</p>
      ) : !boletaPorLoteFromSession ? (
        <p>
          ¿Seguro que deseas anular la boleta {documento} mediante nota de
          crédito?
        </p>
      ) : (
        <p>¿Seguro que deseas anular su boleta {documento}?</p>
      ),
      confirmText: "Anular",
    });
    if (!confirmed) return;

    setIsVoidingTicket(true);
    try {
      const docuIdParaAnular =
        Number.isFinite(Number(docuIdActual)) && Number(docuIdActual) > 0
          ? Number(docuIdActual)
          : ticketIdNumber;
      const fechaDocumento = getLocalDateISO(new Date());
      const motivoAnulacion = "ANULACION DE LA OPERACION";

      if (!shouldUseLegacyVoidEndpoint) {
        const payload: Record<string, unknown> = {
          DOCU_ID: docuIdParaAnular,
          NRO_DOCUMENTO_MODIFICA: documento,
          DESCRIPCION_MOTIVO: motivoAnulacion,
          FECHA_DOCUMENTO: fechaDocumento,
        };

        if (docuIdParaAnular <= 0 && !documento) {
          toast.error("No se encontró DOCU_ID ni NRO_DOCUMENTO_MODIFICA.");
          return;
        }

        const result = await apiRequest({
          url: buildApiUrl("/Nota/boleta/anular-individual"),
          method: "POST",
          data: payload,
          config: {
            headers: {
              Accept: "*/*",
              "Content-Type": "application/json",
            },
          },
          fallback: null,
        });

        const parseBooleanLike = (value: unknown): boolean => {
          if (typeof value === "boolean") return value;
          const normalized = safeTrim(value).toLowerCase();
          return (
            normalized === "true" ||
            normalized === "1" ||
            normalized === "si" ||
            normalized === "sí" ||
            normalized === "verdadero" ||
            normalized === "yes" ||
            normalized === "ok"
          );
        };

        const parseRecordLike = (
          value: unknown,
        ): Record<string, unknown> | null => {
          if (!value) return null;
          if (typeof value === "object")
            return value as Record<string, unknown>;
          if (typeof value === "string") {
            const trimmed = value.trim();
            if (!trimmed) return null;
            try {
              const parsed = JSON.parse(trimmed) as unknown;
              return parsed && typeof parsed === "object"
                ? (parsed as Record<string, unknown>)
                : null;
            } catch {
              return null;
            }
          }
          return null;
        };

        const resultObj =
          result && typeof result === "object"
            ? (result as {
                ok?: unknown;
                mensaje?: unknown;
                message?: unknown;
                Message?: unknown;
                msj_sunat?: unknown;
                cod_sunat?: unknown;
                codSunat?: unknown;
                sunat?: unknown;
                isAxiosError?: unknown;
                response?: {
                  status?: unknown;
                  data?: {
                    mensaje?: unknown;
                    message?: unknown;
                    title?: unknown;
                    detail?: unknown;
                    msj_sunat?: unknown;
                    cod_sunat?: unknown;
                  };
                };
              })
            : null;

        const responseStatus = Number(
          resultObj?.response?.status ?? (resultObj as any)?.status ?? 0,
        );
        const sunatResponse = parseRecordLike(resultObj?.sunat);
        const sunatCode = safeTrim(
          sunatResponse?.cod_sunat ??
            sunatResponse?.codSunat ??
            resultObj?.cod_sunat ??
            resultObj?.codSunat ??
            "",
        );
        const responseMessage = safeTrim(
          resultObj?.mensaje ??
            resultObj?.message ??
            resultObj?.Message ??
            resultObj?.msj_sunat ??
            sunatResponse?.mensaje ??
            sunatResponse?.msj_sunat ??
            resultObj?.response?.data?.mensaje ??
            resultObj?.response?.data?.message ??
            resultObj?.response?.data?.detail ??
            resultObj?.response?.data?.title ??
            resultObj?.response?.data?.msj_sunat ??
            (typeof result === "string" ? result : ""),
        );
        const sunatAceptado =
          parseBooleanLike(
            sunatResponse?.aceptado ??
              sunatResponse?.ok ??
              sunatResponse?.cdr_recibido,
          ) ||
          safeTrim(sunatResponse?.flg_rta ?? "") === "1" ||
          sunatCode === "0" ||
          sunatCode === "0000";
        const isSuccess =
          Boolean(resultObj?.ok) ||
          responseStatus === 200 ||
          (result && result !== false && !Boolean(resultObj?.isAxiosError));

        if (
          !isSuccess ||
          !result ||
          result === false ||
          Boolean(resultObj?.isAxiosError)
        ) {
          if (responseStatus === 404) {
            toast.error(
              responseMessage || "No se encontró la boleta a anular.",
            );
          } else if (responseStatus === 409) {
            toast.error(responseMessage || "La boleta ya está anulada.");
          } else if (responseStatus === 400) {
            toast.error(
              responseMessage ||
                "Falta configuración para anular individual (serie NC o credenciales).",
            );
          } else {
            toast.error(responseMessage || "No se pudo anular la boleta.");
          }
          return;
        }

        if (sunatAceptado) {
          toast.success(
            responseMessage ||
              "Boleta anulada correctamente mediante nota de crédito.",
          );
        } else if (sunatCode || responseMessage) {
          const detail = [sunatCode, responseMessage]
            .filter(Boolean)
            .join(" - ");
          toast.warning(
            detail ||
              "Boleta anulada mediante nota de crédito, pendiente de confirmación SUNAT.",
          );
        } else {
          toast.success("Boleta anulada mediante nota de crédito.");
        }

        await fetchNotaFromServer(ticketIdNumber);
        return;
      }

      const detallesParaAnular: PosCartItem[] = serverItems.length
        ? serverItems
        : purchasedItems.length
          ? purchasedItems
          : items;

      if (!detallesParaAnular.length) {
        toast.error("No hay detalle para anular.");
        return;
      }

      const usuarioAnulacion = safeTrim(resolvedNotaUsuario) || "USUARIO";
      const docuIdLegacy =
        docuIdParaAnular > 0 ? docuIdParaAnular : ticketIdNumber;

      const detalleCadena = detallesParaAnular
        .map((item) => {
          const idProducto = Number(item.productId ?? 0);
          const codigo = safeTrim(item.codigo) || String(idProducto || "");
          const cantidad = Number(item.cantidad ?? 0);
          const precio = Number(item.precio ?? 0);
          const costo = Number(item.precio ?? 0);
          const valorUM =
            Number.isFinite(Number(item.valorUM)) && Number(item.valorUM) > 0
              ? Number(item.valorUM)
              : 1;

          return [
            idProducto,
            codigo,
            Number.isFinite(cantidad) ? cantidad.toFixed(2) : "0.00",
            Number.isFinite(precio) ? precio.toFixed(2) : "0.00",
            Number.isFinite(costo) ? costo.toFixed(2) : "0.00",
            Number.isFinite(valorUM) ? valorUM.toFixed(4) : "1.0000",
            "S",
          ].join("|");
        })
        .join(";");

      const listaOrden =
        `${docuIdLegacy}|${ticketIdNumber}|${usuarioAnulacion}|${documento}` +
        `[${detalleCadena}[`;

      const result = await apiRequest({
        url: buildApiUrl("/Nota/anular-documento"),
        method: "POST",
        data: {
          listaOrden,
          ListaOrden: listaOrden,
          Data: listaOrden,
        },
        config: {
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
          },
        },
        fallback: null,
      });

      const resultObj =
        result && typeof result === "object"
          ? (result as {
              ok?: unknown;
              resultado?: unknown;
              mensaje?: unknown;
              message?: unknown;
              Mensaje?: unknown;
              Message?: unknown;
              isAxiosError?: unknown;
              response?: {
                data?: {
                  mensaje?: unknown;
                  message?: unknown;
                };
              };
            })
          : null;

      const responseMessage =
        typeof result === "string"
          ? safeTrim(result)
          : safeTrim(
              resultObj?.mensaje ??
                resultObj?.message ??
                resultObj?.Mensaje ??
                resultObj?.Message ??
                resultObj?.response?.data?.mensaje ??
                resultObj?.response?.data?.message,
            );

      const resultadoTexto = safeTrim(
        resultObj?.resultado ?? (typeof result === "string" ? result : ""),
      ).toLowerCase();
      const isSuccess = Boolean(resultObj?.ok) || resultadoTexto === "true";

      if (
        !isSuccess ||
        !result ||
        result === false ||
        Boolean(resultObj?.isAxiosError)
      ) {
        toast.error(
          responseMessage || `No se pudo anular la ${voidDocumentLabel}.`,
        );
        return;
      }

      toast.success(
        responseMessage ||
          (isProformaVoidFlow
            ? "Proforma anulada correctamente."
            : "Ticket anulado correctamente."),
      );
      await fetchNotaFromServer(ticketIdNumber);
    } catch (error) {
      console.error("Error al anular ticket", error);
      toast.error(
        isProformaVoidFlow
          ? "No se pudo anular la proforma."
          : "No se pudo anular el ticket.",
      );
    } finally {
      setIsVoidingTicket(false);
    }
  };

  const handleResendDocument = async () => {
    if (!hasTicketId) {
      toast.info("No hay documento para reenviar.");
      return;
    }
    if (!isNotaRechazada) {
      toast.info("Solo se puede reenviar cuando el estado SUNAT es RECHAZADO.");
      return;
    }
    if (
      !(
        resolvedDocTypeCodeForResend === "01" ||
        resolvedDocTypeCodeForResend === "03" ||
        resolvedDocTypeCodeForResend === "07"
      )
    ) {
      toast.info(
        "Reenvío disponible solo para factura, boleta o nota de crédito.",
      );
      return;
    }

    const endpoint =
      resolvedDocTypeCodeForResend === "01"
        ? "/Nota/factura/enviar"
        : resolvedDocTypeCodeForResend === "03"
          ? "/Nota/boleta/enviar"
          : "/Nota/credito/enviar";
    const documentLabel =
      resolvedDocTypeCodeForResend === "01"
        ? "Factura"
        : resolvedDocTypeCodeForResend === "03"
          ? "Boleta"
          : "Nota de crédito";
    const serieFallback =
      resolvedDocTypeCodeForResend === "01"
        ? "FA01"
        : resolvedDocTypeCodeForResend === "03"
          ? "BA01"
          : "FN01";
    const documento =
      safeTrim(documentNumber) ||
      `${safeTrim(notaSerie) || serieFallback}-${safeTrim(paddedNotaNumero) || "00000000"}`;

    const confirmed = await confirmWithAppDialog({
      title: `Reenviar ${documentLabel.toLowerCase()}`,
      content: <p>¿Desea reenviar el documento {documento}?</p>,
      confirmText: "Reenviar",
    });
    if (!confirmed) return;

    setIsResendingDocument(true);
    try {
      const now = new Date();
      const fechaIso = getLocalDateISO(now);
      const horaRegistro = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes(),
      ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
      const tipoProcesoParsed = Number(entornoFromSession);
      const tipoProceso =
        Number.isFinite(tipoProcesoParsed) && tipoProcesoParsed > 0
          ? Math.floor(tipoProcesoParsed)
          : 3;
      const detalleFuente: PosCartItem[] = serverItems.length
        ? serverItems
        : purchasedItems.length
          ? purchasedItems
          : itemsToRender;

      if (!detalleFuente.length) {
        toast.error("No hay detalle para reenviar el documento.");
        return;
      }

      const serieDocumento = safeTrim(notaSerie) || serieFallback;
      const clienteDocumento =
        safeTrim(selectedDocument) ||
        safeTrim(customerId) ||
        safeTrim(
          notaCabeceraActual?.clienteRuc ??
            notaCabeceraActual?.clienteDni ??
            notaCabeceraActual?.notaRuc ??
            notaCabeceraActual?.notaDni ??
            "",
        );
      const tipoDocumentoClienteRaw = safeTrim(
        notaCabeceraActual?.tipoDocumentoCliente ??
          notaCabeceraActual?.TipoDocumentoCliente ??
          notaCabeceraActual?.TIPO_DOCUMENTO_CLIENTE ??
          "",
      );
      const tipoDocumentoCliente =
        tipoDocumentoClienteRaw ||
        (clienteDocumento.length === 11
          ? "6"
          : clienteDocumento.length === 8
            ? "1"
            : "0");
      const razonSocialCliente =
        safeTrim(customerName) ||
        safeTrim(
          notaCabeceraActual?.clienteNombre ??
            notaCabeceraActual?.clienteRazon ??
            notaCabeceraActual?.clienteRazonSocial ??
            "",
        ) ||
        "CLIENTE VARIOS";
      const razonSocialEmpresa =
        safeTrim(companyNameFromSession) ||
        safeTrim(companyCommercialFromSession) ||
        "EMPRESA";
      const nombreComercialEmpresa =
        safeTrim(companyCommercialFromSession) ||
        safeTrim(companyNameFromSession) ||
        "EMPRESA";
      const ubigeoEmpresa = safeTrim(companyUbigeoCodeFromSession) || "150101";
      const nombreUbigeoEmpresa =
        safeTrim(companyUbigeoNameFromSession) || "LIMA";
      const direccionEmpresa = safeTrim(companyAddressSunatFromSession) || "-";
      const formaPagoDocumento =
        safeTrim(paymentMethod) ||
        safeTrim(
          notaCabeceraActual?.notaFormaPago ??
            notaCabeceraActual?.formaPago ??
            "",
        ) ||
        "EFECTIVO";
      const totalDocumento = Number(documentTotalWithIgv.toFixed(2));
      const detalle = detalleFuente.map((item, index) => {
        const line = monetarySummary.lines[index];
        const quantity = Number(item.cantidad ?? 0);
        const safeQuantity =
          Number.isFinite(quantity) && quantity > 0
            ? quantity
            : Number(line?.quantity ?? 0);
        const safeUnitPriceWithIgv =
          line && safeQuantity > 0
            ? roundCurrency(Number(line.totalWithIgv ?? 0) / safeQuantity)
            : roundCurrency(Number(item.precio ?? 0));
        const safeSubtotalWithoutIgv = line
          ? roundCurrency(Number(line.importeWithoutIgv ?? 0))
          : roundCurrency((safeUnitPriceWithIgv / IGV_FACTOR) * safeQuantity);
        const safeIgv = line
          ? roundCurrency(Number(line.igv ?? 0))
          : roundCurrency(
              safeUnitPriceWithIgv * safeQuantity - safeSubtotalWithoutIgv,
            );
        const codigoSunat =
          safeTrim(
            (item as any).codigoSunat ??
              (item as any).CodigoSunat ??
              (item as any).codigo_sunat ??
              "",
          ) || "50161509";

        return {
          item: index + 1,
          unidadMedida:
            line?.unitCode ?? normalizeSunatUnitCode(item.unidadMedida),
          cantidad: safeQuantity,
          precio: safeUnitPriceWithIgv,
          importe: safeSubtotalWithoutIgv,
          precioSinImpuesto:
            line?.unitPriceWithoutIgv ??
            (safeQuantity > 0
              ? roundCurrency(safeSubtotalWithoutIgv / safeQuantity)
              : 0),
          igv: safeIgv,
          codTipoOperacion: "10",
          codigo: safeTrim(item.codigo) || `P${index + 1}`,
          codigoSunat,
          descripcion: safeTrim(item.nombre) || `Producto ${index + 1}`,
          descuento: 0,
          subTotal: safeSubtotalWithoutIgv,
        };
      });

      const payload: Record<string, unknown> = {
        DOCU_ID:
          Number.isFinite(Number(docuIdActual)) && Number(docuIdActual) > 0
            ? Number(docuIdActual)
            : undefined,
        NOTA_ID: Number.isFinite(Number(ticketIdNumber))
          ? Number(ticketIdNumber)
          : undefined,
        TIPO_OPERACION: "0101",
        HORA_REGISTRO: horaRegistro,
        NRO_COMPROBANTE: documento,
        FECHA_DOCUMENTO: fechaIso,
        FECHA_VTO: fechaIso,
        COD_TIPO_DOCUMENTO: resolvedDocTypeCodeForResend,
        COD_MONEDA: "PEN",
        NRO_DOCUMENTO_EMPRESA: safeTrim(companyRucFromSession),
        TIPO_DOCUMENTO_EMPRESA: "6",
        RAZON_SOCIAL_EMPRESA: razonSocialEmpresa,
        NOMBRE_COMERCIAL_EMPRESA: nombreComercialEmpresa,
        CODIGO_UBIGEO_EMPRESA: ubigeoEmpresa,
        DIRECCION_EMPRESA: direccionEmpresa,
        DEPARTAMENTO_EMPRESA: nombreUbigeoEmpresa,
        PROVINCIA_EMPRESA: nombreUbigeoEmpresa,
        DISTRITO_EMPRESA: nombreUbigeoEmpresa,
        CODIGO_PAIS_EMPRESA: "PE",
        NRO_DOCUMENTO_CLIENTE: clienteDocumento || "00000000",
        TIPO_DOCUMENTO_CLIENTE: tipoDocumentoCliente,
        RAZON_SOCIAL_CLIENTE: razonSocialCliente,
        DIRECCION_CLIENTE: "-",
        CIUDAD_CLIENTE: nombreUbigeoEmpresa,
        COD_PAIS_CLIENTE: "PE",
        COD_UBIGEO_CLIENTE: ubigeoEmpresa,
        DEPARTAMENTO_CLIENTE: nombreUbigeoEmpresa,
        PROVINCIA_CLIENTE: nombreUbigeoEmpresa,
        DISTRITO_CLIENTE: nombreUbigeoEmpresa,
        USUARIO_SOL_EMPRESA: safeTrim(usuarioSolFromSession),
        PASS_SOL_EMPRESA: safeTrim(claveSolFromSession),
        CONTRA_FIRMA: safeTrim(claveCertificadoFromSession),
        TIPO_PROCESO: tipoProceso,
        RUTA_PFX: safeTrim(certificadoBase64FromSession),
        SUB_TOTAL: Number(gravada.toFixed(2)),
        TOTAL_IGV: Number(igvAmount.toFixed(2)),
        TOTAL: totalDocumento,
        TOTAL_GRAVADAS: Number(gravada.toFixed(2)),
        TOTAL_EXONERADAS: 0,
        TOTAL_INAFECTA: 0,
        TOTAL_GRATUITAS: 0,
        TOTAL_DESCUENTO: Number(descuento.toFixed(2)),
        TOTAL_ICBPER: 0,
        TOTAL_OTR_IMP: 0,
        POR_IGV: 18,
        TOTAL_LETRAS: numberToWords(Math.abs(totalDocumento), "SOLES"),
        FORMA_PAGO: formaPagoDocumento,
        formaPago: formaPagoDocumento,
        docuSerie: serieDocumento,
        DocuSerie: serieDocumento,
        DOCU_SERIE: serieDocumento,
        DocuConcepto:
          safeTrim(notaCabeceraActual?.notaConcepto ?? "") || "MERCADERIA",
        docuConcepto:
          safeTrim(notaCabeceraActual?.notaConcepto ?? "") || "MERCADERIA",
        GLOSA: safeTrim(notaCabeceraActual?.notaConcepto ?? "") || "MERCADERIA",
        detalle,
      };

      if (resolvedDocTypeCodeForResend === "07") {
        const documentoModifica =
          safeTrim(
            notaCabeceraActual?.nroDocumentoModifica ??
              notaCabeceraActual?.NRO_DOCUMENTO_MODIFICA ??
              notaCabeceraActual?.documentoModifica ??
              notaCabeceraActual?.DocumentoModifica ??
              notaCabeceraActual?.referencia ??
              notaCabeceraActual?.Referencia ??
              notaCabeceraActual?.docuReferencia ??
              notaCabeceraActual?.DocuReferencia ??
              "",
          ) || "";
        const tipoComprobanteModifica =
          safeTrim(
            notaCabeceraActual?.tipoComprobanteModifica ??
              notaCabeceraActual?.TIPO_COMPROBANTE_MODIFICA ??
              notaCabeceraActual?.tipoDocumentoModifica ??
              notaCabeceraActual?.TIPO_DOCUMENTO_MODIFICA ??
              "",
          ) ||
          resolveTipoComprobanteModifica(documentoModifica) ||
          (serieDocumento.toUpperCase().startsWith("FN") ? "01" : "03");
        payload.TIPO_COMPROBANTE_MODIFICA = tipoComprobanteModifica;
        payload.NRO_DOCUMENTO_MODIFICA = documentoModifica;
        payload.COD_TIPO_MOTIVO =
          safeTrim(
            notaCabeceraActual?.codTipoMotivo ??
              notaCabeceraActual?.COD_TIPO_MOTIVO ??
              "",
          ) || "01";
        payload.DESCRIPCION_MOTIVO =
          safeTrim(
            notaCabeceraActual?.descripcionMotivo ??
              notaCabeceraActual?.DESCRIPCION_MOTIVO ??
              "",
          ) || "ANULACION DE LA OPERACION";
      }

      if (!payload.DOCU_ID) delete payload.DOCU_ID;
      if (!payload.NOTA_ID) delete payload.NOTA_ID;

      const response = await apiRequest({
        url: buildApiUrl(endpoint),
        method: "POST",
        data: payload,
        config: {
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
          },
        },
        fallback: null,
      });

      const responseObj = parseRecordLikeValue(response);
      const sunatResponse = parseRecordLikeValue(
        responseObj?.sunat ?? responseObj?.Sunat,
      );
      const responseStatus = resolveHttpStatus(responseObj ?? response);
      const responseMessage = resolveApiMessage(
        responseObj ?? response,
        sunatResponse,
      );
      const sunatCode = resolveSunatCode(
        responseObj ?? response,
        sunatResponse,
      );
      const sunatMessage = resolveSunatMessage(
        responseObj ?? response,
        sunatResponse,
      );
      const registroBdMessage = resolveRegistroBdMessage(
        responseObj ?? response,
        sunatResponse,
      );
      const detail = buildEmissionDetail({
        message: responseMessage,
        code: sunatCode,
        sunatMessage,
        registroBdMessage,
      });
      const acceptedState = resolveAcceptedState(
        responseObj ?? response,
        sunatResponse,
      );
      const isSuccess = acceptedState.hasAccepted
        ? acceptedState.accepted
        : Boolean(responseObj?.ok) ||
          safeTrim(responseObj?.flg_rta ?? responseObj?.FlgRta) === "1" ||
          sunatCode === "0" ||
          sunatCode === "0000";

      if (
        !response ||
        response === false ||
        Boolean(responseObj?.isAxiosError)
      ) {
        if (responseStatus >= 500) {
          toast.error(
            detail || `Error técnico backend al reenviar ${documentLabel}.`,
          );
        } else {
          toast.error(detail || `No se pudo reenviar ${documentLabel}.`);
        }
        return;
      }

      if (!isSuccess) {
        toast.error(
          detail || `SUNAT/OSE rechazó el reenvío de ${documentLabel}.`,
        );
        return;
      }

      toast.success(detail || `${documentLabel} reenviada correctamente.`);
      await fetchNotaFromServer(ticketIdNumber);
    } catch (error) {
      console.error("Error al reenviar documento", error);
      toast.error("No se pudo reenviar el documento.");
    } finally {
      setIsResendingDocument(false);
    }
  };

  const handleOpenCreditNote = async () => {
    if (!hasTicketId) {
      toast.info("No hay documento para generar nota de credito.");
      return;
    }

    const detallesFuente: PosCartItem[] = serverItems.length
      ? serverItems
      : purchasedItems.length
        ? purchasedItems
        : itemsToRender;

    if (!detallesFuente.length) {
      toast.error("No hay detalle para generar la nota de credito.");
      return;
    }

    const now = new Date();
    const fechaIso = getLocalDateISO(now);
    const horaRegistro = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes(),
    ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    const originalDoc =
      safeTrim(documentNumber) ||
      `${safeTrim(notaSerie) || "FA01"}-${safeTrim(paddedNotaNumero) || "00000000"}`;
    const docuSerieNc = "FN01";
    const nroComprobanteNc = `${docuSerieNc}-${safeTrim(paddedNotaNumero) || "00000000"}`;

    const clienteDocumento = safeTrim(selectedDocument) || safeTrim(customerId);
    const tipoDocumentoCliente =
      clienteDocumento.length === 11
        ? "6"
        : clienteDocumento.length === 8
          ? "1"
          : "0";

    const tipoProcesoParsed = Number(entornoFromSession);
    const tipoProceso =
      Number.isFinite(tipoProcesoParsed) && tipoProcesoParsed > 0
        ? Math.floor(tipoProcesoParsed)
        : 3;
    const formaPagoNc = safeTrim(paymentMethod) || "EFECTIVO";

    const missingCodigoSunat = detallesFuente
      .map((item, index) => ({
        index,
        codigo: safeTrim(item.codigo) || `ITEM-${index + 1}`,
        nombre: safeTrim(item.nombre) || `Producto ${index + 1}`,
        codigoSunat: safeTrim((item as any).codigoSunat ?? ""),
      }))
      .filter((row) => !row.codigoSunat);

    if (missingCodigoSunat.length) {
      const resume = missingCodigoSunat
        .slice(0, 3)
        .map((row) => `${row.codigo} - ${row.nombre}`)
        .join(", ");
      const suffix =
        missingCodigoSunat.length > 3
          ? ` y ${missingCodigoSunat.length - 3} mas`
          : "";
    }

    const detalle = detallesFuente.map((item, index) => {
      const line = monetarySummary.lines[index];
      const quantity = Number(item.cantidad ?? 0);
      const safeQuantity =
        Number.isFinite(quantity) && quantity > 0
          ? quantity
          : Number(line?.quantity ?? 0);

      const safeUnitPriceWithIgv =
        line && safeQuantity > 0
          ? roundCurrency(Number(line.totalWithIgv ?? 0) / safeQuantity)
          : roundCurrency(Number(item.precio ?? 0));
      const safeSubtotalWithoutIgv = line
        ? roundCurrency(Number(line.importeWithoutIgv ?? 0))
        : roundCurrency((safeUnitPriceWithIgv / IGV_FACTOR) * safeQuantity);
      const safeIgv = line
        ? roundCurrency(Number(line.igv ?? 0))
        : roundCurrency(
            safeUnitPriceWithIgv * safeQuantity - safeSubtotalWithoutIgv,
          );

      return {
        item: index + 1,
        unidadMedida:
          line?.unitCode ?? normalizeSunatUnitCode(item.unidadMedida),
        cantidad: safeQuantity,
        precio: safeUnitPriceWithIgv,
        importe: safeSubtotalWithoutIgv,
        precioSinImpuesto:
          line?.unitPriceWithoutIgv ??
          (safeQuantity > 0
            ? roundCurrency(safeSubtotalWithoutIgv / safeQuantity)
            : 0),
        igv: safeIgv,
        codTipoOperacion: "10",
        codigo: "50161509",
        codigoSunat: "50161509",
        descripcion: safeTrim(item.nombre) || "Producto",
        descuento: 0,
        subTotal: safeSubtotalWithoutIgv,
      };
    });

    const payload = {
      DOCU_ID: ticketIdNumber,
      TIPO_OPERACION: "0101",
      HORA_REGISTRO: horaRegistro,
      NRO_COMPROBANTE: nroComprobanteNc,
      FECHA_DOCUMENTO: fechaIso,
      FECHA_VTO: fechaIso,
      COD_TIPO_DOCUMENTO: "07",
      COD_MONEDA: "PEN",
      TIPO_COMPROBANTE_MODIFICA: docTypeCode === "01" ? "01" : "03",
      NRO_DOCUMENTO_MODIFICA: originalDoc,
      COD_TIPO_MOTIVO: "01",
      DESCRIPCION_MOTIVO: "ANULACION DE LA OPERACION",
      NRO_DOCUMENTO_EMPRESA: safeTrim(companyRucFromSession),
      TIPO_DOCUMENTO_EMPRESA: "6",
      RAZON_SOCIAL_EMPRESA:
        safeTrim(companyNameFromSession) ||
        safeTrim(companyCommercialFromSession) ||
        "EMPRESA",
      NOMBRE_COMERCIAL_EMPRESA:
        safeTrim(companyCommercialFromSession) ||
        safeTrim(companyNameFromSession) ||
        "EMPRESA",
      CODIGO_UBIGEO_EMPRESA: safeTrim(companyUbigeoCodeFromSession) || "150101",
      DIRECCION_EMPRESA: safeTrim(companyAddressSunatFromSession) || "-",
      DEPARTAMENTO_EMPRESA: safeTrim(companyUbigeoNameFromSession) || "LIMA",
      PROVINCIA_EMPRESA: safeTrim(companyUbigeoNameFromSession) || "LIMA",
      DISTRITO_EMPRESA: safeTrim(companyUbigeoNameFromSession) || "LIMA",
      CODIGO_PAIS_EMPRESA: "PE",
      NRO_DOCUMENTO_CLIENTE: clienteDocumento || "00000000",
      TIPO_DOCUMENTO_CLIENTE: tipoDocumentoCliente,
      RAZON_SOCIAL_CLIENTE: safeTrim(customerName) || "CLIENTE VARIOS",
      DIRECCION_CLIENTE: "-",
      CIUDAD_CLIENTE: safeTrim(companyUbigeoNameFromSession) || "LIMA",
      COD_PAIS_CLIENTE: "PE",
      COD_UBIGEO_CLIENTE: safeTrim(companyUbigeoCodeFromSession) || "150101",
      DEPARTAMENTO_CLIENTE: safeTrim(companyUbigeoNameFromSession) || "LIMA",
      PROVINCIA_CLIENTE: safeTrim(companyUbigeoNameFromSession) || "LIMA",
      DISTRITO_CLIENTE: safeTrim(companyUbigeoNameFromSession) || "LIMA",
      USUARIO_SOL_EMPRESA: safeTrim(usuarioSolFromSession),
      PASS_SOL_EMPRESA: safeTrim(claveSolFromSession),
      CONTRA_FIRMA: safeTrim(claveCertificadoFromSession),
      TIPO_PROCESO: tipoProceso,
      RUTA_PFX: safeTrim(certificadoBase64FromSession),
      SUB_TOTAL: Number(gravada.toFixed(2)),
      TOTAL_IGV: Number(igvAmount.toFixed(2)),
      TOTAL: Number(documentTotalWithIgv.toFixed(2)),
      TOTAL_GRAVADAS: Number(gravada.toFixed(2)),
      TOTAL_EXONERADAS: 0,
      TOTAL_INAFECTA: 0,
      TOTAL_GRATUITAS: 0,
      TOTAL_DESCUENTO: Number(descuento.toFixed(2)),
      TOTAL_ICBPER: 0,
      TOTAL_OTR_IMP: 0,
      POR_IGV: 18,
      TOTAL_LETRAS: numberToWords(documentTotalWithIgv, "SOLES"),
      FORMA_PAGO: formaPagoNc,
      formaPago: formaPagoNc,
      docuSerie: docuSerieNc,
      DocuSerie: docuSerieNc,
      DOCU_SERIE: docuSerieNc,
      DocuConcepto: "ANULACION DE LA OPERACION",
      docuConcepto: "ANULACION DE LA OPERACION",
      GLOSA: "ANULACION DE LA OPERACION",
      detalle,
    };

    const confirmed = await confirmWithAppDialog({
      title: "Enviar nota de crédito",
      content: (
        <p>¿Desea generar la nota de crédito para la factura {originalDoc}?</p>
      ),
      confirmText: "Enviar",
    });
    if (!confirmed) return;

    setIsSendingCreditNote(true);
    try {
      const response = await apiRequest({
        url: buildApiUrl("/Nota/credito/enviar"),
        method: "POST",
        data: payload,
        config: {
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
          },
        },
        fallback: null,
      });

      const responseObj =
        response && typeof response === "object"
          ? (response as {
              ok?: unknown;
              flg_rta?: unknown;
              FlgRta?: unknown;
              cod_sunat?: unknown;
              codSunat?: unknown;
              COD_SUNAT?: unknown;
              mensaje?: unknown;
              message?: unknown;
              Message?: unknown;
              msj_sunat?: unknown;
              MSJ_SUNAT?: unknown;
              isAxiosError?: unknown;
              response?: {
                data?: {
                  mensaje?: unknown;
                  message?: unknown;
                };
              };
            })
          : null;

      const sunatCode = safeTrim(
        responseObj?.cod_sunat ??
          responseObj?.codSunat ??
          responseObj?.COD_SUNAT ??
          "",
      );
      const responseMessage = safeTrim(
        responseObj?.mensaje ??
          responseObj?.message ??
          responseObj?.Message ??
          responseObj?.msj_sunat ??
          responseObj?.MSJ_SUNAT ??
          responseObj?.response?.data?.mensaje ??
          responseObj?.response?.data?.message ??
          (typeof response === "string" ? response : ""),
      );
      const isSuccess =
        Boolean(responseObj?.ok) ||
        safeTrim(responseObj?.flg_rta ?? responseObj?.FlgRta) === "1" ||
        sunatCode === "0" ||
        sunatCode === "0000";

      if (
        !isSuccess ||
        !response ||
        response === false ||
        Boolean(responseObj?.isAxiosError)
      ) {
        toast.error(responseMessage || "No se pudo enviar la nota de credito.");
        return;
      }

      if (sunatCode) {
        toast.success(
          `${responseMessage || "Nota de credito enviada correctamente."} Codigo SUNAT: ${sunatCode}`,
        );
      } else {
        toast.success(
          responseMessage || "Nota de credito enviada correctamente.",
        );
      }

      await fetchNotaFromServer(ticketIdNumber);
    } catch (error) {
      console.error("Error al enviar nota de credito", error);
      toast.error("No se pudo enviar la nota de credito.");
    } finally {
      setIsSendingCreditNote(false);
    }
  };

  const createComprobanteBlob = useCallback(async () => {
    const clean = (value: unknown) => String(value ?? "").trim();
    const now = new Date();
    const emissionDateISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const qrDocTypeCode =
      ticketPreviewProps.docType === "factura"
        ? "01"
        : ticketPreviewProps.docType === "boleta"
          ? "03"
          : "";
    const qrClientDocTypeCode =
      ticketPreviewProps.docType === "factura" ? "06" : "01";
    const qrClientDoc =
      clean(ticketPreviewProps.clientId) ||
      (qrClientDocTypeCode === "06" ? "00000000000" : "00000000");
    const qrIgv = Number(ticketPreviewProps.summary?.igv);
    const qrTotal = Number(ticketPreviewProps.summary?.total);
    const safeQrIgv = Number.isFinite(qrIgv) ? Math.max(0, qrIgv) : 0;
    const safeQrTotal = Number.isFinite(qrTotal) ? Math.max(0, qrTotal) : 0;

    let preGeneratedQrBase64 = "";
    if (qrDocTypeCode) {
      const qrData = [
        clean(ticketPreviewProps.companyRuc) || "20601070155",
        qrDocTypeCode,
        clean(ticketPreviewProps.documentNumber) || "-",
        safeQrIgv.toFixed(2),
        safeQrTotal.toFixed(2),
        emissionDateISO,
        qrClientDocTypeCode,
        qrClientDoc,
      ].join("|");

      preGeneratedQrBase64 = await generateTicketQrBase64(qrData);
    }

    return pdf(
      <TicketDocument
        {...ticketPreviewProps}
        preGeneratedQrBase64={preGeneratedQrBase64}
      />,
    ).toBlob();
  }, [ticketPreviewProps]);

  const getComprobanteFileName = useCallback(() => {
    const safeCorrelative =
      safeTrim(documentNumber).replace(/[^a-zA-Z0-9-_]/g, "_") ||
      `COMPROBANTE_${Date.now()}`;
    return `${safeCorrelative}.pdf`;
  }, [documentNumber]);

  const shareByWhatsApp = useCallback(async () => {
    if (isNotaAnulada) {
      toast.error("Documento anulado. Envío por WhatsApp no permitido.");
      return;
    }
    if (!isConfirmed) {
      toast.error("Debe confirmar el documento antes de compartir.");
      return;
    }

    const safeDocNumber = safeTrim(documentNumber) || "SIN-NUMERO";
    const message = [
      `Comprobante: ${safeDocNumber}`,
      `Cliente: ${safeTrim(customerName) || "PUBLICO GENERAL"}`,
      `Total: S/ ${totalAPagar.toFixed(2)}`,
    ].join("\n");

    const blob = await createComprobanteBlob();
    const fileName = getComprobanteFileName();
    const file = new File([blob], fileName, { type: "application/pdf" });

    if (typeof navigator.share === "function") {
      try {
        const canShareFile =
          typeof navigator.canShare === "function"
            ? navigator.canShare({ files: [file] })
            : true;

        if (canShareFile) {
          await navigator.share({
            title: "Comprobante de pago",
            text: message,
            files: [file],
          });
          toast.success("Panel de compartir abierto.");
          return;
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    toast.info("No se pudo abrir el panel de compartir en este dispositivo.");
  }, [
    createComprobanteBlob,
    customerName,
    documentNumber,
    getComprobanteFileName,
    isConfirmed,
    isNotaAnulada,
    totalAPagar,
  ]);

  const handleDownloadComprobante = useCallback(async () => {
    if (isNotaAnulada) {
      toast.error("Documento anulado. Descarga no permitida.");
      return;
    }
    if (!isConfirmed) {
      toast.error("Debe confirmar el documento antes de descargar.");
      return;
    }

    try {
      setIsDownloadingComprobante(true);
      const blob = await createComprobanteBlob();
      const fileName = getComprobanteFileName();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    } catch (error) {
      console.error("No se pudo descargar comprobante", error);
      toast.error("No se pudo descargar el comprobante.");
    } finally {
      setIsDownloadingComprobante(false);
    }
  }, [
    createComprobanteBlob,
    getComprobanteFileName,
    isConfirmed,
    isNotaAnulada,
  ]);

  const handlePrint = async (options?: { skipConfirmedCheck?: boolean }) => {
    const skipConfirmedCheck = options?.skipConfirmedCheck === true;
    if (isNotaAnulada) {
      toast.error("Documento anulado. Impresión no permitida.");
      return;
    }
    if (!skipConfirmedCheck && !isConfirmed) {
      toast.error("Debe confirmar el documento antes de imprimir.");
      return;
    }

    const printableItems = itemsToRender.length
      ? itemsToRender
      : purchasedItems;
    const invalidItems = printableItems.filter(
      hasInvalidQuantityOrStockForPayment,
    );
    if (invalidItems.length) {
      toast.error("No puede imprimir con productos en 0.");
      return;
    }

    try {
      setIsPrinting(true);
      await createComprobanteBlob();

      /** const res = await fetch("http://localhost:3000/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64: base64, printerName }),
      });
      const data = await res.json(); 
       if (!res.ok || !data.ok) {
        throw new Error(data.error || "Error al imprimir");
      }
      toast.success("Impresión enviada");
      */
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo imprimir";
      toast.error(message);
    } finally {
      setIsPrinting(false);
    }
  };
  if (!itemsToRender.length) {
    return (
      <div className="space-y-4">
        {shouldShowOrderNotesDocumentAction && (
          <button
            type="button"
            className={`inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${orderNotesDocumentActionClass}`}
            onClick={handleOrderNotesDocumentAction}
            disabled={isPersistingToDb || orderNotesDocumentActionPending}
          >
            {canResendRejectedDocumentFromOrderNotes ? (
              <RefreshCw
                className={`h-4 w-4 ${isResendingDocument ? "animate-spin" : ""}`}
              />
            ) : shouldShowCreditNoteAction ? (
              <Receipt className="h-4 w-4" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {orderNotesDocumentActionLabel}
          </button>
        )}
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <ArrowLeft className="w-4 h-4" />
          <Link
            to={backRoute}
            className="text-blue-600 hover:underline"
            onClick={(e) => handleBackToPos(e)}
          >
            {backLabel}
          </Link>
        </div>
        <div className="bg-white rounded-xl shadow p-6 text-center text-gray-600">
          No hay ítems para pagar.
        </div>
      </div>
    );
  }

  const ItemsList = (
    <div
      data-payment-items-list="true"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      <div className="sm:hidden max-h-[62vh] overflow-y-auto divide-y divide-slate-200">
        {itemsToRender.map((item, rowIndex) => {
          const isZeroOrNegative = (item.cantidad ?? 0) <= 0;
          const minPrice = Math.max(0, Number(item.precioMinimo ?? 0) || 0);
          const displayLine = getDisplayLineAmounts(item, rowIndex);

          return (
            <article
              key={getCartItemKey(item)}
              className={`p-3 ${isZeroOrNegative ? "bg-red-50/70" : "bg-white"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold leading-snug text-slate-900">
                    {item.nombre}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {item.unidadMedida || "UND"}
                    {item.stock !== undefined ? ` · Stock: ${item.stock}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="h-7 w-7 shrink-0 rounded-md border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => handleRemoveItem(getCartItemKey(item))}
                  disabled={!canEditItems}
                  title="Quitar"
                >
                  <Trash2 className="mx-auto h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Cantidad
                  </p>
                  {canEditItems ? (
                    <input
                      type="number"
                      min={0}
                      step="1"
                      inputMode="numeric"
                      className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-center text-sm outline-none appearance-none [appearance:textfield] focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      value={item.cantidad === 0 ? "" : item.cantidad}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "") {
                          handleQuantityChange(item, -item.cantidad);
                          return;
                        }
                        const parsed = Number(value);
                        if (Number.isNaN(parsed)) return;
                        const desired = Math.max(0, parsed);
                        handleQuantityChange(
                          item,
                          desired - (item.cantidad ?? 0),
                        );
                      }}
                      onFocus={(e) => e.target.select()}
                      disabled={!canEditItems}
                      style={{ MozAppearance: "textfield" }}
                    />
                  ) : (
                    <p className="mt-1 text-base font-semibold text-slate-800">
                      {item.cantidad}
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    P. Uni
                  </p>
                  {canEditItems ? (
                    <div className="mt-1 inline-flex h-9 w-full items-center gap-1 rounded-md border border-slate-300 bg-white px-2">
                      <span className="text-xs text-slate-500">S/</span>
                      <input
                        type="number"
                        min={minPrice}
                        step="0.01"
                        inputMode="decimal"
                        className="w-full border-0 bg-transparent text-right text-sm outline-none appearance-none [appearance:textfield] disabled:text-slate-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        value={priceDrafts[getCartItemKey(item)] ?? item.precio}
                        onChange={(e) => {
                          handlePriceChange(item, e.target.value);
                        }}
                        onBlur={(e) => {
                          handlePriceBlur(item, e.currentTarget.value);
                        }}
                        onFocus={(e) => e.target.select()}
                        disabled={!canEditItems}
                        style={{ MozAppearance: "textfield" }}
                      />
                    </div>
                  ) : (
                    <p className="mt-1 text-base font-semibold text-slate-800">
                      S/ {displayLine.unitPriceWithIgv.toFixed(2)}
                    </p>
                  )}
                </div>

                <div className="col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      Importe
                    </p>
                    <p
                      className={`text-lg font-semibold ${
                        isZeroOrNegative ? "text-red-600" : "text-slate-900"
                      }`}
                    >
                      S/ {displayLine.totalWithIgv.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden sm:block max-h-[min(58vh,620px)] md:max-h-[60vh] overflow-auto">
        <div className="min-w-[560px] lg:min-w-[640px]">
          <div className="sticky top-0 z-10 grid grid-cols-[96px_minmax(0,1fr)_120px_130px] border-b-2 border-slate-800 bg-white px-3 py-2 text-sm font-semibold tracking-wide text-slate-800">
            <div className="text-center">Cantidad</div>
            <div>Descripción</div>
            <div className="text-right">P.Uni</div>
            <div className="text-right">Importe</div>
          </div>

          <div className="divide-y divide-slate-200">
            {itemsToRender.map((item, rowIndex) => {
              const isZeroOrNegative = (item.cantidad ?? 0) <= 0;
              const minPrice = Math.max(0, Number(item.precioMinimo ?? 0) || 0);
              const displayLine = getDisplayLineAmounts(item, rowIndex);

              return (
                <div
                  key={getCartItemKey(item)}
                  className={`grid grid-cols-[96px_minmax(0,1fr)_120px_130px] items-start px-3 py-3 ${
                    isZeroOrNegative ? "bg-red-50/70" : "bg-white"
                  }`}
                >
                  <div className="flex items-start justify-center pt-1">
                    {canEditItems ? (
                      <input
                        type="number"
                        min={0}
                        step="1"
                        inputMode="numeric"
                        data-payment-column="quantity"
                        data-payment-row-index={rowIndex}
                        className="h-9 w-16 rounded-md border border-slate-300 py-1 text-center text-sm outline-none appearance-none [appearance:textfield] focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                        value={item.cantidad === 0 ? "" : item.cantidad}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "") {
                            handleQuantityChange(item, -item.cantidad);
                            return;
                          }
                          const parsed = Number(value);
                          if (Number.isNaN(parsed)) return;
                          const desired = Math.max(0, parsed);
                          handleQuantityChange(
                            item,
                            desired - (item.cantidad ?? 0),
                          );
                        }}
                        onKeyDown={(event) =>
                          handleColumnArrowNavigation(
                            event,
                            "quantity",
                            rowIndex,
                          )
                        }
                        onFocus={(e) => e.target.select()}
                        disabled={!canEditItems}
                        style={{ MozAppearance: "textfield" }}
                      />
                    ) : (
                      <span className="inline-flex h-9 min-w-10 items-center justify-center text-lg">
                        {item.cantidad}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 pr-3">
                    <p className="break-words text-base leading-snug text-slate-900">
                      {item.nombre}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.unidadMedida || "UND"}
                      {item.stock !== undefined
                        ? ` · Stock: ${item.stock}`
                        : ""}
                    </p>
                  </div>

                  <div className="pt-1 text-right">
                    {canEditItems ? (
                      <div className="inline-flex h-9 items-center justify-end gap-1 rounded-md border border-slate-300 bg-white px-2">
                        <span className="text-xs text-slate-500">S/</span>
                        <input
                          type="number"
                          min={minPrice}
                          step="0.01"
                          inputMode="decimal"
                          data-payment-column="price"
                          data-payment-row-index={rowIndex}
                          className="w-16 border-0 bg-transparent text-right text-sm outline-none appearance-none [appearance:textfield] disabled:text-slate-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          value={
                            priceDrafts[getCartItemKey(item)] ?? item.precio
                          }
                          onChange={(e) => {
                            handlePriceChange(item, e.target.value);
                          }}
                          onBlur={(e) => {
                            handlePriceBlur(item, e.currentTarget.value);
                          }}
                          onKeyDown={(event) =>
                            handleColumnArrowNavigation(
                              event,
                              "price",
                              rowIndex,
                            )
                          }
                          onFocus={(e) => e.target.select()}
                          disabled={!canEditItems}
                          style={{ MozAppearance: "textfield" }}
                        />
                      </div>
                    ) : (
                      <span className="inline-block pt-1 text-xl leading-none text-slate-900">
                        {displayLine.unitPriceWithIgv.toFixed(2)}
                      </span>
                    )}
                  </div>

                  <div className="pt-1">
                    <div className="flex items-start justify-end gap-2">
                      <p
                        className={`pt-1 text-right text-xl leading-none ${
                          isZeroOrNegative ? "text-red-600" : "text-slate-900"
                        }`}
                      >
                        {displayLine.totalWithIgv.toFixed(2)}
                      </p>
                      <button
                        type="button"
                        className="h-6 w-6 shrink-0 rounded-md border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => handleRemoveItem(getCartItemKey(item))}
                        disabled={!canEditItems}
                        title="Quitar"
                      >
                        <Trash2 className="mx-auto h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  const PdfViewerCard = (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
      {isPdfEnabled ? (
        canPreviewPdf ? (
          <div className="h-[68vh] min-h-[420px] sm:h-[620px]">
            <PDFViewer
              key={previewKey}
              style={{ width: "100%", height: "100%" }}
              showToolbar={false}
            >
              <TicketDocument {...ticketPreviewProps} />
            </PDFViewer>
          </div>
        ) : (
          <div className="p-4 text-xs text-gray-500">
            Cargando vista previa del comprobante...
          </div>
        )
      ) : (
        <div className="p-4 text-xs text-gray-500">
          Vista PDF deshabilitada en celular.
        </div>
      )}
      {isNotaAnulada ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span className="select-none rounded-xl border-4 border-red-500/70 bg-white/45 px-8 py-3 text-5xl font-black tracking-[0.22em] text-red-600/85 [transform:rotate(-24deg)]">
            ANULADO
          </span>
        </div>
      ) : null}
    </div>
  );

  const renderForm = () => (
    <>
      <HookForm
        methods={formMethods}
        onSubmit={confirmPayment}
        preventSubmitOnEnter
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="fixed inset-x-0 top-[calc(var(--app-shell-header-h)+0.35rem)] z-[90] px-3 pt-2 md:hidden">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {!formLocked && (
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                  disabled={isPersistingToDb}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {isSubmitting ? "Guardando..." : "Confirmar"}
                </button>
              )}
              {shouldShowOrderNotesDocumentAction && (
                <button
                  type="button"
                  className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${orderNotesDocumentActionClass}`}
                  onClick={handleOrderNotesDocumentAction}
                  disabled={isPersistingToDb || orderNotesDocumentActionPending}
                >
                  {canResendRejectedDocumentFromOrderNotes ? (
                    <RefreshCw
                      className={`h-4 w-4 ${isResendingDocument ? "animate-spin" : ""}`}
                    />
                  ) : shouldShowCreditNoteAction ? (
                    <Receipt className="h-4 w-4" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {orderNotesDocumentActionLabel}
                </button>
              )}
              {isConfirmed && isProforma && !isNotaAnulada && (
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-orange-300 bg-white px-3 py-2 text-xs font-medium text-orange-800 transition-colors hover:bg-orange-50"
                  onClick={handleEnableEditing}
                >
                  {isReadOnlyNoteView ? "Ir a edición" : "Editar"}
                </button>
              )}
              {isConfirmed && (
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-medium text-green-800 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => {
                    void shareByWhatsApp();
                  }}
                  disabled={isNotaAnulada}
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </button>
              )}
              {isConfirmed && (
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-100 disabled:opacity-50"
                  onClick={() => {
                    void handleDownloadComprobante();
                  }}
                  disabled={isDownloadingComprobante || isNotaAnulada}
                >
                  <Download className="h-4 w-4" />
                  {isDownloadingComprobante
                    ? "Descargando..."
                    : isNotaAnulada
                      ? "No descargable"
                      : "Descargar PDF"}
                </button>
              )}
              {isPdfEnabled && (
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => handlePrint()}
                  disabled={isPrinting || !isConfirmed || isNotaAnulada}
                >
                  <Printer className="h-4 w-4" />
                  {isPrinting ? "Imprimiendo..." : "Imprimir"}
                </button>
              )}
            </div>
          </div>
        </div>
        <Link
          to={backRoute}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 md:hidden"
          onClick={(e) => handleBackToPos(e)}
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </Link>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
          <div className="rounded-lg border border-slate-200 bg-amber-50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Ítems
            </p>
            <p className="text-sm font-semibold text-slate-800">
              {itemsToRender.length}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2 text-right bg-green-50">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">
              Total
            </p>
            <p className="text-sm font-semibold text-slate-800">
              S/ {totalAPagar.toFixed(2)}
            </p>
          </div>
        </div>

        <HookFormSelect
          name="docTypeCode"
          label="Tipo de documento"
          disabled={formLocked}
          rules={{
            validate: (value) =>
              value && value !== "SELECCIONAR"
                ? true
                : "Seleccione un tipo de documento",
          }}
          options={[
            { value: "SELECCIONAR", label: "SELECCIONAR" },
            { value: "101", label: "Proforma V" },
            { value: "03", label: "Boleta" },
            { value: "01", label: "Factura" },
          ]}
        />
        <HookFormSelect
          name="paymentMethod"
          label="Forma de pago"
          disabled={formLocked}
          onChange={() => {
            window.requestAnimationFrame(() => {
              setFocus("customerName");
            });
          }}
          options={[
            { value: "EFECTIVO", label: "Efectivo" },
            { value: "TARJETA", label: "Tarjeta" },
            { value: "TRANSFERENCIA", label: "Transferencia" },
            { value: "YAPE", label: "Yape" },
          ]}
        />
        <HookFormAutocomplete
          name="customerName"
          label="Nombre del cliente"
          placeholder="Seleccionar cliente"
          options={docTypeCode === "01" ? facturaClientOptions : clientOptions}
          rules={{
            validate: (value: any) => {
              if (docTypeCode !== "01") return true;
              const normalized = safeTrim(value);
              if (!normalized) {
                return "Nombre de cliente obligatorio para Factura";
              }
              if (normalized.toUpperCase() === "VARIOS") {
                return "Para Factura el cliente no puede ser VARIOS";
              }
              return true;
            },
          }}
          syncInputToValue
          onInputValueChange={queueClientSearch}
          disableClearable={formLocked}
          disabled={formLocked}
          onInputBlur={({ inputValue }) => {
            ensureExistingCustomerByName(inputValue);
          }}
          onOptionSelected={(opt: any) => {
            if (!opt) {
              setValue("customerName", "", { shouldDirty: true });
              setValue("customerId", "", { shouldDirty: true });
              setClienteIdFromOption(null, { shouldDirty: true });
              return;
            }

            const selectedName = safeTrim(opt.nombreRazon ?? opt.label ?? "");
            const docValue =
              docTypeCode === "01" ? safeTrim(opt.ruc) : safeTrim(opt.dni);

            setValue("customerName", selectedName, { shouldDirty: true });
            setValue("customerId", docValue || "", { shouldDirty: true });
            setClienteIdFromOption(opt, { shouldDirty: true });
          }}
        />
        {docTypeCode === "01" ? (
          <HookFormAutocomplete
            name="customerId"
            label="RUC"
            placeholder="Número de RUC"
            options={facturaRucOptions}
            rules={{ validate: validateRucLength }}
            disableClearable={formLocked}
            disabled={formLocked}
            allowCreate
            createLabel={(value: string) => `Usar RUC: ${value}`}
            onInputValueChange={queueClientSearch}
            filterOptions={documentFilterOptions as any}
            isOptionEqualToValue={(option: any, value: any) =>
              String(option?.value) === String((value as any)?.value ?? value)
            }
            onOptionSelected={(opt: any) => {
              if (!opt) {
                setValue("customerId", "", { shouldDirty: true });
                setClienteIdFromOption(null, { shouldDirty: true });
                return;
              }

              const selectedDoc = resolveDocumentValue(opt, "ruc");
              const selectedName = safeTrim(opt?.nombreRazon ?? "");

              setValue("customerId", selectedDoc, { shouldDirty: true });
              if (selectedName) {
                setValue("customerName", selectedName, { shouldDirty: true });
                setClienteIdFromOption(opt, { shouldDirty: true });
                return;
              }

              // Documento manual (freeSolo): no cliente asociado.
              setClienteIdFromOption(null, { shouldDirty: true });
            }}
          />
        ) : (
          <HookFormAutocomplete
            name="customerId"
            label="DNI"
            placeholder="Número de DNI"
            options={dniOptions}
            rules={{ validate: validateDniLength }}
            disableClearable={formLocked}
            disabled={formLocked}
            allowCreate
            createLabel={(value: string) => `Usar DNI: ${value}`}
            onInputValueChange={queueClientSearch}
            filterOptions={documentFilterOptions as any}
            isOptionEqualToValue={(option: any, value: any) =>
              String(option?.value) === String((value as any)?.value ?? value)
            }
            onOptionSelected={(opt: any) => {
              if (!opt) {
                setValue("customerId", "", { shouldDirty: true });
                setClienteIdFromOption(null, { shouldDirty: true });
                return;
              }

              const selectedDoc = resolveDocumentValue(opt, "dni");
              const selectedName = safeTrim(opt?.nombreRazon ?? "");

              setValue("customerId", selectedDoc, { shouldDirty: true });
              if (selectedName) {
                setValue("customerName", selectedName, { shouldDirty: true });
                setClienteIdFromOption(opt, { shouldDirty: true });
                return;
              }

              // Documento manual (freeSolo): no cliente asociado.
              setClienteIdFromOption(null, { shouldDirty: true });
            }}
          />
        )}
        {!formLocked && (
          <button
            type="button"
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            onClick={handleOpenCreateClientModal}
          >
            <UserPlus className="h-4 w-4" />
            Agregar cliente
          </button>
        )}
        {paymentMethod !== "EFECTIVO" && (
          <HookFormSelect
            name="bankEntity"
            label="Entidad bancaria"
            disabled={formLocked || paymentMethod === "TARJETA"}
            rules={{
              validate: (value: any) => {
                if (
                  paymentMethod !== "YAPE" &&
                  paymentMethod !== "TRANSFERENCIA"
                ) {
                  return true;
                }
                const normalized = safeTrim(value);
                return normalized && normalized !== "-"
                  ? true
                  : "Entidad bancaria obligatoria";
              },
            }}
            options={[
              { value: "-", label: "-" },
              { value: "BCP", label: "BCP" },
              { value: "INTERBANK", label: "INTERBANK" },
              { value: "CONTINENTAL", label: "CONTINENTAL" },
            ]}
          />
        )}
        {paymentMethod !== "EFECTIVO" && (
          <HookFormInput
            name="nroOperacion"
            label="N° Operación"
            disabled={formLocked}
            placeholder="Número de operación"
            rules={{
              validate: (value: any) => {
                if (
                  paymentMethod !== "TARJETA" &&
                  paymentMethod !== "YAPE" &&
                  paymentMethod !== "TRANSFERENCIA"
                ) {
                  return true;
                }
                return safeTrim(value) ? true : "N° de operación obligatorio";
              },
            }}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-gray-700">
          <span className="font-medium">Aplica descuento</span>
          <input
            type="checkbox"
            className="w-4 h-4 accent-slate-700 rounded"
            disabled={formLocked}
            checked={applyDiscount}
            {...register("applyDiscount", {
              onChange: (e) => {
                const checked = Boolean(e.target.checked);
                setValue("applyDiscount", checked, {
                  shouldDirty: true,
                });
                if (!checked || formLocked) return;
                window.setTimeout(() => {
                  const input = document.querySelector<HTMLInputElement>(
                    '[data-discount-input="true"]',
                  );
                  if (!input || input.disabled) return;
                  input.focus();
                  input.select?.();
                }, 0);
              },
            })}
          />
        </div>
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div className="flex justify-between text-sm text-gray-700">
            <span>Op. gravada</span>
            <span className="font-semibold">S/ {gravada.toFixed(2)}</span>
          </div>

          {applyDiscount && (
            <div className="flex items-center justify-between gap-3 text-sm text-gray-700">
              <span>Descuento</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500">S/</span>
                <HookFormInput
                  name="discount"
                  label=""
                  type="number"
                  min={0}
                  max={Number(maxDiscount.toFixed(2))}
                  step="0.01"
                  data-discount-input="true"
                  rules={{
                    validate: (value: any) => {
                      const numeric = Number(value ?? 0);
                      if (!Number.isFinite(numeric))
                        return "Descuento inválido";
                      if (numeric < 0)
                        return "El descuento no puede ser negativo";
                      return (
                        numeric <= maxDiscount ||
                        `No puede superar S/ ${maxDiscount.toFixed(2)}`
                      );
                    },
                  }}
                  className="w-20 text-right appearance-none sm:w-16 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  style={{ MozAppearance: "textfield" }}
                  onFocus={(e) => e.target.select()}
                  onBlur={(e) => {
                    const currentValue = Number(e.currentTarget.value ?? 0);
                    const clampedValue = clampDiscount(e.currentTarget.value);
                    if (
                      !Number.isFinite(currentValue) ||
                      currentValue !== clampedValue
                    ) {
                      setValue("discount", clampedValue, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }
                  }}
                  disabled={formLocked}
                />
              </div>
            </div>
          )}
          <div className="flex justify-between text-sm text-gray-700">
            <span>Sub total</span>
            <span className="font-semibold">S/ {gravada.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-700">
            <span>IGV (18%)</span>
            <span className="font-semibold">S/ {igvAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-slate-800">
            <span>Total pago</span>
            <span>S/ {totalAPagar.toFixed(2)}</span>
          </div>
        </div>
        {!formLocked && (
          <button
            type="submit"
            className="hidden w-full items-center justify-center gap-2 rounded-lg bg-slate-700 py-3 font-semibold text-white transition-colors hover:bg-slate-800 md:inline-flex"
            disabled={isPersistingToDb}
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-5 h-5" />
            )}
            {isSubmitting ? "Guardando..." : "Confirmar pago"}
          </button>
        )}
      </HookForm>
      <div className="hidden gap-2 sm:gap-3 md:grid">
        {isConfirmed && (
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-green-300 bg-green-50 py-2.5 text-green-800 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              void shareByWhatsApp();
            }}
            disabled={isNotaAnulada}
          >
            <MessageCircle className="w-5 h-5" />
            Enviar por WhatsApp
          </button>
        )}
        {isConfirmed && (
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-300 bg-blue-50 py-2.5 text-blue-800 transition-colors hover:bg-blue-100 disabled:opacity-50"
            onClick={() => {
              void handleDownloadComprobante();
            }}
            disabled={isDownloadingComprobante || isNotaAnulada}
          >
            <Download className="w-5 h-5" />
            {isDownloadingComprobante
              ? "Descargando..."
              : isNotaAnulada
                ? "No descargable"
                : "Descargar PDF"}
          </button>
        )}
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2.5 text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-50"
          onClick={() => handlePrint()}
          disabled={isPrinting || !isConfirmed || isNotaAnulada}
        >
          <Printer className="w-5 h-5" />
          {isPrinting ? "Imprimiendo..." : "Imprimir comprobante"}
        </button>
      </div>
    </>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-500">Confirmar cobro</p>
          <h1 className="text-xl font-semibold text-slate-800 sm:text-2xl">
            Pago y comprobante
          </h1>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Link
            to={backRoute}
            className="hidden w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 md:inline-flex"
            onClick={(e) => handleBackToPos(e)}
          >
            <ArrowLeft className="w-4 h-4" />
            {backLabel}
          </Link>
          {shouldShowOrderNotesDocumentAction && (
            <button
              type="button"
              className={`hidden items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex ${orderNotesDocumentActionClass}`}
              onClick={handleOrderNotesDocumentAction}
              disabled={isPersistingToDb || orderNotesDocumentActionPending}
            >
              {canResendRejectedDocumentFromOrderNotes ? (
                <RefreshCw
                  className={`h-4 w-4 ${isResendingDocument ? "animate-spin" : ""}`}
                />
              ) : shouldShowCreditNoteAction ? (
                <Receipt className="h-4 w-4" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {orderNotesDocumentActionLabel}
            </button>
          )}
          {isConfirmed && isProforma && !isNotaAnulada && (
            <button
              type="button"
              className="hidden items-center justify-center gap-2 rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm text-orange-800 transition-colors hover:bg-orange-50 md:inline-flex"
              onClick={handleEnableEditing}
            >
              {isReadOnlyNoteView ? "Ir a edición" : "Editar"}
            </button>
          )}
        </div>
      </div>
      {isPersistingToDb && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 backdrop-blur-[1px]">
          <div className="mx-4 inline-flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-xl border border-slate-200">
            <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
            <span className="text-sm font-medium text-slate-800">
              {persistDbMessage}
            </span>
          </div>
        </div>
      )}
      {/* Layout móvil/mediano: tabs combinados + formulario */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr] lg:gap-5 min-[1405px]:hidden">
        <section className="order-2 space-y-4 md:order-1">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-1 border-b border-slate-200 p-2 bg-slate-50">
              <button
                type="button"
                className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 sm:px-4 sm:py-3 ${
                  activeTab === "items"
                    ? "text-white bg-gradient-to-r from-slate-700 to-slate-800 shadow-md"
                    : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                }`}
                onClick={() => setActiveTab("items")}
              >
                Items ({itemsToRender.length})
              </button>
              {isPdfEnabled && (
                <button
                  type="button"
                  className={`flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200 sm:px-4 sm:py-3 ${
                    activeTab === "pdf"
                      ? "text-white bg-gradient-to-r from-slate-700 to-slate-800 shadow-md"
                      : "text-slate-600 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                  onClick={() => setActiveTab("pdf")}
                >
                  Comprobante
                </button>
              )}
            </div>

            <div className="p-3 sm:p-5">
              {activeTab === "items" && ItemsList}
              {activeTab === "pdf" && isPdfEnabled && PdfViewerCard}
            </div>
          </div>
        </section>

        <section className="order-1 space-y-4 md:order-2">
          {renderForm()}
        </section>
      </div>

      {/* Layout grande: 3 columnas optimizadas */}
      <div className="hidden min-[1405px]:grid grid-cols-[1.3fr_1.1fr_1fr] gap-5">
        {/* Comprobante PDF */}
        <section className="space-y-4">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5">
            {PdfViewerCard}
          </div>
        </section>

        {/* Items a cobrar */}
        <section className="space-y-4">
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-5">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">
                Items a cobrar
              </h2>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {itemsToRender.length}
              </span>
            </div>
            {ItemsList}
          </div>
        </section>

        {/* Formulario */}
        <section className="space-y-3">{renderForm()}</section>
      </div>
    </div>
  );
};

export default PaymentPage;
