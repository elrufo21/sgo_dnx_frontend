import { pdf } from "@react-pdf/renderer";
import {
  ArrowLeft,
  CheckCircle2,
  FileDown,
  FileUp,
  Plus,
  Printer,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router";
import CustomerDialogContent from "@/components/CustomerDialogContent";
import TicketDocument from "@/components/Ticket";
import { BlockingSpinner } from "@/components/common/BlockingSpinner";
import { HookForm } from "@/components/forms/HookForm";
import { SaleCaptureFormFields } from "@/components/sales/SaleCaptureFormFields";
import { generateTicketQrBase64 } from "@/components/ticketQr";
import { buildApiUrl, buildRootApiUrl } from "@/config";
import { ServiceInvoicePdfDocument } from "@/features/serviceInvoices/components/ServiceInvoicePdf";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { consultarDocumentoCliente } from "@/shared/helpers/documentLookup";
import {
  focusNextInput,
  focusPreviousInput,
} from "@/shared/helpers/focusNextInput";
import { toast } from "@/shared/ui/toast";
import { useDialogStore } from "@/store/app/dialog.store";
import { useAuthStore } from "@/store/auth/auth.store";
import { useClientsStore } from "@/store/customers/customers.store";
import { useOrderNoteStore } from "@/store/orderNote/orderNote.store";
import { useProductsStore } from "@/store/products/products.store";
import type { Client } from "@/types/customer";
import type { Product } from "@/types/product";
import type { PosCartItem } from "@/types/pos";
import type { ServiceInvoiceListItem } from "@/types/serviceInvoice";

type CaptureLine = { code: string; quantity: number };
type CaptureData = {
  transactionNumber: string;
  memberCode: string;
  customerName: string;
  customerEmail: string;
  ruc: string;
  date: string;
  discount: number;
  lines: CaptureLine[];
};
type SaleRow = {
  product: Product;
  code: string;
  description: string;
  quantity: number;
  price: number;
  cost: number;
  stock: number;
  pv: number;
  sv: number;
  matched: boolean;
};
type SaleForm = {
  concept: "MERCADERIA" | "SERVICIO";
  docTypeCode: "03" | "01" | "101";
  correlativeDisplay: string;
  condition: "ALCONTADO" | "CREDITO" | "PAGO/VARIOS";
  delivery: "INMEDIATA" | "POR ENTREGAR";
  emissionDate: string;
  paymentMethod:
    | "(SELECCIONE)"
    | "EFECTIVO"
    | "DEPOSITO"
    | "TARJETA"
    | "YAPE"
    | "EFECTIVO/DEPOSITO"
    | "TARJETA/EFECTIVO"
    | "YAPE/EFECTIVO"
    | "YAPE/DEPOSITO"
    | "TARJETA/DEPOSITO"
    | "-";
  bankEntity: string;
  operationNumber: string;
  paymentDeposit: string;
  paymentCash: string;
  customerName: string;
  customerEmail: string;
  customerDoc: string;
  customerRuc: string;
  address: string;
  memberCode: string;
  transactionNumber: string;
};
type LastTicket = { documentNumber: string; noteId: number } | null;
type Correlative = {
  numero: string;
  nroComprobante: string;
  serie: string;
} | null;
type ViewSunatStatus = {
  docuId: number;
  estadoSunat: string;
  docuEstado: string;
  notaDocu: string;
  xmlUrl: string;
  cdrUrl: string;
} | null;
type PagoVariosItem = {
  docuId: number;
  notaId: number;
  documento: string;
  codigo: string;
  razonSocial: string;
  monto: number;
  conceptoOBS: string;
};
type PagoVariosResponse = {
  ok?: boolean;
  count?: number;
  items?: PagoVariosItem[];
  mensaje?: string;
  resultado?: string;
};
type ManualSaleType = "VENTA LIBRE" | "POR PASAR AL OBS";
type SaleValidationError = { message: string; field?: keyof SaleForm };

const DOC_CONFIG = {
  "03": { docu: "BOLETA", serie: "BA01", ticket: "boleta" as const },
  "01": { docu: "FACTURA", serie: "FA01", ticket: "factura" as const },
  "101": { docu: "PROFORMA V", serie: "0001", ticket: "proforma" as const },
};
const PAYMENT_METHOD_OPTIONS = [
  "(SELECCIONE)",
  "EFECTIVO",
  "DEPOSITO",
  "TARJETA",
  "YAPE",
  "EFECTIVO/DEPOSITO",
  "TARJETA/EFECTIVO",
  "YAPE/EFECTIVO",
  "YAPE/DEPOSITO",
  "TARJETA/DEPOSITO",
];
const BANK_OPTIONS = [
  "(SELECCIONE)",
  "-",
  "BCP",
  "INTERBANK",
  "SCOTIABANK",
  "BBVA",
];

const defaultForm: SaleForm = {
  concept: "MERCADERIA",
  docTypeCode: "03",
  correlativeDisplay: "",
  condition: "ALCONTADO",
  delivery: "INMEDIATA",
  emissionDate: "",
  paymentMethod: "(SELECCIONE)",
  bankEntity: "-",
  operationNumber: "",
  paymentDeposit: "",
  paymentCash: "",
  customerName: "",
  customerEmail: "",
  customerDoc: "",
  customerRuc: "",
  address: "",
  memberCode: "",
  transactionNumber: "",
};
const safeTrim = (value: unknown) => String(value ?? "").trim();
const normalizeCode = (value: unknown) => safeTrim(value).toUpperCase();
const isValidEmail = (value: unknown) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeTrim(value));
const readText = (root: ParentNode, selector: string) =>
  root.querySelector(selector)?.textContent?.trim() ?? "";
const normalizeCaptureText = (value: unknown) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
const normalizeLabelText = (value: unknown) =>
  normalizeCaptureText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const compactSearchText = (value: unknown) =>
  normalizeLabelText(value).replace(/[^a-z0-9]+/g, "");
const normalizeDocumentText = (value: unknown) =>
  String(value ?? "").replace(/\D/g, "");
const isCustomerLabel = (value: unknown) =>
  /^(senores|senor\(a\)|cliente)\s*:?/.test(normalizeLabelText(value));
const cleanCustomerName = (value: unknown) =>
  normalizeCaptureText(value)
    .replace(/^(Señores|Senores|Señor\(a\)|Senor\(a\)|Cliente)\s*:?\s*/i, "")
    .replace(
      /\b(Fecha|Domicilio|Direcci[oó]n|Email|R\.?\s*U\.?\s*C|DNI)\s*:.*$/i,
      "",
    )
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, "")
    .trim();
const readValueAfterCustomerLabel = (section: Element | null) => {
  const nodes = Array.from(
    section?.querySelectorAll("label,span,td,div,p") ?? [],
  );
  for (let index = 0; index < nodes.length; index += 1) {
    if (!isCustomerLabel(nodes[index].textContent)) continue;
    for (
      let next = index + 1;
      next < Math.min(nodes.length, index + 5);
      next += 1
    ) {
      const candidate = cleanCustomerName(nodes[next].textContent);
      if (candidate && !isCustomerLabel(candidate)) return candidate;
    }
  }
  return "";
};
const readCustomerName = (root: ParentNode) => {
  const direct = cleanCustomerName(readText(root, "#section-2 span.fleft"));
  if (direct) return direct;

  const sections = ["#section-2", "#section-3", "#section-4", "#section-5"]
    .map((selector) => root.querySelector(selector))
    .filter((section): section is Element => Boolean(section));

  for (const section of sections) {
    const name = readValueAfterCustomerLabel(section);
    if (name) return name;
  }

  for (const section of sections) {
    const match = normalizeCaptureText(section.textContent).match(
      /(?:Se(?:ñ|n)ores|Se(?:ñ|n)or\(a\)|Cliente)\s*:?\s*(.+?)(?:\s+(?:Fecha|Domicilio|Direcci[oó]n|Email|R\.?\s*U\.?\s*C|DNI)\s*:|$)/i,
    );
    const name = cleanCustomerName(match?.[1] ?? "");
    if (name) return name;
  }

  return "";
};
const readEmail = (root: ParentNode) =>
  root.textContent?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? "";
const getClientCode = (client: Client | null | undefined) =>
  safeTrim(client?.clienteCodigo);
const isActiveClient = (client: Client | null | undefined) =>
  safeTrim(client?.estado).toUpperCase() === "ACTIVO";
const money = (value: number) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const integer = (value: number) =>
  Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
const safeRowNumber = (value: number) => (Number.isFinite(value) ? value : 0);
const isValidPeruRuc = (ruc: string) => {
  if (!/^\d{11}$/.test(ruc)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce(
    (total, weight, index) => total + Number(ruc[index]) * weight,
    0,
  );
  const digit = 11 - (sum % 11);
  return (digit === 10 ? 0 : digit === 11 ? 1 : digit) === Number(ruc[10]);
};
const minAllowedPrice = (row: SaleRow) => Math.max(0, safeRowNumber(row.cost));
const moveCaretToEnd = (input: HTMLInputElement) => {
  window.requestAnimationFrame(() => {
    const length = input.value.length;
    try {
      input.setSelectionRange(length, length);
    } catch {
      const value = input.value;
      input.value = "";
      input.value = value;
    }
  });
};
const focusPriceInput = (code: string) => {
  window.setTimeout(() => {
    const input = Array.from(
      document.querySelectorAll<HTMLInputElement>("[data-sale-price-input]"),
    ).find((element) => element.dataset.rowCode === code);
    input?.focus();
    input?.select();
  }, 0);
};
const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const parseNumber = (value: unknown) => {
  const chunks = String(value ?? "").match(/-?\d+(?:[.,]\d+)?/g) ?? [];
  return chunks.reduce((total, chunk) => {
    const parsed = Number(chunk.replace(",", "."));
    return Number.isFinite(parsed) ? total + parsed : total;
  }, 0);
};
const frameFileName = (html: string) => {
  const document = new DOMParser().parseFromString(html, "text/html");
  const src = document.querySelector("frame")?.getAttribute("src") ?? "";
  return decodeURIComponent(src.replace(/\\/g, "/")).split("/").pop() ?? "";
};
const parseNotaResult = (result: unknown) => {
  const resultRecord = asRecord(result);
  const raw =
    typeof result === "string"
      ? result
      : safeTrim(
          resultRecord?.resultado ??
            resultRecord?.Resultado ??
            resultRecord?.data ??
            "",
        );
  const [idRaw = "", numberRaw = ""] = raw.split("¬");
  return {
    noteId: Number(idRaw.match(/\d+/)?.[0] ?? 0),
    number: (numberRaw.match(/\d+/)?.[0] ?? numberRaw).padStart(8, "0"),
    raw,
  };
};
const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const asRecordList = (value: unknown) => {
  if (Array.isArray(value)) return value.map(asRecord).filter(Boolean);
  const record = asRecord(value);
  const items = record?.items ?? record?.data ?? record?.detalles;
  if (Array.isArray(items)) return items.map(asRecord).filter(Boolean);
  return record ? [record] : [];
};
const firstValue = (
  record: Record<string, unknown> | null,
  ...keys: string[]
) => keys.map((key) => record?.[key]).find((value) => value != null) ?? "";
const parseBooleanLike = (value: unknown) =>
  ["1", "true", "si", "sí", "yes"].includes(safeTrim(value).toLowerCase());
const parseSunatResult = (result: unknown) => {
  const root = asRecord(result);
  const sunat = asRecord(firstValue(root, "sunat", "Sunat"));
  const code =
    safeTrim(
      firstValue(root, "cod_sunat", "codSunat", "COD_SUNAT", "CodSunat"),
    ) ||
    safeTrim(
      firstValue(sunat, "cod_sunat", "codSunat", "COD_SUNAT", "CodSunat"),
    );
  const message =
    safeTrim(
      firstValue(
        root,
        "msj_sunat",
        "msjSunat",
        "MSJ_SUNAT",
        "MsjSunat",
        "mensaje",
        "Mensaje",
      ),
    ) ||
    safeTrim(
      firstValue(
        sunat,
        "msj_sunat",
        "msjSunat",
        "MSJ_SUNAT",
        "MsjSunat",
        "mensaje",
        "Mensaje",
      ),
    );
  const acceptedRaw =
    firstValue(root, "aceptado", "Aceptado", "ACEPTADO") ||
    firstValue(sunat, "aceptado", "Aceptado", "ACEPTADO", "ok", "Ok", "OK");
  const accepted =
    parseBooleanLike(acceptedRaw) ||
    safeTrim(firstValue(sunat, "flg_rta", "FlgRta")) === "1" ||
    code === "0" ||
    code === "0000";

  return { accepted, code, message };
};
const isRejectedSunatResult = (sunat: ReturnType<typeof parseSunatResult>) =>
  !sunat.accepted &&
  (Boolean(sunat.code && sunat.code !== "0" && sunat.code !== "0000") ||
    [sunat.code, sunat.message].some((value) =>
      safeTrim(value).toUpperCase().includes("RECHAZ"),
    ));
const parseCapture = (html: string): CaptureData => {
  const document = new DOMParser().parseFromString(html, "text/html");
  const table = document.querySelector("table");
  const ruc =
    `${readText(document, "#section-1 .medium-font.center-align")} ${readText(document, "#section-4")} ${readText(document, "#section-5")}`.trim();
  const sectionText = readText(document, "#section-6");
  const memberCode =
    sectionText.match(/No\.\s*de\s*Membres[ií]a\s*:?\s*([A-Z0-9-]+)/i)?.[1] ??
    readText(document, "#section-6 .fright.left-align")
      .replace("Miembro Telefono", "#")
      .replace("Miembro Teléfono", "#")
      .replace("No. de Membresia", "")
      .replace(":", "")
      .split("#")[0];
  const discountText = readText(document, "#discount .sections.summary")
    .replace("DISCOUNT", "")
    .trim();
  const lines =
    document.getElementById("section-6") && table
      ? Array.from(table.querySelectorAll("tr"))
          .slice(1)
          .map((row) => {
            const cells = Array.from(row.querySelectorAll("td"));
            return {
              code: normalizeCode(cells[0]?.textContent),
              quantity: parseNumber(cells[5]?.textContent),
            };
          })
          .filter((line) => line.code && line.quantity > 0)
      : [];

  return {
    transactionNumber: readText(document, "#section-6 .center.medium-font"),
    memberCode: safeTrim(memberCode),
    customerName: readCustomerName(document),
    customerEmail: readEmail(document),
    ruc,
    date: readText(
      document,
      ruc.toUpperCase().includes("FACTURA")
        ? "#section-5 .fleft"
        : "#section-3 .fleft",
    ),
    discount: parseNumber(discountText),
    lines,
  };
};
const productToRow = (
  product: Product,
  quantity: number,
  matched = true,
): SaleRow => ({
  product,
  code: product.codigo,
  description: product.nombre,
  quantity,
  price: Number(product.preVenta ?? product.preVentaB ?? 0),
  cost: Number(product.preCosto ?? 0),
  stock: Number(product.cantidad ?? 0),
  pv: Number(product.pv ?? 0),
  sv: Number(product.sv ?? 0),
  matched,
});
const readSession = () => {
  if (typeof window === "undefined") {
    return {
      companyId: 1,
      username: "USUARIO",
      companyName: "",
      companyRuc: "",
      companyAddress: "",
      companyDistrict: "",
      companyPhone: "",
      userId: 0,
    };
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = asRecord(
      JSON.parse(localStorage.getItem("sgo.auth.session") ?? "null"),
    );
  } catch {
    parsed = null;
  }
  const user = asRecord(parsed?.user);

  return {
    companyId:
      Number(user?.companyId ?? localStorage.getItem("companiaId") ?? 1) || 1,
    userId: Number(user?.id ?? parsed?.id ?? 0) || 0,
    username:
      safeTrim(user?.displayName) || safeTrim(user?.username) || "USUARIO",
    companyName:
      safeTrim(user?.companyCommercialName) || safeTrim(user?.companyName),
    companyRuc: safeTrim(user?.companyRuc),
    companyAddress: safeTrim(user?.companySunatAddress),
    companyDistrict: safeTrim(user?.companyUbigeoName),
    companyPhone: safeTrim(user?.companyPhone),
  };
};

export default function HtmlCaptureSalePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isNewRoute = location.pathname
    .replace(/\/+$/, "")
    .endsWith("/sales/html_capture/new");
  const routeNoteId = Number(id ?? 0);
  const isExistingRoute =
    !isNewRoute && Number.isFinite(routeNoteId) && routeNoteId > 0;
  const { viewedOrderNoteId, setViewedOrderNoteId } = useOrderNoteStore();
  const isFromOrderNotesView =
    isExistingRoute && viewedOrderNoteId === routeNoteId;
  const isReadOnly = isExistingRoute;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const externalCaptureKeyRef = useRef("");
  const appliedCaptureKeyRef = useRef("");
  const registerSaleRef = useRef(false);
  const focusedPagoVariosPaymentMethodRef = useRef("");
  const appliedClientRef = useRef<Client | null>(null);
  const capturedInvoiceApiClientRef = useRef<Client | null>(null);
  const capturedInvoiceApiRucRef = useRef("");
  const { products, fetchProducts, loading } = useProductsStore();
  const {
    clients,
    fetchClients,
    searchClients,
    fetchClientById,
    fetchClientByCodigo,
    addClient,
    updateClient,
    deleteClient,
    fetchClientMonthlyPvs,
  } = useClientsStore();
  const [capture, setCapture] = useState<CaptureData | null>(null);
  const [pendingExternalCapture, setPendingExternalCapture] =
    useState<CaptureData | null>(null);
  const [isApplyingCapture, setIsApplyingCapture] = useState(false);
  const [loadedRecordId, setLoadedRecordId] = useState<number | null>(null);
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [manualProductSearch, setManualProductSearch] = useState("");
  const [manualProductSearchFocused, setManualProductSearchFocused] =
    useState(false);
  const [manualProductIndex, setManualProductIndex] = useState(0);
  const [monthlyPvs, setMonthlyPvs] = useState(0);
  const [correlative, setCorrelative] = useState<Correlative>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastTicket, setLastTicket] = useState<LastTicket>(null);
  const [viewSunatStatus, setViewSunatStatus] = useState<ViewSunatStatus>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isVoidingTicket, setIsVoidingTicket] = useState(false);
  const [freeSaleReasonAsked, setFreeSaleReasonAsked] = useState(false);
  const [manualSaleType, setManualSaleType] =
    useState<ManualSaleType>("VENTA LIBRE");
  const [pagoVariosItems, setPagoVariosItems] = useState<PagoVariosItem[]>([]);
  const [pagoVariosSelectedIds, setPagoVariosSelectedIds] = useState<number[]>(
    [],
  );
  const [pagoVariosModalOpen, setPagoVariosModalOpen] = useState(false);
  const [isPagoVariosLoading, setIsPagoVariosLoading] = useState(false);
  const [isPagoVariosSaving, setIsPagoVariosSaving] = useState(false);
  const [pagoVariosFormaPago, setPagoVariosFormaPago] =
    useState("(SELECCIONE)");
  const [pagoVariosEntidad, setPagoVariosEntidad] = useState("-");
  const [pagoVariosOperacion, setPagoVariosOperacion] = useState("");
  const [pagoVariosDeposito, setPagoVariosDeposito] = useState("");
  const [pagoVariosDescripcion, setPagoVariosDescripcion] = useState("");
  const pagoVariosDescripcionRef = useRef<HTMLTextAreaElement | null>(null);
  const session = useMemo(readSession, []);
  const openDialog = useDialogStore((state) => state.openDialog);
  const closeDialog = useDialogStore((state) => state.closeDialog);
  const dialogOpen = useDialogStore((state) => state.open);
  const canCaptureData =
    useAuthStore((state) => state.user?.flagCaptura) === true;
  const formMethods = useForm<SaleForm>({ defaultValues: defaultForm });
  const form = formMethods.watch();
  const manualProductSearchRef = useRef<HTMLInputElement | null>(null);
  const isCapturedSale = Boolean(capture);
  const isLoadingRecord = isExistingRoute && loadedRecordId !== routeNoteId;
  const saleType = isCapturedSale ? "CASHBILL" : manualSaleType;
  const saleTypeForDatabase = isCapturedSale
    ? "VENTA"
    : manualSaleType === "POR PASAR AL OBS"
      ? "POR PASAR"
      : "VENTA LIBRE";

  useEffect(() => {
    if (dialogOpen || pagoVariosModalOpen) {
      setManualProductSearchFocused(false);
    }
  }, [dialogOpen, pagoVariosModalOpen]);

  const focusSaleField = useCallback(
    (field?: keyof SaleForm) => {
      window.setTimeout(() => {
        if (field) {
          formMethods.setFocus(field);
          return;
        }
        manualProductSearchRef.current?.focus();
      }, 0);
    },
    [formMethods],
  );

  const focusPagoVariosField = useCallback(
    (field: "forma" | "entidad" | "operacion" | "deposito" | "descripcion") => {
      window.setTimeout(() => {
        const target = document.querySelector<HTMLElement>(
          `[data-pago-varios-${field}]`,
        );
        target?.focus();
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement
        ) {
          target.select();
        }
      }, 0);
    },
    [],
  );

  const resetDraft = useCallback(() => {
    externalCaptureKeyRef.current = "";
    appliedCaptureKeyRef.current = "";
    capturedInvoiceApiClientRef.current = null;
    capturedInvoiceApiRucRef.current = "";
    setCapture(null);
    setPendingExternalCapture(null);
    setRows([]);
    setManualProductSearch("");
    setMonthlyPvs(0);
    setLastTicket(null);
    setViewSunatStatus(null);
    setFreeSaleReasonAsked(false);
    setManualSaleType("VENTA LIBRE");
    formMethods.reset(defaultForm);
  }, [formMethods]);

  const openNewRecord = useCallback(() => {
    resetDraft();
    setViewedOrderNoteId(null);
    navigate("/sales/html_capture/new", { replace: true });
  }, [navigate, resetDraft, setViewedOrderNoteId]);

  useEffect(() => {
    if (!isExistingRoute) {
      setLoadedRecordId(null);
      setViewedOrderNoteId(null);
      resetDraft();
      return;
    }

    let active = true;
    const loadRecord = async () => {
      setLoadedRecordId(null);
      try {
        const [notaResult, detailsResult] = await Promise.all([
          apiRequest<Record<string, unknown>, unknown, null>({
            url: buildApiUrl(`/Nota/${routeNoteId}`),
            method: "GET",
            fallback: null,
          }),
          apiRequest<unknown, unknown, null>({
            url: buildApiUrl(`/Nota/${routeNoteId}/detalles`),
            method: "GET",
            fallback: null,
          }),
        ]);
        const nota = asRecord(notaResult);
        if (!nota) throw new Error("Registro no encontrado.");

        const clientId = Number(nota.clienteId ?? nota.ClienteId ?? 0);
        const client = clientId ? await fetchClientById(clientId) : null;
        if (!active) return;

        const docu = safeTrim(nota.notaDocu ?? nota.NotaDocu).toUpperCase();
        const docTypeCode: SaleForm["docTypeCode"] = docu.includes("FACTURA")
          ? "01"
          : docu.includes("PROFORMA")
            ? "101"
            : "03";
        const condition = safeTrim(nota.notaCondicion ?? nota.NotaCondicion);
        const paymentMethod = safeTrim(
          nota.notaFormaPago ?? nota.NotaFormaPago,
        );
        const serie = safeTrim(nota.notaSerie ?? nota.NotaSerie);
        const numero = safeTrim(nota.notaNumero ?? nota.NotaNumero);
        const productById = new Map(
          useProductsStore
            .getState()
            .products.map((product) => [product.id, product]),
        );
        const rowsFromDatabase = asRecordList(detailsResult).map((detail) => {
          const productId = Number(
            detail?.idProducto ?? detail?.IdProducto ?? 0,
          );
          const price = Number(
            detail?.detallePrecio ?? detail?.DetallePrecio ?? 0,
          );
          const cost = Number(
            detail?.detalleCosto ?? detail?.DetalleCosto ?? 0,
          );
          const product = productById.get(productId) ?? {
            id: productId,
            codigo: `PRODUCTO-${productId}`,
            nombre: safeTrim(
              detail?.detalleDescripcion ?? detail?.DetalleDescripcion,
            ),
            unidadMedida:
              safeTrim(detail?.detalleUm ?? detail?.DetalleUm) || "UNIDAD",
            valorCritico: 0,
            preCosto: cost,
            preVenta: price,
            preVentaB: price,
            aplicaINV: "S" as const,
            cantidad: 0,
            usuario: "",
            estado: "ACTIVO" as const,
          };
          const quantity = Number(
            detail?.detalleCantidad ?? detail?.DetalleCantidad ?? 0,
          );
          return {
            product,
            code: product.codigo,
            description:
              safeTrim(
                detail?.detalleDescripcion ?? detail?.DetalleDescripcion,
              ) || product.nombre,
            quantity,
            price,
            cost,
            stock: Number(product.cantidad ?? 0),
            pv: Number(
              detail?.detallePV ?? detail?.DetallePV ?? product.pv ?? 0,
            ),
            sv: Number(
              detail?.detalleSV ?? detail?.DetalleSV ?? product.sv ?? 0,
            ),
            matched: true,
          } satisfies SaleRow;
        });

        const formFromDatabase: SaleForm = {
          ...defaultForm,
          concept:
            safeTrim(nota.notaConcepto ?? nota.NotaConcepto).toUpperCase() ===
            "SERVICIO"
              ? "SERVICIO"
              : "MERCADERIA",
          docTypeCode,
          correlativeDisplay: [serie, numero].filter(Boolean).join("-"),
          condition: ["ALCONTADO", "CREDITO", "PAGO/VARIOS"].includes(condition)
            ? (condition as SaleForm["condition"])
            : defaultForm.condition,
          delivery:
            safeTrim(nota.notaEntrega ?? nota.NotaEntrega).toUpperCase() ===
            "POR ENTREGAR"
              ? "POR ENTREGAR"
              : "INMEDIATA",
          emissionDate: safeTrim(nota.notaFecha ?? nota.NotaFecha).slice(0, 10),
          paymentMethod: PAYMENT_METHOD_OPTIONS.includes(
            paymentMethod as (typeof PAYMENT_METHOD_OPTIONS)[number],
          )
            ? (paymentMethod as SaleForm["paymentMethod"])
            : defaultForm.paymentMethod,
          bankEntity:
            safeTrim(nota.entidadBancaria ?? nota.EntidadBancaria) || "-",
          operationNumber: safeTrim(nota.nroOperacion ?? nota.NroOperacion),
          paymentDeposit: safeTrim(nota.deposito ?? nota.Deposito),
          paymentCash: safeTrim(nota.efectivo ?? nota.Efectivo),
          customerName:
            client?.nombreRazon || safeTrim(nota.miembro ?? nota.Miembro),
          customerEmail: client?.email || "",
          customerDoc: docTypeCode === "01" ? "" : client?.dni || "",
          customerRuc: docTypeCode === "01" ? client?.ruc || "" : "",
          address:
            client?.direccionFiscal ||
            client?.direccionDespacho ||
            safeTrim(nota.notaDireccion ?? nota.NotaDireccion),
          memberCode:
            client?.clienteCodigo ||
            safeTrim(nota.codigoCliente ?? nota.CodigoCliente),
          transactionNumber: safeTrim(
            nota.notaTransaccion ?? nota.NotaTransaccion,
          ),
        };

        appliedClientRef.current = client;
        formMethods.reset(formFromDatabase);
        setCapture(null);
        setRows(rowsFromDatabase);
        setMonthlyPvs(0);
        setManualSaleType(
          safeTrim(nota.conceptoOBS ?? nota.ConceptoOBS)
            .toUpperCase()
            .includes("POR PASAR")
            ? "POR PASAR AL OBS"
            : "VENTA LIBRE",
        );
        setCorrelative({
          serie,
          numero,
          nroComprobante: [serie, numero].filter(Boolean).join("-"),
        });
        setLastTicket({
          documentNumber: [serie, numero].filter(Boolean).join("-"),
          noteId: routeNoteId,
        });
        setLoadedRecordId(routeNoteId);
      } catch (error) {
        if (active) {
          setLoadedRecordId(routeNoteId);
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudo cargar el registro.",
          );
        }
      }
    };

    void loadRecord();
    return () => {
      active = false;
    };
  }, [
    fetchClientById,
    formMethods,
    isExistingRoute,
    resetDraft,
    routeNoteId,
    setViewedOrderNoteId,
  ]);

  useEffect(() => {
    if (!isExistingRoute) {
      setViewSunatStatus(null);
      return;
    }

    let active = true;
    Promise.all([
      apiRequest<Record<string, unknown>, unknown, null>({
        url: buildApiUrl(`/Nota/${routeNoteId}`),
        method: "GET",
        fallback: null,
      }),
      apiRequest<Record<string, unknown>, unknown, null>({
        url: buildApiUrl(`/Nota/${routeNoteId}/archivos-cpe`),
        method: "GET",
        fallback: null,
      }),
    ])
      .then(([nota, archivos]) => {
        if (!active || !nota) return;
        setViewSunatStatus({
          docuId:
            Number(
              archivos?.docuId ??
                archivos?.DocuId ??
                nota.docuId ??
                nota.DocuId,
            ) || 0,
          estadoSunat: safeTrim(nota.estadoSunat ?? nota.EstadoSunat),
          docuEstado: safeTrim(nota.docuEstado ?? nota.DocuEstado),
          notaDocu: safeTrim(nota.notaDocu ?? nota.NotaDocu),
          xmlUrl: safeTrim(archivos?.xmlUrl ?? archivos?.XmlUrl),
          cdrUrl: safeTrim(archivos?.cdrUrl ?? archivos?.CdrUrl),
        });
      })
      .catch(() => {
        if (active) setViewSunatStatus(null);
      });

    return () => {
      active = false;
    };
  }, [isExistingRoute, routeNoteId]);

  useEffect(() => {
    if (!products.length) void fetchProducts("");
  }, [fetchProducts, products.length]);

  useEffect(() => {
    if (isReadOnly) return;
    const doc = DOC_CONFIG[form.docTypeCode];
    let active = true;
    setCorrelative(null);

    const query = new URLSearchParams({
      companiaId: String(session.companyId),
      serie: doc.serie,
    });

    apiRequest<
      {
        ok?: boolean;
        nroComprobante?: string;
        numero?: string;
        serie?: string;
      },
      unknown,
      null
    >({
      url: buildApiUrl(`/Nota/correlativo?${query.toString()}`),
      method: "GET",
      fallback: null,
    })
      .then((response) => {
        if (!active || !response?.ok) return;
        const serie = safeTrim(response.serie) || doc.serie;
        const numero = safeTrim(response.numero) || "00000000";
        setCorrelative({
          serie,
          numero,
          nroComprobante:
            safeTrim(response.nroComprobante) || `${serie}-${numero}`,
        });
      })
      .catch(() => {
        if (active) setCorrelative(null);
      });

    return () => {
      active = false;
    };
  }, [form.docTypeCode, isReadOnly, session.companyId]);

  const fetchPagoVarios = useCallback(async () => {
    if (!session.userId) {
      setPagoVariosItems([]);
      setPagoVariosSelectedIds([]);
      return;
    }

    setIsPagoVariosLoading(true);
    try {
      const response = (await apiRequest<PagoVariosResponse>({
        url: buildApiUrl(
          `/Nota/pago-varios?${new URLSearchParams({
            usuarioId: String(session.userId),
            usuario: session.username,
          }).toString()}`,
        ),
        method: "GET",
        fallback: { ok: false, items: [] },
      })) as PagoVariosResponse;
      const items = Array.isArray(response?.items) ? response.items : [];
      setPagoVariosItems(items);
      setPagoVariosSelectedIds([]);
    } catch (error) {
      console.error("No se pudo cargar pago varios", error);
      toast.error("No se pudo cargar Pago Varios.");
    } finally {
      setIsPagoVariosLoading(false);
    }
  }, [session.userId, session.username]);

  const openPagoVariosModal = useCallback(() => {
    setPagoVariosModalOpen(true);
    void fetchPagoVarios();
  }, [fetchPagoVarios]);

  useEffect(() => {
    void fetchPagoVarios();
    window.addEventListener("sgo:pago-varios-updated", fetchPagoVarios);
    return () =>
      window.removeEventListener("sgo:pago-varios-updated", fetchPagoVarios);
  }, [fetchPagoVarios]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("pagoVarios") !== "1") return;
    openPagoVariosModal();
    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate, openPagoVariosModal]);

  const selectedPagoVariosItems = useMemo(
    () =>
      pagoVariosItems.filter((item) =>
        pagoVariosSelectedIds.includes(item.notaId),
      ),
    [pagoVariosItems, pagoVariosSelectedIds],
  );
  const pagoVariosTotal = useMemo(
    () => selectedPagoVariosItems.reduce((sum, item) => sum + item.monto, 0),
    [selectedPagoVariosItems],
  );
  const pagoVariosConceptos = useMemo(
    () =>
      Array.from(
        new Set(
          selectedPagoVariosItems.map((item) => safeTrim(item.conceptoOBS)),
        ),
      ).filter(Boolean),
    [selectedPagoVariosItems],
  );
  const isPagoVariosMixed =
    pagoVariosFormaPago.includes("/") &&
    pagoVariosFormaPago.includes("EFECTIVO");
  const pagoVariosRequiereOperacion = ![
    "(SELECCIONE)",
    "EFECTIVO",
    "-",
  ].includes(pagoVariosFormaPago);
  const pagoVariosEntidadEditable = pagoVariosRequiereOperacion;
  const pagoVariosDepositoIngresado = Math.max(
    0,
    Number(pagoVariosDeposito || 0),
  );
  const pagoVariosDepositoFinal = isPagoVariosMixed
    ? Math.min(pagoVariosDepositoIngresado, pagoVariosTotal)
    : ["(SELECCIONE)", "EFECTIVO"].includes(pagoVariosFormaPago)
      ? 0
      : pagoVariosTotal;
  const pagoVariosEfectivoFinal = isPagoVariosMixed
    ? Math.max(pagoVariosTotal - pagoVariosDepositoFinal, 0)
    : pagoVariosFormaPago === "EFECTIVO"
      ? pagoVariosTotal
      : 0;
  const pagoVariosEntidadFinal = pagoVariosEntidadEditable
    ? pagoVariosEntidad || "(SELECCIONE)"
    : "-";

  useEffect(() => {
    if (!pagoVariosEntidadEditable) {
      setPagoVariosEntidad("-");
      setPagoVariosOperacion("");
      setPagoVariosDeposito("");
      return;
    }
    if (pagoVariosEntidad === "-" || !pagoVariosEntidad) {
      setPagoVariosEntidad("(SELECCIONE)");
    }
    if (!isPagoVariosMixed) setPagoVariosDeposito("");
    if (!pagoVariosRequiereOperacion) setPagoVariosOperacion("");
  }, [
    isPagoVariosMixed,
    pagoVariosEntidad,
    pagoVariosEntidadEditable,
    pagoVariosFormaPago,
    pagoVariosRequiereOperacion,
  ]);

  useEffect(() => {
    if (focusedPagoVariosPaymentMethodRef.current === pagoVariosFormaPago) {
      return;
    }
    focusedPagoVariosPaymentMethodRef.current = pagoVariosFormaPago;
    if (isPagoVariosMixed) {
      focusPagoVariosField("deposito");
      return;
    }
    if (pagoVariosFormaPago === "EFECTIVO") {
      focusPagoVariosField("descripcion");
      return;
    }
    if (pagoVariosEntidadEditable) {
      focusPagoVariosField("entidad");
    }
  }, [
    focusPagoVariosField,
    isPagoVariosMixed,
    pagoVariosEntidadEditable,
    pagoVariosFormaPago,
  ]);

  const registerPagoVarios = async () => {
    if (!selectedPagoVariosItems.length) {
      toast.error("Seleccione documentos para pagar.");
      return;
    }
    if (pagoVariosConceptos.length !== 1) {
      toast.error("Seleccione documentos con el mismo concepto OBS.");
      return;
    }
    const descripcionPagoVarios = safeTrim(
      pagoVariosDescripcionRef.current?.value ?? pagoVariosDescripcion,
    );
    if (!descripcionPagoVarios) {
      focusPagoVariosField("descripcion");
      toast.error("Ingrese descripcion.");
      return;
    }
    if (pagoVariosFormaPago === "(SELECCIONE)") {
      focusPagoVariosField("forma");
      toast.error("Seleccione forma de pago.");
      return;
    }
    if (
      pagoVariosEntidadEditable &&
      ["(SELECCIONE)", "-"].includes(pagoVariosEntidadFinal)
    ) {
      focusPagoVariosField("entidad");
      toast.error("Seleccione entidad bancaria.");
      return;
    }
    if (pagoVariosRequiereOperacion && !safeTrim(pagoVariosOperacion)) {
      focusPagoVariosField("operacion");
      toast.error("Ingrese numero de operacion.");
      return;
    }
    if (isPagoVariosMixed && pagoVariosDepositoIngresado <= 0) {
      focusPagoVariosField("deposito");
      toast.error("Ingrese el monto por banco.");
      return;
    }
    if (isPagoVariosMixed && pagoVariosDepositoIngresado >= pagoVariosTotal) {
      focusPagoVariosField("deposito");
      toast.error("Efectivo y deposito deben ser mayores a 0.");
      return;
    }
    if (
      Math.round((pagoVariosEfectivoFinal + pagoVariosDepositoFinal) * 100) !==
      Math.round(pagoVariosTotal * 100)
    ) {
      focusPagoVariosField("deposito");
      toast.error("Efectivo + deposito debe cuadrar con el total.");
      return;
    }

    setIsPagoVariosSaving(true);
    try {
      const response = (await apiRequest<PagoVariosResponse>({
        url: buildApiUrl("/Nota/pago-varios"),
        method: "POST",
        data: {
          usuarioId: session.userId,
          usuario: session.username,
          formaPago: pagoVariosFormaPago,
          entidad: pagoVariosEntidadFinal,
          efectivo: pagoVariosEfectivoFinal,
          deposito: pagoVariosDepositoFinal,
          nroOperacion: pagoVariosOperacion,
          descripcion: descripcionPagoVarios,
          conceptoOBS: pagoVariosConceptos[0],
          detalles: selectedPagoVariosItems.map((item) => ({
            docuId: item.docuId,
            notaId: item.notaId,
            monto: item.monto,
            conceptoOBS: item.conceptoOBS,
          })),
        },
        fallback: { ok: false, mensaje: "No se pudo registrar Pago Varios." },
      })) as PagoVariosResponse;

      const errorData = asRecord(asRecord(response)?.response)?.data;
      const errorRecord = asRecord(errorData);
      if (!response?.ok) {
        toast.error(
          safeTrim(response?.mensaje) ||
            safeTrim(errorRecord?.mensaje) ||
            "No se pudo registrar Pago Varios.",
        );
        return;
      }

      toast.success("Pago Varios registrado.");
      setPagoVariosModalOpen(false);
      setPagoVariosOperacion("");
      setPagoVariosDeposito("");
      setPagoVariosDescripcion("");
      window.dispatchEvent(new Event("sgo:pago-varios-updated"));
      void fetchPagoVarios();
    } finally {
      setIsPagoVariosSaving(false);
    }
  };

  useEffect(() => {
    if (!clients.length) {
      void fetchClients("");
    }
  }, [clients.length, fetchClients]);

  const productByCode = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((product) => {
      const key = normalizeCode(product.codigo);
      if (key && !map.has(key)) map.set(key, product);
    });
    return map;
  }, [products]);
  const filteredManualProducts = useMemo(() => {
    const query = normalizeLabelText(manualProductSearch);
    const compactQuery = compactSearchText(manualProductSearch);
    return products
      .filter((product) => product.estado !== "INACTIVO")
      .filter((product) => {
        if (!query) return true;
        const searchable = `${product.codigo ?? ""} ${product.nombre ?? ""}`;
        return (
          normalizeLabelText(searchable).includes(query) ||
          compactSearchText(searchable).includes(compactQuery)
        );
      })
      .slice(0, 20);
  }, [manualProductSearch, products]);

  useEffect(() => {
    setManualProductIndex(0);
  }, [manualProductSearch]);

  const clientOptions = useMemo(
    () =>
      clients.map((client) => ({
        client,
        label: safeTrim(client.nombreRazon),
        doc: safeTrim(client.ruc || client.dni),
        code: getClientCode(client),
      })),
    [clients],
  );
  const formMatchesClient = useCallback(
    (client: Client | null) => {
      if (!client) return false;
      const code = safeTrim(form.memberCode);
      const name = safeTrim(form.customerName);
      const dni = normalizeDocumentText(form.customerDoc);
      const ruc = normalizeDocumentText(form.customerRuc);
      return Boolean(
        (code && getClientCode(client) === code) ||
        (dni && normalizeDocumentText(client.dni) === dni) ||
        (ruc && normalizeDocumentText(client.ruc) === ruc) ||
        (name &&
          name.toUpperCase() !== "VARIOS" &&
          normalizeLabelText(client.nombreRazon) === normalizeLabelText(name)),
      );
    },
    [form.customerDoc, form.customerName, form.customerRuc, form.memberCode],
  );
  const selectedClient = useMemo(
    () =>
      clientOptions.find(
        (opt) =>
          opt.label === safeTrim(form.customerName) ||
          (safeTrim(form.memberCode) &&
            opt.code === safeTrim(form.memberCode)) ||
          (safeTrim(form.customerDoc) &&
            opt.client.dni === safeTrim(form.customerDoc)) ||
          (safeTrim(form.customerRuc) &&
            opt.client.ruc === safeTrim(form.customerRuc)),
      )?.client ??
      (formMatchesClient(appliedClientRef.current)
        ? appliedClientRef.current
        : null),
    [
      clientOptions,
      form.customerDoc,
      form.customerName,
      form.customerRuc,
      form.memberCode,
      formMatchesClient,
    ],
  );
  const canEditCapturedClient =
    isCapturedSale &&
    !isReadOnly &&
    !selectedClient &&
    Boolean(
      safeTrim(form.customerName) ||
      safeTrim(form.memberCode) ||
      safeTrim(form.customerRuc) ||
      safeTrim(form.customerDoc),
    );
  const findClientFromForm = useCallback(
    (source: Client[] = useClientsStore.getState().clients) => {
      const code = safeTrim(form.memberCode);
      const name = safeTrim(form.customerName);
      const dni = normalizeDocumentText(form.customerDoc);
      const ruc = normalizeDocumentText(form.customerRuc);

      return (
        source.find((client) => {
          const clientName = safeTrim(client.nombreRazon);
          return (
            (code && getClientCode(client) === code) ||
            (ruc && normalizeDocumentText(client.ruc) === ruc) ||
            (dni && normalizeDocumentText(client.dni) === dni) ||
            (name &&
              name.toUpperCase() !== "VARIOS" &&
              normalizeLabelText(clientName) === normalizeLabelText(name))
          );
        }) ?? null
      );
    },
    [form.customerDoc, form.customerName, form.customerRuc, form.memberCode],
  );

  useEffect(() => {
    const clientId = Number(selectedClient?.id ?? 0);
    if (!clientId) {
      setMonthlyPvs(0);
      return;
    }

    let active = true;
    fetchClientMonthlyPvs(clientId)
      .then((total) => {
        if (active) setMonthlyPvs(total);
      })
      .catch(() => {
        if (active) setMonthlyPvs(0);
      });
    return () => {
      active = false;
    };
  }, [fetchClientMonthlyPvs, selectedClient?.id]);

  const applyClient = useCallback(
    (
      client: Client | null,
      options?: { preserveDocType?: boolean; documentType?: "01" | "03" },
    ) => {
      appliedClientRef.current = client;
      if (!client) return;
      formMethods.setValue("customerName", client.nombreRazon ?? "", {
        shouldDirty: true,
      });
      formMethods.setValue("customerEmail", client.email ?? "", {
        shouldDirty: true,
      });
      formMethods.setValue("memberCode", getClientCode(client), {
        shouldDirty: true,
      });
      formMethods.setValue(
        "address",
        client.direccionFiscal || client.direccionDespacho || "",
        { shouldDirty: true },
      );

      const targetDocType =
        options?.documentType ??
        (options?.preserveDocType
          ? formMethods.getValues("docTypeCode")
          : client.ruc
            ? "01"
            : form.docTypeCode);

      if (!options?.preserveDocType) {
        formMethods.setValue("docTypeCode", targetDocType, {
          shouldDirty: true,
        });
      }

      formMethods.setValue("customerRuc", client.ruc || "", {
        shouldDirty: true,
      });
      formMethods.setValue("customerDoc", client.dni || "", {
        shouldDirty: true,
      });
    },
    [form.docTypeCode, formMethods],
  );

  const handleSelectClientFromDialog = useCallback(
    (client: Client) => {
      applyClient(client);
      closeDialog();
    },
    [applyClient, closeDialog],
  );

  const handleCreateClientFromDialog = useCallback(
    async (data: Omit<Client, "id">) => {
      const payload: Omit<Client, "id"> = {
        clienteCodigo: safeTrim(data.clienteCodigo),
        nombreRazon: safeTrim(data.nombreRazon).toUpperCase(),
        ruc: safeTrim(data.ruc),
        dni: safeTrim(data.dni),
        direccionFiscal: safeTrim(data.direccionFiscal) || "-",
        direccionDespacho: safeTrim(data.direccionDespacho),
        telefonoMovil: safeTrim(data.telefonoMovil),
        email: safeTrim(data.email),
        registradoPor: safeTrim(data.registradoPor) || session.username,
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

      if (result.client) applyClient(result.client);
      setMonthlyPvs(0);
      toast.success("Cliente creado correctamente.");
      closeDialog();
      return true;
    },
    [addClient, applyClient, closeDialog, session.username],
  );

  const handleUpdateClientFromDialog = useCallback(
    async (client: Client, data: Omit<Client, "id">) => {
      const payload: Omit<Client, "id"> = {
        clienteCodigo: safeTrim(data.clienteCodigo),
        nombreRazon: safeTrim(data.nombreRazon).toUpperCase(),
        ruc: safeTrim(data.ruc),
        dni: safeTrim(data.dni),
        direccionFiscal: safeTrim(data.direccionFiscal) || "-",
        direccionDespacho: safeTrim(data.direccionDespacho),
        telefonoMovil: safeTrim(data.telefonoMovil),
        email: safeTrim(data.email),
        registradoPor: safeTrim(data.registradoPor) || session.username,
        estado: safeTrim(data.estado) || "ACTIVO",
        fecha: data.fecha ?? null,
      };

      if (!payload.nombreRazon) {
        toast.error("El nombre o razon social es obligatorio.");
        return false;
      }

      const result = await updateClient(client.id, { ...client, ...payload });
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo actualizar el cliente.");
        return false;
      }

      const updated = result.client ?? ({ ...client, ...payload } as Client);
      applyClient(updated);
      toast.success("Cliente actualizado correctamente.");
      closeDialog();
      return true;
    },
    [applyClient, closeDialog, session.username, updateClient],
  );

  const handleDeleteClientFromDialog = useCallback(
    async (client: Client) => {
      if (!client.id) {
        toast.error("No se encontró el cliente para eliminar.");
        return false;
      }

      const deleted = await deleteClient(client.id);
      if (!deleted) {
        toast.error("No se puede eliminar.");
        return false;
      }

      if (Number(selectedClient?.id) === Number(client.id)) {
        formMethods.setValue("customerName", "", { shouldDirty: true });
        formMethods.setValue("customerEmail", "", { shouldDirty: true });
        formMethods.setValue("customerDoc", "", { shouldDirty: true });
        formMethods.setValue("customerRuc", "", { shouldDirty: true });
        formMethods.setValue("memberCode", "", { shouldDirty: true });
        formMethods.setValue("address", "", { shouldDirty: true });
        setMonthlyPvs(0);
      }

      toast.success("Cliente eliminado correctamente.");
      return true;
    },
    [deleteClient, formMethods, selectedClient?.id],
  );

  const handleAddManualProduct = async (selectedProduct?: Product) => {
    if (isReadOnly) {
      toast.error("Este registro solo se puede visualizar.");
      return;
    }
    if (isCapturedSale) {
      toast.error("Los productos capturados no se pueden editar.");
      return;
    }
    const query = safeTrim(manualProductSearch);
    if (!query && !selectedProduct) {
      toast.error("Seleccione un producto.");
      return;
    }

    let source = products;
    if (!source.length && !selectedProduct) {
      await fetchProducts("");
      source = useProductsStore.getState().products;
    }

    const queryCode = normalizeCode(query.split(" - ")[0]);
    const queryText = normalizeLabelText(query);
    const compactQuery = compactSearchText(query);
    const product =
      selectedProduct ??
      productByCode.get(queryCode) ??
      source.find((item) => {
        const code = normalizeCode(item.codigo);
        const searchable = `${item.codigo ?? ""} ${item.nombre ?? ""}`;
        return (
          code === normalizeCode(query) ||
          code.includes(queryCode) ||
          normalizeLabelText(searchable).includes(queryText) ||
          compactSearchText(searchable).includes(compactQuery)
        );
      }) ??
      null;

    if (!product) {
      toast.error("Producto no encontrado.");
      return;
    }

    const shouldAskFreeSaleReason = !freeSaleReasonAsked && rows.length === 0;
    setRows((current) => {
      const existing = current.findIndex((row) => row.code === product.codigo);
      if (existing < 0) return [...current, productToRow(product, 1)];
      return current.map((row, index) =>
        index === existing
          ? { ...row, quantity: safeRowNumber(row.quantity) + 1 }
          : row,
      );
    });
    setManualProductSearch("");
    setManualProductSearchFocused(false);
    setLastTicket(null);
    if (shouldAskFreeSaleReason) {
      setFreeSaleReasonAsked(true);
      openDialog({
        title: "",
        content: (
          <div className="space-y-4 py-1">
            <p className="text-center text-xl font-black uppercase text-orange-500">
              PORQUE NO CAPTURAS DEL OBS?
            </p>
            <div className="space-y-3 text-sm font-semibold text-slate-700">
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="free-sale-reason"
                  defaultChecked={manualSaleType === "POR PASAR AL OBS"}
                  onChange={() => setManualSaleType("POR PASAR AL OBS")}
                />
                POR PASAR AL OBS
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  name="free-sale-reason"
                  defaultChecked={manualSaleType === "VENTA LIBRE"}
                  onChange={() => setManualSaleType("VENTA LIBRE")}
                />
                VENTA LIBRE (SIN CODIGO)
              </label>
            </div>
          </div>
        ),
        confirmText: "Aceptar",
        cancelText: "Ignorar",
        onConfirm: () => true,
        maxWidth: "xs",
      });
    }
  };

  const handleManualProductKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setManualProductSearchFocused(true);
      setManualProductIndex((index) =>
        Math.min(index + 1, Math.max(filteredManualProducts.length - 1, 0)),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setManualProductIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "ArrowLeft") {
      focusPreviousInput(event.currentTarget);
      return;
    }

    if (event.key === "ArrowRight") {
      focusNextInput(event.currentTarget);
      return;
    }

    if (event.key !== "Enter") return;
    event.preventDefault();
    const product = filteredManualProducts[manualProductIndex];
    void handleAddManualProduct(product);
  };

  const handleNumberInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      focusPreviousInput(event.currentTarget);
      return;
    }

    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowRight" ||
      event.key === "Enter"
    ) {
      event.preventDefault();
      focusNextInput(event.currentTarget);
    }
  };

  const handleRemoveRow = (code: string) => {
    if (isReadOnly || isCapturedSale) return;
    setRows((current) => current.filter((row) => row.code !== code));
    setLastTicket(null);
  };

  const handleRowQuantityChange = (code: string, value: string) => {
    const quantity =
      value === "" ? Number.NaN : Math.max(0, Number(value) || 0);
    setRows((current) =>
      current.map((row) => (row.code === code ? { ...row, quantity } : row)),
    );
    setLastTicket(null);
  };

  const handleRowPriceChange = (code: string, value: string) => {
    const price = value === "" ? Number.NaN : Math.max(0, Number(value) || 0);
    setRows((current) =>
      current.map((row) => (row.code === code ? { ...row, price } : row)),
    );
    setLastTicket(null);
  };

  const handleRowPriceBlur = (code: string) => {
    const row = rows.find((item) => item.code === code);
    if (!row || !Number.isFinite(row.price)) return;
    const minimum = minAllowedPrice(row);
    if (minimum <= 0 || row.price >= minimum) return;

    toast.error(`El precio no debe ser menor a: S/ ${money(minimum)}`);
    focusPriceInput(code);
    setRows((current) =>
      current.map((item) =>
        item.code === code ? { ...item, price: minimum } : item,
      ),
    );
    setLastTicket(null);
  };

  const handleOpenCreateClientModal = useCallback(() => {
    if (isReadOnly) {
      toast.error("Este registro solo se puede visualizar.");
      return;
    }
    openDialog({
      title: "",
      maxWidth: "lg",
      fullWidth: true,
      cancelText: "Cerrar",
      hideCancelButton: true,
      content: (
        <CustomerDialogContent
          onSelectClient={handleSelectClientFromDialog}
          onCreateClient={handleCreateClientFromDialog}
          onUpdateClient={handleUpdateClientFromDialog}
          onDeleteClient={handleDeleteClientFromDialog}
        />
      ),
    });
  }, [
    handleCreateClientFromDialog,
    handleDeleteClientFromDialog,
    handleSelectClientFromDialog,
    handleUpdateClientFromDialog,
    isReadOnly,
    openDialog,
  ]);

  const createClientFromCapturedForm = useCallback(async () => {
    const customerDoc = normalizeDocumentText(form.customerDoc);
    const customerRuc = normalizeDocumentText(form.customerRuc);
    const lookupType = form.docTypeCode === "01" ? "ruc" : "dni";
    const lookupNumber = lookupType === "ruc" ? customerRuc : customerDoc;
    const lookup =
      (lookupType === "ruc" && lookupNumber.length === 11) ||
      (lookupType === "dni" && lookupNumber.length === 8)
        ? await consultarDocumentoCliente(lookupType, lookupNumber)
        : null;

    if (form.docTypeCode === "01" && customerRuc.length !== 11) {
      focusSaleField("customerRuc");
      toast.error("Factura requiere RUC de 11 digitos.");
      return null;
    }
    if (form.docTypeCode === "01" && !isValidPeruRuc(customerRuc)) {
      focusSaleField("customerRuc");
      toast.error("Factura requiere un RUC valido.");
      return null;
    }
    if (
      form.docTypeCode !== "01" &&
      customerDoc &&
      (customerDoc.length < 5 || customerDoc.length > 15)
    ) {
      focusSaleField("customerDoc");
      toast.error("El numero de documento del cliente no es valido.");
      return null;
    }

    const lookupClient = lookup?.ok ? lookup.client : null;
    if (
      form.docTypeCode === "01" &&
      (!lookup || !lookup.ok || !lookupClient?.nombreRazon)
    ) {
      formMethods.setValue("customerName", "", { shouldDirty: true });
      formMethods.setValue("customerRuc", "", { shouldDirty: true });
      formMethods.setValue("customerDoc", "", { shouldDirty: true });
      formMethods.setValue("address", "", { shouldDirty: true });
      formMethods.setValue("customerEmail", "", { shouldDirty: true });
      formMethods.setValue("memberCode", "", { shouldDirty: true });
      appliedClientRef.current = null;
      focusSaleField("customerRuc");
      toast.error(
        "El RUC del cliente no es valido o esta inactivo, por favor verificar.",
      );
      return null;
    }

    if (lookupClient?.nombreRazon) {
      formMethods.setValue("customerName", lookupClient.nombreRazon, {
        shouldDirty: true,
      });
    }
    if (lookupClient?.direccionFiscal) {
      formMethods.setValue("address", lookupClient.direccionFiscal, {
        shouldDirty: true,
      });
    }

    const result = await addClient({
      clienteCodigo: safeTrim(form.memberCode),
      nombreRazon:
        safeTrim(lookupClient?.nombreRazon) ||
        safeTrim(form.customerName) ||
        "VARIOS",
      ruc:
        safeTrim(lookupClient?.ruc) ||
        customerRuc ||
        (customerDoc.length === 11 ? customerDoc : ""),
      dni:
        safeTrim(lookupClient?.dni) ||
        customerDoc ||
        (customerRuc && customerRuc.length !== 11 ? customerRuc : ""),
      direccionFiscal:
        safeTrim(lookupClient?.direccionFiscal) ||
        safeTrim(form.address) ||
        "-",
      direccionDespacho:
        safeTrim(lookupClient?.direccionDespacho) || safeTrim(form.address),
      telefonoMovil: "",
      email: safeTrim(form.customerEmail),
      registradoPor: session.username,
      estado: "ACTIVO",
      fecha: null,
      documentoPredeterminado: DOC_CONFIG[form.docTypeCode].docu,
    });

    if (!result.ok) {
      toast.error(result.error ?? "No se pudo crear el cliente.");
      return null;
    }

    const created =
      result.client ??
      (safeTrim(form.memberCode)
        ? await fetchClientByCodigo(safeTrim(form.memberCode))
        : null);

    if (created) {
      applyClient(created);
    }

    return created;
  }, [
    addClient,
    applyClient,
    fetchClientByCodigo,
    form.address,
    form.customerDoc,
    form.customerEmail,
    form.customerName,
    form.customerRuc,
    form.docTypeCode,
    form.memberCode,
    formMethods,
    focusSaleField,
    session.username,
  ]);

  const handleCreateAndEditCapturedClient = useCallback(async () => {
    const client = await createClientFromCapturedForm();
    if (!client) return;

    openDialog({
      title: "",
      maxWidth: "lg",
      fullWidth: true,
      cancelText: "Cerrar",
      hideCancelButton: true,
      content: (
        <CustomerDialogContent
          initialEditingClient={client}
          onSelectClient={handleSelectClientFromDialog}
          onCreateClient={handleCreateClientFromDialog}
          onUpdateClient={handleUpdateClientFromDialog}
          onDeleteClient={handleDeleteClientFromDialog}
        />
      ),
    });
  }, [
    createClientFromCapturedForm,
    handleCreateClientFromDialog,
    handleDeleteClientFromDialog,
    handleSelectClientFromDialog,
    handleUpdateClientFromDialog,
    openDialog,
  ]);

  useEffect(() => {
    const code = safeTrim(form.memberCode);
    if (!code || selectedClient || appliedClientRef.current) return;
    const match =
      clientOptions.find((opt) => opt.code === code)?.client ?? null;
    if (match) applyClient(match, { preserveDocType: true });
  }, [applyClient, clientOptions, form.memberCode, selectedClient]);

  const buildRows = useCallback(
    (data: CaptureData) =>
      data.lines.map((line): SaleRow => {
        const found = productByCode.get(line.code);
        const product: Product = found ?? {
          id: -1,
          codigo: line.code,
          nombre: line.code,
          unidadMedida: "UNIDAD",
          valorCritico: 0,
          preCosto: 0,
          preVenta: 0,
          preVentaB: 0,
          aplicaINV: "S",
          cantidad: 0,
          pv: 0,
          sv: 0,
          usuario: "",
          estado: "ACTIVO",
        };

        return productToRow(product, line.quantity, Boolean(found));
      }),
    [productByCode],
  );

  const applyCaptureData = useCallback(
    async (data: CaptureData) => {
      if (isReadOnly) {
        return;
      }
      const captureKey = JSON.stringify(data);
      if (appliedCaptureKeyRef.current === captureKey) return;
      appliedCaptureKeyRef.current = captureKey;
      setIsApplyingCapture(true);
      try {
        formMethods.setValue("transactionNumber", data.transactionNumber, {
          shouldDirty: true,
        });

        const docMatches =
          data.ruc
            .replace(/FACTURA|BOLETA|RUC|DNI|DOCUMENTO|:/gi, " ")
            .match(/\d{8,11}/g) ?? [];
        const docValue = docMatches.at(-1) ?? "";
        const nextRows = buildRows(data);
        setCapture(data);
        setRows(nextRows);
        appliedClientRef.current = null;
        capturedInvoiceApiClientRef.current = null;
        capturedInvoiceApiRucRef.current = "";
        const docTypeText = data.ruc.toUpperCase();
        const nextDocTypeCode = docTypeText.includes("FACTURA")
          ? "01"
          : docTypeText.includes("BOLETA")
            ? "03"
            : docValue.length === 11
              ? "01"
              : "03";
        const customerDocValue = docValue;
        const localClient =
          clientOptions.find(
            (opt) =>
              isActiveClient(opt.client) &&
              ((opt.code && opt.code === safeTrim(data.memberCode)) ||
                (nextDocTypeCode === "01" &&
                  customerDocValue &&
                  normalizeDocumentText(opt.client.ruc) === customerDocValue) ||
                (nextDocTypeCode !== "01" &&
                  customerDocValue &&
                  normalizeDocumentText(opt.client.dni) === customerDocValue)),
          )?.client ?? null;
        const memberCode = safeTrim(data.memberCode);
        const rawCodeClient =
          !localClient && memberCode
            ? await fetchClientByCodigo(memberCode).catch(() => null)
            : null;
        const codeClient = isActiveClient(rawCodeClient) ? rawCodeClient : null;
        const searchedClients =
          !localClient &&
          !codeClient &&
          nextDocTypeCode === "01" &&
          customerDocValue
            ? await searchClients(customerDocValue).catch(() => [])
            : [];
        const searchedClient =
          searchedClients.find(
            (client) =>
              isActiveClient(client) &&
              (normalizeDocumentText(client.ruc) === customerDocValue ||
                (memberCode && getClientCode(client) === memberCode)),
          ) ?? null;
        const matchedClient = localClient ?? codeClient ?? searchedClient;
        if (nextDocTypeCode === "01" && matchedClient && !localClient) {
          capturedInvoiceApiClientRef.current = matchedClient;
          capturedInvoiceApiRucRef.current = customerDocValue;
        }
        formMethods.setValue("docTypeCode", nextDocTypeCode, {
          shouldDirty: true,
        });
        formMethods.setValue(
          "customerRuc",
          nextDocTypeCode === "01" ? customerDocValue : "",
          { shouldDirty: true },
        );
        formMethods.setValue(
          "customerDoc",
          nextDocTypeCode !== "01" ? customerDocValue : "",
          { shouldDirty: true },
        );
        if (matchedClient) {
          applyClient(matchedClient, { preserveDocType: true });
          formMethods.setValue("docTypeCode", nextDocTypeCode, {
            shouldDirty: true,
          });
          if (nextDocTypeCode === "01") {
            formMethods.setValue(
              "customerRuc",
              customerDocValue || matchedClient.ruc || "",
              { shouldDirty: true },
            );
            formMethods.setValue("customerDoc", "", { shouldDirty: true });
          } else {
            formMethods.setValue("customerRuc", "", { shouldDirty: true });
            formMethods.setValue(
              "customerDoc",
              customerDocValue ||
                (normalizeDocumentText(matchedClient.dni) === memberCode
                  ? ""
                  : matchedClient.dni) ||
                "",
              { shouldDirty: true },
            );
          }
          if (data.customerEmail) {
            formMethods.setValue("customerEmail", data.customerEmail, {
              shouldDirty: true,
            });
          }
        } else {
          if (nextDocTypeCode === "01") {
            const lookup =
              customerDocValue.length === 11
                ? await consultarDocumentoCliente("ruc", customerDocValue)
                : null;
            const lookupClient = lookup?.ok ? lookup.client : null;
            if (!lookupClient) {
              formMethods.setValue("customerName", "", { shouldDirty: true });
              formMethods.setValue("customerDoc", "", { shouldDirty: true });
              formMethods.setValue("address", "", { shouldDirty: true });
              formMethods.setValue("customerEmail", "", { shouldDirty: true });
              appliedClientRef.current = null;
              capturedInvoiceApiClientRef.current = null;
              capturedInvoiceApiRucRef.current = "";
              focusSaleField("customerRuc");
              toast.error(
                (lookup && !lookup.ok ? lookup.message : "") ||
                  "El RUC del cliente no es valido o esta inactivo, por favor verificar.",
              );
              return;
            }
            formMethods.setValue("customerName", lookupClient.nombreRazon, {
              shouldDirty: true,
            });
            formMethods.setValue("customerRuc", lookupClient.ruc, {
              shouldDirty: true,
            });
            formMethods.setValue("customerDoc", "", { shouldDirty: true });
            formMethods.setValue("address", lookupClient.direccionFiscal, {
              shouldDirty: true,
            });
            formMethods.setValue("customerEmail", data.customerEmail, {
              shouldDirty: true,
            });
            appliedClientRef.current = null;
            capturedInvoiceApiClientRef.current = null;
            capturedInvoiceApiRucRef.current = "";
          } else {
            const lookup =
              customerDocValue.length === 8
                ? await consultarDocumentoCliente("dni", customerDocValue)
                : null;
            const lookupClient = lookup?.ok ? lookup.client : null;
            formMethods.setValue(
              "customerName",
              lookupClient?.nombreRazon || data.customerName,
              { shouldDirty: true },
            );
            if (lookupClient?.direccionFiscal) {
              formMethods.setValue("address", lookupClient.direccionFiscal, {
                shouldDirty: true,
              });
            } else {
              formMethods.setValue("address", "", { shouldDirty: true });
            }
            formMethods.setValue("customerEmail", data.customerEmail, {
              shouldDirty: true,
            });
          }
        }
        formMethods.setValue("memberCode", data.memberCode, {
          shouldDirty: true,
        });
        if (nextDocTypeCode !== "01") {
          formMethods.setValue("customerRuc", "", { shouldDirty: true });
        } else {
          formMethods.setValue("customerDoc", "", { shouldDirty: true });
        }

        setLastTicket(null);
      } finally {
        setIsApplyingCapture(false);
      }
    },
    [
      applyClient,
      buildRows,
      clientOptions,
      fetchClientByCodigo,
      formMethods,
      isReadOnly,
      searchClients,
    ],
  );

  const totals = useMemo(() => {
    const subtotal = rows.reduce(
      (sum, row) =>
        sum + safeRowNumber(row.quantity) * safeRowNumber(row.price),
      0,
    );
    const discount = Math.min(capture?.discount ?? 0, subtotal);
    const total = subtotal - discount;
    return {
      subtotal,
      discount,
      base: total / 1.18,
      igv: total - total / 1.18,
      total,
      pv: rows.reduce(
        (sum, row) => sum + row.pv * safeRowNumber(row.quantity),
        0,
      ),
      sv: rows.reduce(
        (sum, row) => sum + row.sv * safeRowNumber(row.quantity),
        0,
      ),
    };
  }, [capture?.discount, rows]);

  const cartItems = useMemo<PosCartItem[]>(
    () =>
      rows.map((row) => ({
        productId: row.product.id,
        codigo: row.code,
        nombre: row.description,
        unidadMedida: row.product.unidadMedida || "UNIDAD",
        precio: safeRowNumber(row.price),
        precioMinimo: safeRowNumber(row.price),
        cantidad: safeRowNumber(row.quantity),
        valorUM: 1,
        pv: row.pv,
        sv: row.sv,
        stock: row.stock,
      })),
    [rows],
  );

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (isReadOnly) {
      toast.error("Este registro solo se puede visualizar.");
      return;
    }
    if (!files.length) return;

    const firstHtml = await files[0].text();
    let data = parseCapture(firstHtml);
    if (!data.lines.length && files.length > 1) {
      const target = frameFileName(firstHtml).toLowerCase();
      const candidates = target
        ? [
            ...files.filter((file) => file.name.toLowerCase() === target),
            ...files.filter((file) => file.name.toLowerCase() !== target),
          ]
        : files.slice(1);
      for (const file of candidates) {
        data = parseCapture(await file.text());
        if (data.lines.length) break;
      }
    }

    if (!data.lines.length) {
      const target = frameFileName(firstHtml);
      toast.error(
        target
          ? `Selecciona tambien ${target}.`
          : "No se encontraron productos en el HTML.",
      );
      return;
    }

    void applyCaptureData(data);
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const message = event.data as
        | { type?: string; payload?: CaptureData }
        | undefined;
      if (message?.type !== "SGO_DXN_CAPTURE") return;
      if (!message.payload?.lines?.length) return;
      const key = JSON.stringify(message.payload);
      if (externalCaptureKeyRef.current === key) return;
      externalCaptureKeyRef.current = key;
      setPendingExternalCapture(message.payload);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    let attempts = 0;
    const askForCapture = () => {
      attempts += 1;
      window.postMessage(
        { type: "SGO_DXN_CAPTURE_READY" },
        window.location.origin,
      );
      if (attempts >= 20) window.clearInterval(timer);
    };
    const timer = window.setInterval(askForCapture, 300);
    askForCapture();
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!pendingExternalCapture || !products.length) return;
    void applyCaptureData(pendingExternalCapture);
    setPendingExternalCapture(null);
  }, [applyCaptureData, pendingExternalCapture, products.length]);

  const clearForm = () => {
    if (isReadOnly) {
      toast.error("Este registro solo se puede visualizar.");
      return;
    }
    resetDraft();
  };

  const validate = (
    candidateClient: Client | null = selectedClient,
    requireRegisteredClient = true,
  ): SaleValidationError | null => {
    if (!rows.length)
      return {
        message: "Agrega productos o captura un HTML antes de vender.",
      };
    const missing = rows.filter((row) => !row.matched);
    if (missing.length) {
      return {
        message: `Productos no encontrados: ${missing
          .slice(0, 5)
          .map((row) => row.code)
          .join(", ")}`,
      };
    }

    const customerName = safeTrim(form.customerName);
    const customerDni = normalizeDocumentText(form.customerDoc);
    const customerRuc = normalizeDocumentText(form.customerRuc);
    const matchedName = customerName
      ? (clientOptions.find(
          (opt) =>
            normalizeLabelText(opt.label) === normalizeLabelText(customerName),
        )?.client ?? null)
      : null;
    const matchedDni = customerDni
      ? (clientOptions.find(
          (opt) => normalizeDocumentText(opt.client.dni) === customerDni,
        )?.client ?? null)
      : null;
    const matchedRuc = customerRuc
      ? (clientOptions.find(
          (opt) => normalizeDocumentText(opt.client.ruc) === customerRuc,
        )?.client ?? null)
      : null;
    const candidateDni = normalizeDocumentText(candidateClient?.dni);
    const candidateRuc = normalizeDocumentText(candidateClient?.ruc);
    const capturedInvoiceApiClient =
      form.docTypeCode === "01" &&
      Boolean(capture) &&
      customerRuc === capturedInvoiceApiRucRef.current &&
      formMatchesClient(capturedInvoiceApiClientRef.current)
        ? capturedInvoiceApiClientRef.current
        : null;
    const validDniClient =
      matchedDni ??
      (customerDni && candidateDni === customerDni ? candidateClient : null);
    const validRucClient =
      matchedRuc ??
      (customerRuc && candidateRuc === customerRuc ? candidateClient : null) ??
      (customerRuc && capturedInvoiceApiClient
        ? capturedInvoiceApiClient
        : null);
    const validatedClient =
      matchedName ??
      candidateClient ??
      selectedClient ??
      capturedInvoiceApiClient ??
      matchedDni ??
      matchedRuc ??
      null;

    if (form.docTypeCode === "01" && customerRuc.length !== 11) {
      return {
        message: "Factura requiere RUC de 11 digitos.",
        field: "customerRuc",
      };
    }
    if (form.docTypeCode === "01" && !isValidPeruRuc(customerRuc)) {
      return {
        message: "Factura requiere un RUC valido.",
        field: "customerRuc",
      };
    }
    if (
      form.docTypeCode !== "01" &&
      customerDni &&
      ![8, 9].includes(customerDni.length)
    ) {
      return {
        message: "El DNI debe tener 8 o 9 digitos.",
        field: "customerDoc",
      };
    }
    const total = Number(totals.total.toFixed(2));
    if (form.docTypeCode === "03" && total >= 700 && customerDni.length !== 8) {
      return {
        message: "Boleta desde S/ 700.00 requiere DNI de 8 digitos.",
        field: "customerDoc",
      };
    }
    if (
      form.docTypeCode === "01" &&
      total >= 2000 &&
      form.paymentMethod.includes("EFECTIVO")
    ) {
      return {
        message: "Factura desde S/ 2,000.00 no permite pago en efectivo.",
        field: "paymentMethod",
      };
    }
    if (
      form.condition !== "PAGO/VARIOS" &&
      form.paymentMethod === "(SELECCIONE)"
    ) {
      return { message: "Seleccione forma de pago.", field: "paymentMethod" };
    }
    const paymentNeedsBank =
      form.condition !== "PAGO/VARIOS" &&
      !["(SELECCIONE)", "EFECTIVO", "-"].includes(form.paymentMethod);
    if (
      paymentNeedsBank &&
      ["(SELECCIONE)", "-"].includes(safeTrim(form.bankEntity))
    ) {
      return { message: "Seleccione entidad bancaria.", field: "bankEntity" };
    }
    if (paymentNeedsBank && !safeTrim(form.operationNumber)) {
      return {
        message: "Ingresa el numero de operacion.",
        field: "operationNumber",
      };
    }
    const isCashSplitPayment =
      form.condition !== "PAGO/VARIOS" &&
      form.paymentMethod.includes("/") &&
      form.paymentMethod.includes("EFECTIVO");
    const paymentDeposit = Number(form.paymentDeposit || 0);
    if (isCashSplitPayment && paymentDeposit <= 0) {
      return {
        message: "Ingresa el monto por banco.",
        field: "paymentDeposit",
      };
    }
    if (isCashSplitPayment && paymentDeposit >= total) {
      return {
        message: "Efectivo y deposito deben ser mayores a 0.",
        field: "paymentDeposit",
      };
    }
    if (!requireRegisteredClient) {
      return null;
    }
    if (customerName && !validatedClient) {
      return {
        message:
          "Intentaste seleccionar un cliente que no existe, por favor agrega el cliente y seleccionalo.",
        field: "customerName",
      };
    }
    if (customerDni && !validDniClient) {
      return {
        message: "El DNI no existe. Agrega el cliente y seleccionalo.",
        field: "customerDoc",
      };
    }
    if (customerRuc && !validRucClient) {
      return {
        message: "El RUC no existe. Agrega el cliente y seleccionalo.",
        field: "customerRuc",
      };
    }
    if (!validatedClient) {
      return { message: "Selecciona un cliente.", field: "customerName" };
    }
    if (form.docTypeCode === "01" && !validatedClient) {
      return {
        message: "Para factura debes seleccionar un cliente registrado.",
        field: "customerName",
      };
    }
    return null;
  };

  const renderTicketDocument = (
    documentNumber: string,
    noteId: number,
    preGeneratedQrBase64?: string,
  ) => (
    <TicketDocument
      clientName={form.customerName || "VARIOS"}
      clientId={
        form.docTypeCode === "01"
          ? form.customerRuc
          : [8, 9].includes(normalizeDocumentText(form.customerDoc).length)
            ? form.customerDoc
            : ""
      }
      clientAddress={form.address}
      docType={DOC_CONFIG[form.docTypeCode].ticket}
      paymentMethod={form.paymentMethod}
      condition={form.condition}
      bankEntity={form.bankEntity}
      operationNumber={form.operationNumber}
      memberCode={form.memberCode}
      transactionNumber={form.transactionNumber}
      saleType={saleType}
      items={cartItems}
      totals={{
        subTotal: totals.subtotal,
        total: totals.total,
        itemCount: rows.length,
      }}
      documentNumber={documentNumber}
      noteId={noteId}
      companyName={session.companyName}
      companyRuc={session.companyRuc}
      companyAddress={session.companyAddress}
      companyDistrict={session.companyDistrict}
      summary={{
        operacionGravada: totals.base,
        descuento: totals.discount,
        showDiscount: totals.discount > 0,
        subtotal: totals.base,
        igv: totals.igv,
        total: totals.total,
        pvsTotalVenta: totals.pv,
        pvsTotalMes: monthlyPvs,
      }}
      preGeneratedQrBase64={preGeneratedQrBase64}
    />
  );

  const buildTicketBlob = async (documentNumber: string, noteId: number) => {
    const qrClientDoc =
      form.docTypeCode === "01"
        ? safeTrim(form.customerRuc)
        : [8, 9].includes(normalizeDocumentText(form.customerDoc).length)
          ? normalizeDocumentText(form.customerDoc)
          : "";
    const qrData = [
      session.companyRuc || "20601070155",
      form.docTypeCode,
      documentNumber,
      totals.igv.toFixed(2),
      totals.total.toFixed(2),
      localDate(),
      form.docTypeCode === "01" ? "06" : "01",
      qrClientDoc || (form.docTypeCode === "01" ? "00000000000" : "00000000"),
    ].join("|");
    const preGeneratedQrBase64 = await generateTicketQrBase64(qrData);
    return await pdf(
      renderTicketDocument(documentNumber, noteId, preGeneratedQrBase64),
    ).toBlob();
  };

  const buildInvoiceBlob = async (documentNumber: string, noteId: number) => {
    const qrClientDoc = safeTrim(form.customerRuc) || "00000000000";
    const qrData = [
      session.companyRuc || "20601070155",
      "01",
      documentNumber,
      totals.igv.toFixed(2),
      totals.total.toFixed(2),
      form.emissionDate || localDate(),
      "06",
      qrClientDoc,
    ].join("|");
    const preGeneratedQrBase64 = await generateTicketQrBase64(qrData);
    const [serie = "FA01", ...numberParts] = documentNumber.split("-");
    const invoice: ServiceInvoiceListItem = {
      compra: {
        compraId: noteId,
        notaId: noteId,
        companiaId: session.companyId,
        documento: "FACTURA",
        tipoCodigo: "01",
        compraConcepto: form.concept,
        serie,
        numero: numberParts.join("-") || documentNumber,
        nroComprobante: documentNumber,
        fechaEmision: form.emissionDate || localDate(),
        fechaRegistro: form.emissionDate || localDate(),
        clienteId: selectedClient?.id,
        clienteRazon: form.customerName || "CLIENTE",
        clienteRuc: form.customerRuc,
        clienteDni: form.customerDoc,
        direccionFiscal: form.address || "-",
        subTotal: totals.base,
        igv: totals.igv,
        total: totals.total,
        saldo: totals.total,
        formaPago: form.condition.replace("ALCONTADO", "AL CONTADO"),
        condicion: form.condition,
        totalDetalles: rows.length,
      },
      detalles: rows.map((row, index) => ({
        detalleCompraId: index + 1,
        compraId: noteId,
        productId: row.product.id,
        codigoProducto: row.code,
        unidadMedida: row.product.unidadMedida || "NIU",
        detalleDesc: row.description,
        detalleCant: row.quantity,
        detallePrecio: row.price,
        importe: row.quantity * row.price,
        pv: row.pv,
        sv: row.sv,
      })),
    };

    return await pdf(
      ServiceInvoicePdfDocument({
        invoice,
        company: {
          name: session.companyName,
          ruc: session.companyRuc,
          address: session.companyAddress,
          phone: session.companyPhone,
        },
        preGeneratedQrBase64,
      }),
    ).toBlob();
  };

  const isTicketOutputBlocked = () =>
    [viewSunatStatus?.estadoSunat, viewSunatStatus?.docuEstado].some((value) =>
      ["ANULADO", "RECHAZADO"].includes(safeTrim(value).toUpperCase()),
    );

  const downloadTicket = async (documentNumber: string, noteId: number) => {
    if (isTicketOutputBlocked()) {
      toast.error("No se puede descargar un comprobante anulado o rechazado.");
      return;
    }
    const blob = await buildTicketBlob(documentNumber, noteId);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${documentNumber || `TICKET_${Date.now()}`}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  };

  const printTicket = async (ticket = lastTicket) => {
    if (!ticket) return;
    if (isTicketOutputBlocked()) {
      toast.error("No se puede imprimir un comprobante anulado o rechazado.");
      return;
    }
    const blob = await buildTicketBlob(ticket.documentNumber, ticket.noteId);
    const file = new File([blob], `${ticket.documentNumber || "ticket"}.pdf`, {
      type: "application/pdf",
    });
    const formData = new FormData();
    formData.append("file", file);

    const result = await apiRequest({
      url: buildRootApiUrl("/api/print/pdf"),
      method: "POST",
      data: formData,
      config: { headers: { Accept: "application/json" } },
      fallback: null,
    });

    const resultRecord = asRecord(result);
    if (!resultRecord?.ok) {
      const responseData = asRecord(asRecord(resultRecord?.response)?.data);
      const printMessage =
        safeTrim(
          responseData?.message ?? responseData?.error ?? resultRecord?.message,
        ) || "No se pudo enviar a la tiketera.";
      throw new Error(printMessage);
    }

    toast.success("Impresión enviada.");
  };

  const sendTicketEmail = async () => {
    if (!lastTicket || isSendingEmail) return;
    if (isTicketOutputBlocked()) {
      toast.error("No se puede enviar un comprobante anulado o rechazado.");
      return;
    }

    const recipient = safeTrim(form.customerEmail);
    if (!recipient) {
      toast.error("El cliente no tiene correo registrado.");
      return;
    }
    if (!isValidEmail(recipient)) {
      toast.error("Ingresa un correo valido, por ejemplo correo@dominio.com.");
      return;
    }
    setIsSendingEmail(true);
    try {
      const { documentNumber, noteId } = lastTicket;
      const isInvoice =
        viewSunatStatus?.notaDocu.toUpperCase().includes("FACTURA") ||
        form.docTypeCode === "01";
      let xmlUrl = viewSunatStatus?.xmlUrl ?? "";
      let cdrUrl = viewSunatStatus?.cdrUrl ?? "";

      if (isInvoice && (!xmlUrl || !cdrUrl) && viewSunatStatus?.docuId) {
        const syncResult = await apiRequest<
          Record<string, unknown>,
          unknown,
          null
        >({
          url: buildApiUrl(
            `/Nota/documentos/${viewSunatStatus.docuId}/sincronizar-archivos-cpe`,
          ),
          method: "POST",
          fallback: null,
        });
        const synced = asRecord(syncResult);
        xmlUrl = safeTrim(synced?.xmlUrl ?? synced?.XmlUrl);
        cdrUrl = safeTrim(synced?.cdrUrl ?? synced?.CdrUrl);
        if (synced?.ok) {
          setViewSunatStatus((current) =>
            current ? { ...current, xmlUrl, cdrUrl } : current,
          );
        }
      }

      if (isInvoice && (!xmlUrl || !cdrUrl)) {
        throw new Error("No se encontraron el XML y CDR del comprobante.");
      }

      const blob = isInvoice
        ? await buildInvoiceBlob(documentNumber, noteId)
        : await buildTicketBlob(documentNumber, noteId);
      const formData = new FormData();
      formData.append(
        "pdf",
        new File([blob], `${documentNumber || "comprobante"}.pdf`, {
          type: "application/pdf",
        }),
      );
      formData.append("para", recipient);
      formData.append(
        "asunto",
        `${isInvoice ? "Factura electrónica" : "Boleta electrónica"} ${documentNumber}`,
      );
      formData.append("esHtml", "true");
      formData.append("rucEmisor", session.companyRuc || "20601070155");
      formData.append("nroComprobante", documentNumber);
      formData.append("nombreCompania", session.companyName || "Mi Empresa");
      formData.append(
        "tipoComprobante",
        isInvoice ? "Factura electrónica" : "Boleta electrónica",
      );
      if (xmlUrl) {
        formData.append("xmlUrl", xmlUrl);
      }
      if (cdrUrl) {
        formData.append("cdrUrl", cdrUrl);
      }

      const result = await apiRequest<Record<string, unknown>, unknown, null>({
        url: buildApiUrl("/Correo/enviar-comprobante"),
        method: "POST",
        data: formData,
        config: { headers: { Accept: "application/json" } },
        fallback: null,
      });
      const response = asRecord(result);
      if (!response?.ok) {
        throw new Error(
          safeTrim(response?.mensaje) || "No se pudo enviar el correo.",
        );
      }
      const client = selectedClient ?? findClientFromForm();
      if (
        client?.id &&
        safeTrim(client.email).toLowerCase() !== recipient.toLowerCase()
      ) {
        const updated = await updateClient(client.id, {
          ...client,
          email: recipient,
        });
        if (!updated.ok) {
          throw new Error(
            updated.error ??
              "Correo enviado, pero no se pudo actualizar el cliente.",
          );
        }
        applyClient(
          updated.client ?? ({ ...client, email: recipient } as Client),
          {
            preserveDocType: true,
          },
        );
      }
      toast.success("Correo enviado correctamente.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo enviar el correo.",
      );
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleVoidViewedNote = () => {
    if (!lastTicket || isVoidingTicket) return;
    const documentNumber = lastTicket.documentNumber;
    const isInvoice = form.docTypeCode === "01";
    const documentLabel = isInvoice ? "factura" : "boleta";
    openDialog({
      title: `Anular ${documentLabel}`,
      content: (
        <p>
          ¿Seguro que deseas anular la {documentLabel} {documentNumber}
          {isInvoice ? " mediante nota de crédito" : ""}?
        </p>
      ),
      confirmText: "Anular",
      cancelText: "Cancelar",
      onConfirm: async () => {
        setIsVoidingTicket(true);
        try {
          const result = await apiRequest<
            Record<string, unknown>,
            unknown,
            null
          >({
            url: buildApiUrl(
              isInvoice
                ? "/Nota/factura/anular-individual"
                : "/Nota/boleta/anular-individual",
            ),
            method: "POST",
            data: {
              DOCU_ID: viewSunatStatus?.docuId || undefined,
              NRO_DOCUMENTO_MODIFICA: documentNumber,
              DESCRIPCION_MOTIVO: "ANULACION DE LA OPERACION",
              FECHA_DOCUMENTO: localDate(),
            },
            config: {
              headers: {
                Accept: "*/*",
                "Content-Type": "application/json",
              },
            },
          });
          const response = asRecord(result);
          const errorResponse = asRecord(response?.response);
          const errorData = asRecord(errorResponse?.data);
          const resultText = safeTrim(response?.resultado).toLowerCase();
          if (
            !result ||
            response?.ok === false ||
            resultText === "false" ||
            resultText === "0"
          ) {
            throw new Error(
              safeTrim(
                response?.mensaje ??
                  response?.message ??
                  errorData?.mensaje ??
                  errorData?.message,
              ) || `No se pudo anular la ${documentLabel}.`,
            );
          }
          setViewSunatStatus((current) =>
            current
              ? { ...current, estadoSunat: "ANULADO", docuEstado: "ANULADO" }
              : current,
          );
          toast.success(
            safeTrim(response?.mensaje ?? response?.message) ||
              `La ${documentLabel} fue anulada correctamente.`,
          );
        } catch (error) {
          toast.error(
            error instanceof Error
              ? error.message
              : `No se pudo anular la ${documentLabel}.`,
          );
          return false;
        } finally {
          setIsVoidingTicket(false);
        }
      },
    });
  };

  const registerSale = async () => {
    if (isReadOnly) {
      toast.error("Este registro solo se puede visualizar.");
      return;
    }
    if (rows.some((row) => !row.matched)) {
      openDialog({
        title: "Producto no registrado",
        content: (
          <p className="text-sm text-slate-600">
            Hay un producto que no está registrado, verifique la grilla.
          </p>
        ),
        confirmText: "Aceptar",
        hideCancelButton: true,
        maxWidth: "xs",
      });
      return;
    }
    if (
      rows.some(
        (row) => !Number.isFinite(row.quantity) || !Number.isFinite(row.price),
      )
    ) {
      focusSaleField();
      toast.error("Completa cantidad y precio de los productos.");
      return;
    }
    const belowCostRow = rows.find(
      (row) => safeRowNumber(row.price) < minAllowedPrice(row),
    );
    if (belowCostRow) {
      toast.error(
        `El precio no debe ser menor a: S/ ${money(
          minAllowedPrice(belowCostRow),
        )}`,
      );
      focusPriceInput(belowCostRow.code);
      return;
    }

    if (registerSaleRef.current) return;
    registerSaleRef.current = true;

    if (!selectedClient && !clients.length) {
      await fetchClients("");
    }

    const capturedInvoiceApiClient =
      form.docTypeCode === "01" &&
      Boolean(capture) &&
      normalizeDocumentText(form.customerRuc) ===
        capturedInvoiceApiRucRef.current &&
      formMatchesClient(capturedInvoiceApiClientRef.current)
        ? capturedInvoiceApiClientRef.current
        : null;
    let saleClient =
      selectedClient ?? findClientFromForm() ?? capturedInvoiceApiClient;
    const hasCapturedClientData = Boolean(
      safeTrim(form.customerName) ||
      safeTrim(form.customerDoc) ||
      safeTrim(form.customerEmail) ||
      safeTrim(form.customerRuc) ||
      safeTrim(form.memberCode),
    );

    const shouldCreateCapturedClient =
      !saleClient &&
      Boolean(capture) &&
      form.docTypeCode !== "101" &&
      hasCapturedClientData;

    const preCreateError = validate(saleClient, !shouldCreateCapturedClient);
    if (preCreateError) {
      focusSaleField(preCreateError.field);
      toast.error(preCreateError.message);
      registerSaleRef.current = false;
      return;
    }

    if (shouldCreateCapturedClient) {
      saleClient = await createClientFromCapturedForm();
      if (!saleClient) {
        registerSaleRef.current = false;
        return;
      }
    }

    const postCreateError = validate(saleClient);
    if (postCreateError) {
      focusSaleField(postCreateError.field);
      toast.error(postCreateError.message);
      registerSaleRef.current = false;
      return;
    }

    const doc = DOC_CONFIG[form.docTypeCode];
    const notaSerie = correlative?.serie || doc.serie;
    const notaNumero = correlative?.numero || "00000000";
    const total = Number(totals.total.toFixed(2));
    const isPagoVariosSale = form.condition === "PAGO/VARIOS";
    const notaFormaPago = isPagoVariosSale ? "-" : form.paymentMethod;
    const isCashSplitPayment =
      form.paymentMethod.includes("/") &&
      form.paymentMethod.includes("EFECTIVO");
    const depositoIngresado = Math.max(0, Number(form.paymentDeposit || 0));
    const efectivo =
      !isPagoVariosSale && form.paymentMethod === "EFECTIVO"
        ? total
        : !isPagoVariosSale && isCashSplitPayment
          ? Math.max(total - Math.min(depositoIngresado, total), 0)
          : 0;
    const deposito =
      !isPagoVariosSale && form.paymentMethod !== "EFECTIVO"
        ? isCashSplitPayment
          ? Math.min(depositoIngresado, total)
          : total
        : 0;
    if (!saleClient && form.docTypeCode === "01") {
      toast.error(
        "Para Factura debes registrar o seleccionar el cliente con + Cliente.",
      );
      registerSaleRef.current = false;
      return;
    }

    const clienteId = Number(saleClient?.id ?? 1) || 1;
    const notaAcuenta = isPagoVariosSale ? 0 : total;
    const notaSaldo = isPagoVariosSale ? total : 0;

    setIsSaving(true);
    try {
      const result = await apiRequest({
        url: buildApiUrl("/Nota/crearOrden"),
        method: "POST",
        data: {
          nota: {
            notaId: 0,
            notaDocu: doc.docu,
            clienteId,
            notaFecha: `${localDate()}T00:00:00`,
            notaUsuario: session.username,
            usuarioId: session.userId,
            notaFormaPago,
            notaCondicion: form.condition,
            notaFechaPago: new Date().toISOString(),
            notaDireccion: form.address || "-",
            notaSubtotal: total,
            notaMovilidad: 0,
            notaDescuento: Number(totals.discount.toFixed(2)),
            notaTotal: total,
            notaAcuenta,
            notaSaldo,
            notaAdicional: 0,
            notaTarjeta: 0,
            notaPagar: total,
            notaEstado: isPagoVariosSale ? "PENDIENTE" : "CANCELADO",
            companiaId: session.companyId,
            notaEntrega: form.delivery,
            notaConcepto: form.concept || "MERCADERIA",
            notaSerie,
            notaNumero,
            notaGanancia: 0,
            icbper: 0,
            entidadBancaria: isPagoVariosSale ? "-" : form.bankEntity || "-",
            nroOperacion: isPagoVariosSale ? "" : form.operationNumber,
            efectivo,
            deposito,
            notaTransaccion: form.transactionNumber,
            miembro: form.customerName || "VARIOS",
            codigoCliente: form.memberCode,
            conceptoOBS: saleTypeForDatabase,
            estadoOBS: "EMITIDO",
            pv: `${Number(totals.pv.toFixed(2))} PV`,
            image: "",
            codigoRes: "",
            responsable: "",
          },
          detalles: rows.map((row) => ({
            idProducto: row.product.id,
            detalleCantidad: safeRowNumber(row.quantity),
            detalleUm: row.product.unidadMedida || "UNIDAD",
            detalleDescripcion: row.description,
            detalleCosto: row.cost,
            detallePrecio: safeRowNumber(row.price),
            detallePV: Number(
              (row.pv * safeRowNumber(row.quantity)).toFixed(2),
            ),
            detalleSV: Number(
              (row.sv * safeRowNumber(row.quantity)).toFixed(2),
            ),
            detalleImporte: Number(
              (safeRowNumber(row.price) * safeRowNumber(row.quantity)).toFixed(
                2,
              ),
            ),
            detalleEstado: "PENDIENTE",
            valorUM: 1,
          })),
        },
        config: {
          headers: { Accept: "*/*", "Content-Type": "application/json" },
        },
        fallback: null,
      });

      const parsed = parseNotaResult(result);
      const documentNumber = `${notaSerie}-${parsed.number || notaNumero}`;
      if (!parsed.noteId) {
        toast.error(
          parsed.raw.toLowerCase().includes("existe")
            ? "El Numero de transacción que ingreso ya existe"
            : parsed.raw || "No se pudo registrar la venta.",
        );
        return;
      }

      if (
        saleClient?.id &&
        safeTrim(saleClient.documentoPredeterminado).toUpperCase() !== doc.docu
      ) {
        const updated = await updateClient(saleClient.id, {
          ...saleClient,
          documentoPredeterminado: doc.docu,
        });
        if (updated.ok) {
          saleClient =
            updated.client ??
            ({ ...saleClient, documentoPredeterminado: doc.docu } as Client);
          applyClient(saleClient, { preserveDocType: true });
        } else {
          toast.warning(
            "Venta registrada, pero no se pudo actualizar el documento predeterminado del cliente.",
          );
        }
      }

      const sunat = doc.docu === "FACTURA" ? parseSunatResult(result) : null;
      const rejectedInvoice = sunat ? isRejectedSunatResult(sunat) : false;
      const ticket = { documentNumber, noteId: parsed.noteId };
      setLastTicket(ticket);
      if (rejectedInvoice) {
        setViewSunatStatus({
          docuId: 0,
          estadoSunat: "RECHAZADO",
          docuEstado: "RECHAZADO",
          notaDocu: doc.docu,
          xmlUrl: "",
          cdrUrl: "",
        });
      }
      navigate(`/sales/html_capture/${parsed.noteId}`, { replace: true });
      if (!rejectedInvoice) {
        void printTicket(ticket).catch((error) => {
          toast.error(
            error instanceof Error
              ? error.message
              : "No se pudo enviar a la tiketera.",
          );
        });
      }
      if (isPagoVariosSale) {
        toast.success(
          `${doc.docu} registrada para Pago Varios: ${documentNumber}`,
        );
        window.dispatchEvent(new Event("sgo:pago-varios-updated"));
      } else if (doc.docu === "FACTURA") {
        const detail = [sunat?.code, sunat?.message]
          .filter(Boolean)
          .join(" - ");
        if (sunat?.accepted) {
          toast.success(`FACTURA registrada y aceptada: ${documentNumber}`);
        } else if (rejectedInvoice) {
          openDialog({
            title: "LA FACTURA FUE RECHAZADA",
            content: (
              <div className="space-y-2 text-sm text-slate-700">
                <p className="font-semibold text-red-700">
                  LA FACTURA FUE RECHAZADA
                </p>
                {detail ? <p>{detail}</p> : null}
              </div>
            ),
            confirmText: "Aceptar",
            hideCancelButton: true,
            maxWidth: "xs",
          });
        } else if (detail) {
          toast.warning(
            `FACTURA registrada sin aceptación OSE/SUNAT: ${detail}`,
          );
        } else {
          toast.warning(
            `FACTURA registrada: ${documentNumber}. OSE/SUNAT no devolvió respuesta.`,
          );
        }
      } else if (doc.docu === "BOLETA") {
        toast.success(`BOLETA registrada: ${documentNumber}. `);
      } else {
        toast.success(`${doc.docu} registrada: ${documentNumber}`);
      }
    } catch (err) {
      console.error("No se pudo registrar venta HTML", err);
      toast.error("No se pudo registrar la venta.");
    } finally {
      setIsSaving(false);
      registerSaleRef.current = false;
    }
  };

  const PagoVariosModal = pagoVariosModalOpen ? (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 px-4 py-6">
      <section className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex justify-end border-b border-slate-100 px-5 py-4">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-50"
            onClick={() => setPagoVariosModalOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {pagoVariosConceptos.length > 1 ? (
          <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
            Para pagar varios, seleccione documentos con el mismo Concepto OBS.
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_350px]">
          <div className="min-h-0 overflow-auto">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
              <label className="inline-flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                <input
                  type="checkbox"
                  checked={
                    pagoVariosItems.length > 0 &&
                    pagoVariosItems.every((item) =>
                      pagoVariosSelectedIds.includes(item.notaId),
                    )
                  }
                  onChange={(event) =>
                    setPagoVariosSelectedIds(
                      event.target.checked
                        ? pagoVariosItems.map((item) => item.notaId)
                        : [],
                    )
                  }
                />
                Seleccionar todo
              </label>
              <span className="ml-auto text-xs font-medium text-slate-400">
                {integer(pagoVariosItems.length)} pendientes
              </span>
            </div>

            <table className="w-full min-w-[780px] border-collapse text-sm">
              <thead className="bg-white text-xs uppercase text-slate-400">
                <tr>
                  <th className="w-12 border-b border-slate-100 px-5 py-3 text-left">
                    Sel
                  </th>
                  <th className="border-b border-slate-100 px-3 py-3 text-left">
                    Documento
                  </th>
                  <th className="border-b border-slate-100 px-3 py-3 text-left">
                    Codigo
                  </th>
                  <th className="border-b border-slate-100 px-3 py-3 text-left">
                    Cliente
                  </th>
                  <th className="border-b border-slate-100 px-3 py-3 text-left">
                    Concepto OBS
                  </th>
                  <th className="border-b border-slate-100 px-5 py-3 text-right">
                    Monto
                  </th>
                </tr>
              </thead>
              <tbody>
                {isPagoVariosLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-slate-400"
                    >
                      Cargando Pago Varios...
                    </td>
                  </tr>
                ) : pagoVariosItems.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-slate-400"
                    >
                      No hay documentos pendientes para Pago Varios.
                    </td>
                  </tr>
                ) : (
                  pagoVariosItems.map((item) => (
                    <tr
                      key={`${item.docuId}-${item.notaId}`}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="px-5 py-3">
                        <input
                          type="checkbox"
                          checked={pagoVariosSelectedIds.includes(item.notaId)}
                          onChange={(event) =>
                            setPagoVariosSelectedIds((current) =>
                              event.target.checked
                                ? [...current, item.notaId]
                                : current.filter(
                                    (rowId) => rowId !== item.notaId,
                                  ),
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-700">
                        {item.documento}
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {item.codigo}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {item.razonSocial}
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {item.conceptoOBS}
                      </td>
                      <td className="px-5 py-3 text-right font-black text-slate-800">
                        S/ {money(item.monto)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <aside className="flex min-h-0 flex-col gap-4 border-t border-slate-100 bg-slate-50/70 p-5 lg:border-l lg:border-t-0">
            <div className="rounded-md border border-red-100 bg-white p-4">
              <p className="text-[11px] font-black uppercase text-red-600">
                Total a pagar
              </p>
              <p className="mt-1 text-3xl font-black text-slate-900">
                S/ {money(pagoVariosTotal)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {integer(selectedPagoVariosItems.length)} documentos
                seleccionados
              </p>
            </div>

            <label className="grid gap-1 text-xs font-bold text-slate-500">
              Forma pago
              <select
                data-pago-varios-forma="true"
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-slate-400"
                value={pagoVariosFormaPago}
                onChange={(event) => setPagoVariosFormaPago(event.target.value)}
              >
                {PAYMENT_METHOD_OPTIONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="grid min-w-0 gap-1 text-xs font-bold text-slate-500">
                Depósito
                <input
                  type="number"
                  inputMode="decimal"
                  data-pago-varios-deposito="true"
                  min="0"
                  step="0.01"
                  className="h-11 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-right text-base font-semibold text-slate-700 outline-none focus:border-slate-400 disabled:bg-slate-100"
                  value={
                    isPagoVariosMixed
                      ? pagoVariosDeposito
                      : pagoVariosDepositoFinal > 0
                        ? String(Number(pagoVariosDepositoFinal.toFixed(2)))
                        : ""
                  }
                  onChange={(event) =>
                    setPagoVariosDeposito(event.target.value)
                  }
                  disabled={!isPagoVariosMixed}
                />
              </label>
              <label className="grid min-w-0 gap-1 text-xs font-bold text-slate-500">
                Efectivo
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  className="h-11 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-right text-base font-semibold text-slate-700 outline-none disabled:bg-slate-100"
                  value={
                    pagoVariosEfectivoFinal > 0
                      ? String(Number(pagoVariosEfectivoFinal.toFixed(2)))
                      : ""
                  }
                  disabled
                />
              </label>
            </div>

            <label className="grid gap-1 text-xs font-bold text-slate-500">
              Entidad
              <select
                data-pago-varios-entidad="true"
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 disabled:bg-slate-100"
                value={pagoVariosEntidadFinal}
                onChange={(event) => {
                  setPagoVariosEntidad(event.target.value);
                  focusPagoVariosField("operacion");
                }}
                disabled={!pagoVariosEntidadEditable}
              >
                {BANK_OPTIONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="grid gap-1 text-xs font-bold text-slate-500">
              Nro operacion
              <input
                data-pago-varios-operacion="true"
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 disabled:bg-slate-100"
                value={pagoVariosRequiereOperacion ? pagoVariosOperacion : ""}
                onChange={(event) => setPagoVariosOperacion(event.target.value)}
                onFocus={(event) => event.currentTarget.select()}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  focusPagoVariosField("descripcion");
                }}
                disabled={!pagoVariosRequiereOperacion}
              />
            </label>

            <label className="grid gap-1 text-xs font-bold text-slate-500">
              Descripcion
              <textarea
                data-pago-varios-descripcion="true"
                ref={pagoVariosDescripcionRef}
                className="min-h-[76px] resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
                value={pagoVariosDescripcion}
                onFocus={(event) => event.currentTarget.select()}
                onChange={(event) =>
                  setPagoVariosDescripcion(event.target.value)
                }
              />
            </label>

            <button
              type="button"
              className="mt-auto inline-flex h-11 items-center justify-center rounded-md bg-red-700 px-4 text-sm font-black uppercase text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={registerPagoVarios}
              disabled={
                isPagoVariosSaving ||
                isPagoVariosLoading ||
                !selectedPagoVariosItems.length ||
                pagoVariosConceptos.length !== 1
              }
            >
              {isPagoVariosSaving ? "Guardando..." : "Pagar seleccionados"}
            </button>
          </aside>
        </div>
      </section>
    </div>
  ) : null;
  const isRejectedInvoiceView =
    isReadOnly &&
    (viewSunatStatus?.notaDocu.toUpperCase().includes("FACTURA") ||
      form.docTypeCode === "01") &&
    [viewSunatStatus?.estadoSunat, viewSunatStatus?.docuEstado].some(
      (value) => safeTrim(value).toUpperCase() === "RECHAZADO",
    );
  const isAnnulledViewedNote =
    isReadOnly &&
    [viewSunatStatus?.estadoSunat, viewSunatStatus?.docuEstado].some(
      (value) => safeTrim(value).toUpperCase() === "ANULADO",
    );
  const isBlockedViewedNote = isRejectedInvoiceView || isAnnulledViewedNote;
  const canVoidViewedNote =
    isFromOrderNotesView &&
    ["01", "03"].includes(form.docTypeCode) &&
    Boolean(lastTicket) &&
    !isVoidingTicket &&
    ![viewSunatStatus?.estadoSunat, viewSunatStatus?.docuEstado].some((value) =>
      ["ANULADO", "RECHAZADO"].includes(safeTrim(value).toUpperCase()),
    );

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1760px] space-y-4">
      <BlockingSpinner
        show={isLoadingRecord || isApplyingCapture}
        text={
          isLoadingRecord
            ? "Cargando registro..."
            : "Cargando datos de la extensión..."
        }
      />
      {PagoVariosModal}
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        {isExistingRoute ? (
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
            onClick={() =>
              isFromOrderNotesView
                ? navigate("/sales/order_notes")
                : navigate(-1)
            }
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          {canVoidViewedNote ? (
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 text-sm font-medium text-red-800 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleVoidViewedNote}
            >
              <Trash2 className="h-4 w-4" />
              Anular
            </button>
          ) : null}
          {isExistingRoute ? (
            <button
              type="button"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              onClick={openNewRecord}
            >
              <Plus className="h-4 w-4" />
              Nuevo
            </button>
          ) : null}
          {lastTicket ? (
            <>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() =>
                  void printTicket().catch((error) => {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "No se pudo enviar a la tiketera.",
                    );
                  })
                }
                disabled={isBlockedViewedNote}
              >
                <Printer className="h-4 w-4" />
                Imprimir
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 text-sm font-medium text-blue-800 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() =>
                  downloadTicket(lastTicket.documentNumber, lastTicket.noteId)
                }
                disabled={isBlockedViewedNote}
              >
                <FileDown className="h-4 w-4" />
                Descargar
              </button>
            </>
          ) : null}
        </div>
      </div>

      {/* Barra de acciones */}
      {!isReadOnly ? (
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm,text/html"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          {canCaptureData ? (
            <button
              type="button"
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium leading-none text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || isSaving || isReadOnly}
            >
              <FileUp className="h-4 w-4" />
              Capturar datos
            </button>
          ) : null}
          <button
            type="button"
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium leading-none text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            onClick={clearForm}
            disabled={isSaving || isReadOnly}
          >
            <RotateCcw className="h-4 w-4" />
            Limpiar
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-green-700 px-4 text-sm font-semibold leading-none text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            onClick={registerSale}
            disabled={
              isSaving ||
              isReadOnly ||
              !rows.length ||
              rows.some((row) => !row.matched)
            }
          >
            {isSaving ? (
              <FileDown className="h-4 w-4 animate-pulse" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {isSaving ? "Confirmando..." : "Confirmar"}
          </button>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_420px] 2xl:grid-cols-[minmax(0,1fr)_440px] xl:items-start">
        {/* Productos capturados */}
        <section className="order-1 min-w-0 rounded-lg border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2">
            <h2 className="mr-auto">
              <span className="block rounded-md border border-red-200 bg-red-50 px-4 py-2">
                <span className="block text-[10px] font-semibold uppercase text-red-300">
                  Tipo venta
                </span>
                <span className="block text-center text-sm font-black uppercase text-red-700">
                  {saleType}
                </span>
              </span>
            </h2>

            <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:w-auto sm:min-w-[260px]">
              <div className="rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase text-slate-400">
                  PVS venta
                </p>
                <p className="text-right text-base font-semibold tabular-nums text-slate-800">
                  {money(totals.pv)}
                </p>
              </div>
              <div className="rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase text-blue-600">
                  PVS mes
                </p>
                <p className="text-right text-base font-semibold tabular-nums text-slate-800">
                  {money(monthlyPvs)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid min-w-0 gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="relative min-w-0">
              <input
                ref={manualProductSearchRef}
                type="search"
                data-no-uppercase="true"
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400"
                placeholder="Buscar producto por código o nombre"
                value={manualProductSearch}
                onChange={(event) => {
                  setManualProductSearch(event.currentTarget.value);
                  setManualProductSearchFocused(true);
                }}
                onFocus={() => setManualProductSearchFocused(true)}
                onBlur={() =>
                  window.setTimeout(
                    () => setManualProductSearchFocused(false),
                    120,
                  )
                }
                onKeyDown={(event) => {
                  handleManualProductKeyDown(event);
                }}
                data-auto-next="true"
                disabled={loading || isSaving || isReadOnly || isCapturedSale}
              />
              {manualProductSearchFocused &&
              !dialogOpen &&
              !pagoVariosModalOpen ? (
                <div className="absolute left-0 right-0 top-10 z-30 max-h-72 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
                  {filteredManualProducts.length ? (
                    filteredManualProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50 ${
                          filteredManualProducts[manualProductIndex]?.id ===
                          product.id
                            ? "bg-slate-100"
                            : ""
                        }`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          void handleAddManualProduct(product);
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-700">
                            {product.nombre}
                          </span>
                          <span className="text-xs text-slate-400">
                            {product.codigo}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold text-slate-700">
                          S/{" "}
                          {money(
                            Number(product.preVenta ?? product.preVentaB ?? 0),
                          )}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-slate-400">
                      {loading ? "Cargando productos..." : "Sin coincidencias"}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void handleAddManualProduct()}
              disabled={loading || isSaving || isReadOnly || isCapturedSale}
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>

          <div className="max-h-[46vh] w-full max-w-full overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm sm:min-w-[760px]">
              <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  {[
                    "Código",
                    "Descripcion",
                    "Cantidad",
                    "Precio",
                    "PV Total",
                    "SV Total",
                    "Importe",
                    "",
                  ].map((header, i) => (
                    <th
                      key={header}
                      className={`border-b border-slate-100 px-4 py-2 font-medium ${
                        i > 0 ? "text-right" : "text-left"
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-14 text-center text-sm text-slate-400"
                    >
                      Captura un HTML o agrega productos para venta libre.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.code}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-2 font-medium text-slate-500">
                        {row.code}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        <span className="flex items-center gap-2">
                          {row.description}
                          {!row.matched && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                              no encontrado
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-slate-600">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={
                            Number.isFinite(row.quantity) ? row.quantity : ""
                          }
                          data-auto-next="true"
                          onChange={(event) =>
                            handleRowQuantityChange(
                              row.code,
                              event.currentTarget.value,
                            )
                          }
                          onKeyDown={handleNumberInputKeyDown}
                          onFocus={(event) =>
                            moveCaretToEnd(event.currentTarget)
                          }
                          onBlur={() => handleRowPriceBlur(row.code)}
                          disabled={isSaving || isReadOnly || isCapturedSale}
                          className="ml-auto h-8 w-24 rounded-md border border-slate-200 bg-white px-2 text-right text-sm outline-none transition-colors focus:border-slate-400 disabled:bg-slate-50"
                        />
                      </td>
                      <td className="px-4 py-2 text-right text-slate-600">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={Number.isFinite(row.price) ? row.price : ""}
                          data-sale-price-input="true"
                          data-row-code={row.code}
                          data-auto-next="true"
                          onChange={(event) =>
                            handleRowPriceChange(
                              row.code,
                              event.currentTarget.value,
                            )
                          }
                          onKeyDown={handleNumberInputKeyDown}
                          onFocus={(event) =>
                            moveCaretToEnd(event.currentTarget)
                          }
                          disabled={isSaving || isReadOnly || isCapturedSale}
                          className="ml-auto h-8 w-24 rounded-md border border-slate-200 bg-white px-2 text-right text-sm outline-none transition-colors focus:border-slate-400 disabled:bg-slate-50"
                        />
                      </td>
                      <td className="px-4 py-2 text-right text-slate-500">
                        {money(row.pv)}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-slate-700">
                        {money(row.pv * safeRowNumber(row.quantity))}
                      </td>
                      <td className="px-4 py-2 text-right text-slate-500">
                        {money(row.sv * safeRowNumber(row.quantity))}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-slate-800">
                        {money(
                          safeRowNumber(row.price) *
                            safeRowNumber(row.quantity),
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-100 text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                          onClick={() => handleRemoveRow(row.code)}
                          disabled={isSaving || isReadOnly || isCapturedSale}
                          title="Quitar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Totales: barra compacta al pie de la misma tarjeta */}
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-sm">
            <span className="font-semibold text-slate-600">
              Items: {integer(rows.length)}
            </span>
            <div className="flex min-w-0 flex-wrap items-center justify-start gap-x-4 gap-y-1 sm:justify-end sm:gap-x-6">
              <Summary label="Sub total" value={totals.subtotal} />
              <Summary label="IGV" value={totals.igv} />
              {totals.discount > 0 && (
                <Summary label="Descuento" value={totals.discount} negative />
              )}
              <div className="flex items-baseline gap-2 border-l border-slate-200 pl-4 sm:pl-6">
                <span className="text-sm font-semibold text-slate-700">
                  Total
                </span>
                <span className="text-lg font-semibold text-slate-900">
                  S/ {money(totals.total)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Datos de la venta */}
        <section className="order-2 min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white xl:sticky xl:top-4">
          {isBlockedViewedNote ? (
            <div className="bg-red-600 px-4 py-2 text-center text-sm font-black tracking-[0.18em] text-white">
              ANULADO
            </div>
          ) : null}
          <HookForm methods={formMethods} onSubmit={() => undefined}>
            <div className="px-4 py-3">
              <SaleCaptureFormFields
                clientOptions={clientOptions}
                disabled={isSaving || isReadOnly}
                correlative={correlative?.nroComprobante}
                totalAmount={totals.total}
                preserveMissingClientData={isCapturedSale}
                onClientSelected={applyClient}
                allowEmailEdit={isExistingRoute}
                onSendEmail={
                  isExistingRoute ? () => void sendTicketEmail() : undefined
                }
                sendEmailDisabled={
                  isBlockedViewedNote ||
                  !lastTicket ||
                  !isValidEmail(form.customerEmail)
                }
                sendingEmail={isSendingEmail}
                onCreateClient={
                  isReadOnly ? undefined : handleOpenCreateClientModal
                }
                onCreateAndEditCapturedClient={
                  canEditCapturedClient
                    ? () => void handleCreateAndEditCapturedClient()
                    : undefined
                }
              />
            </div>
          </HookForm>
        </section>
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  negative,
}: {
  label: string;
  value: number;
  negative?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-slate-500">{label}</span>
      <span
        className={`font-medium ${
          negative && value > 0 ? "text-red-600" : "text-slate-700"
        }`}
      >
        {negative && value > 0 ? "-" : ""}
        {money(value)}
      </span>
    </div>
  );
}
