import { PDFViewer, pdf } from "@react-pdf/renderer";
import {
  CheckCircle2,
  FileDown,
  FileUp,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate, useParams } from "react-router";
import CustomerDialogContent from "@/components/CustomerDialogContent";
import TicketDocument from "@/components/Ticket";
import { HookForm } from "@/components/forms/HookForm";
import { SaleCaptureFormFields } from "@/components/sales/SaleCaptureFormFields";
import { generateTicketQrBase64 } from "@/components/ticketQr";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import { useDialogStore } from "@/store/app/dialog.store";
import { useClientsStore } from "@/store/customers/customers.store";
import { useProductsStore } from "@/store/products/products.store";
import type { Client } from "@/types/customer";
import type { Product } from "@/types/product";
import type { PosCartItem } from "@/types/pos";

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
  condition: "ALCONTADO" | "CREDITO";
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
  customerName: string;
  customerEmail: string;
  customerDoc: string;
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
type StoredTicket = {
  capture: CaptureData | null;
  documentNumber: string;
  form: SaleForm;
  monthlyPvs: number;
  noteId: number;
  rows: SaleRow[];
};
type SaleListItem = {
  noteId: number;
  document: string;
  date: string;
  customer: string;
  paymentMethod: string;
  pvs: number;
  total: number;
  state: string;
};

const DOC_CONFIG = {
  "03": { docu: "BOLETA", serie: "BA01", ticket: "boleta" as const },
  "01": { docu: "FACTURA", serie: "FA01", ticket: "factura" as const },
  "101": { docu: "PROFORMA V", serie: "0001", ticket: "proforma" as const },
};

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
  customerName: "",
  customerEmail: "",
  customerDoc: "",
  address: "",
  memberCode: "",
  transactionNumber: "",
};
const ticketStorageKey = (noteId: number | string) =>
  `sgo:html-capture-ticket:${noteId}`;

const safeTrim = (value: unknown) => String(value ?? "").trim();
const normalizeCode = (value: unknown) => safeTrim(value).toUpperCase();
const readText = (root: ParentNode, selector: string) =>
  root.querySelector(selector)?.textContent?.trim() ?? "";
const normalizeCaptureText = (value: unknown) =>
  String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeLabelText = (value: unknown) =>
  normalizeCaptureText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const isCustomerLabel = (value: unknown) =>
  /^(senores|senor\(a\)|cliente)\s*:?/.test(normalizeLabelText(value));
const cleanCustomerName = (value: unknown) =>
  normalizeCaptureText(value)
    .replace(/^(Señores|Senores|Señor\(a\)|Senor\(a\)|Cliente)\s*:?\s*/i, "")
    .replace(/\b(Fecha|Domicilio|Direcci[oó]n|Email|R\.?\s*U\.?\s*C|DNI)\s*:.*$/i, "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "")
    .replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, "")
    .trim();
const readValueAfterCustomerLabel = (section: Element | null) => {
  const nodes = Array.from(
    section?.querySelectorAll("label,span,td,div,p") ?? [],
  );
  for (let index = 0; index < nodes.length; index += 1) {
    if (!isCustomerLabel(nodes[index].textContent)) continue;
    for (let next = index + 1; next < Math.min(nodes.length, index + 5); next += 1) {
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
    .filter(Boolean);

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
const money = (value: number) =>
  Number(value || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
  const raw =
    typeof result === "string"
      ? result
      : safeTrim(
          (result as any)?.resultado ??
            (result as any)?.Resultado ??
            (result as any)?.data ??
            "",
        );
  const [idRaw = "", numberRaw = ""] = raw.split("¬");
  return {
    noteId: Number(idRaw.match(/\d+/)?.[0] ?? 0),
    number: (numberRaw.match(/\d+/)?.[0] ?? numberRaw).padStart(8, "0"),
    raw,
  };
};
const parseCapture = (html: string): CaptureData => {
  const document = new DOMParser().parseFromString(html, "text/html");
  const table = document.querySelector("table");
  const ruc = `${readText(document, "#section-1 .medium-font.center-align")} ${readText(document, "#section-4")}`.trim();
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
const pickValue = (source: unknown, ...keys: string[]) => {
  const record = (source ?? {}) as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && safeTrim(value)) return value;
  }
  return "";
};
const parseApiNumber = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatListDate = (value: unknown) => {
  const raw = safeTrim(value);
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("es-PE");
};
const parseSaleListResponse = (payload: unknown): SaleListItem[] => {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as any)?.items)
      ? (payload as any).items
      : [];

  return items
    .map((item): SaleListItem | null => {
      const noteId = Number(pickValue(item, "notaId", "NotaId"));
      if (!Number.isFinite(noteId) || noteId <= 0) return null;
      const serie = safeTrim(pickValue(item, "notaSerie", "NotaSerie"));
      const numero = safeTrim(pickValue(item, "notaNumero", "NotaNumero"));
      const doc = safeTrim(pickValue(item, "notaDocu", "NotaDocu"));
      return {
        noteId,
        document: [doc, [serie, numero].filter(Boolean).join("-")]
          .filter(Boolean)
          .join(" "),
        date: formatListDate(pickValue(item, "notaFecha", "NotaFecha")),
        customer:
          safeTrim(pickValue(item, "miembro", "Miembro")) ||
          `Cliente #${safeTrim(pickValue(item, "clienteId", "ClienteId")) || "-"}`,
        paymentMethod:
          safeTrim(pickValue(item, "notaFormaPago", "NotaFormaPago")) || "-",
        pvs: parseApiNumber(pickValue(item, "pv", "PV")),
        total: parseApiNumber(pickValue(item, "notaTotal", "NotaTotal")),
        state:
          safeTrim(pickValue(item, "estadoOBS", "EstadoOBS", "notaEstado", "NotaEstado")) ||
          "-",
      };
    })
    .filter((item): item is SaleListItem => Boolean(item));
};
const readSession = () => {
  if (typeof window === "undefined") {
    return {
      companyId: 1,
      username: "USUARIO",
      companyName: "",
      companyRuc: "",
      companyAddress: "",
      companyDistrict: "",
    };
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(localStorage.getItem("sgo.auth.session") ?? "null");
  } catch {
    parsed = null;
  }

  return {
    companyId:
      Number(
        parsed?.user?.companyId ?? localStorage.getItem("companiaId") ?? 1,
      ) || 1,
    username:
      safeTrim(parsed?.user?.displayName) ||
      safeTrim(parsed?.user?.username) ||
      "USUARIO",
    companyName:
      safeTrim(parsed?.user?.companyCommercialName) ||
      safeTrim(parsed?.user?.companyName),
    companyRuc: safeTrim(parsed?.user?.companyRuc),
    companyAddress: safeTrim(parsed?.user?.companySunatAddress),
    companyDistrict: safeTrim(parsed?.user?.companyUbigeoName),
  };
};

export default function HtmlCaptureSalePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const isNewRoute = location.pathname.replace(/\/+$/, "").endsWith("/sales/html_capture/new");
  const routeNoteId = Number(id ?? 0);
  const isExistingRoute = !isNewRoute && Number.isFinite(routeNoteId) && routeNoteId > 0;
  const routeKey = isExistingRoute ? `id:${routeNoteId}` : "new";
  const isReadOnly = isExistingRoute;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const manualProductInputRef = useRef<HTMLInputElement | null>(null);
  const externalCaptureKeyRef = useRef("");
  const appliedCaptureKeyRef = useRef("");
  const loadedRouteKeyRef = useRef("");
  const { products, fetchProducts, loading } = useProductsStore();
  const {
    clients,
    fetchClients,
    fetchClientByCodigo,
    addClient,
    fetchClientMonthlyPvs,
  } = useClientsStore();
  const [capture, setCapture] = useState<CaptureData | null>(null);
  const [pendingExternalCapture, setPendingExternalCapture] =
    useState<CaptureData | null>(null);
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [manualProductSearch, setManualProductSearch] = useState("");
  const [manualProductSearchFocused, setManualProductSearchFocused] =
    useState(false);
  const [manualQuantity, setManualQuantity] = useState(1);
  const [monthlyPvs, setMonthlyPvs] = useState(0);
  const [correlative, setCorrelative] = useState<Correlative>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastTicket, setLastTicket] = useState<LastTicket>(null);
  const [activeTab, setActiveTab] = useState<"sale" | "ticket" | "list">(
    isExistingRoute ? "ticket" : "sale",
  );
  const [listRows, setListRows] = useState<SaleListItem[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const [listFrom, setListFrom] = useState(localDate());
  const [listTo, setListTo] = useState(localDate());
  const session = useMemo(readSession, []);
  const openDialog = useDialogStore((state) => state.openDialog);
  const closeDialog = useDialogStore((state) => state.closeDialog);
  const formMethods = useForm<SaleForm>({ defaultValues: defaultForm });
  const form = formMethods.watch();
  const isCapturedSale = Boolean(capture);

  const resetDraft = useCallback(() => {
    externalCaptureKeyRef.current = "";
    appliedCaptureKeyRef.current = "";
    setCapture(null);
    setPendingExternalCapture(null);
    setRows([]);
    setManualProductSearch("");
    if (manualProductInputRef.current) manualProductInputRef.current.value = "";
    setManualQuantity(1);
    setMonthlyPvs(0);
    setLastTicket(null);
    setActiveTab("sale");
    formMethods.reset(defaultForm);
  }, [formMethods]);

  const openNewRecord = useCallback(() => {
    resetDraft();
    navigate("/sales/html_capture/new", { replace: true });
  }, [navigate, resetDraft]);

  useEffect(() => {
    if (loadedRouteKeyRef.current === routeKey) return;
    loadedRouteKeyRef.current = routeKey;

    if (!isExistingRoute) {
      resetDraft();
      return;
    }

    try {
      const stored = localStorage.getItem(ticketStorageKey(routeNoteId));
      if (!stored) {
        setActiveTab("ticket");
        return;
      }

      const ticket = JSON.parse(stored) as StoredTicket;
      formMethods.reset({ ...defaultForm, ...ticket.form });
      setCapture(ticket.capture);
      setRows(ticket.rows);
      setMonthlyPvs(ticket.monthlyPvs ?? 0);
      setLastTicket({
        documentNumber: ticket.documentNumber,
        noteId: ticket.noteId,
      });
      setActiveTab("ticket");
    } catch {
      toast.error("No se pudo cargar el ticket guardado.");
    }
  }, [formMethods, isExistingRoute, resetDraft, routeKey, routeNoteId]);

  useEffect(() => {
    if (!products.length) void fetchProducts("");
  }, [fetchProducts, products.length]);

  useEffect(() => {
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
  }, [form.docTypeCode, session.companyId]);

  const fetchListRows = useCallback(async () => {
    if (listFrom && listTo && listFrom > listTo) {
      toast.error("La fecha inicio no puede ser mayor que la fecha fin.");
      return;
    }

    const query = new URLSearchParams({
      page: "1",
      pageSize: "50",
    });
    if (listFrom) query.set("fechaInicio", listFrom);
    if (listTo) query.set("fechaFin", listTo);

    setIsListLoading(true);
    try {
      const response = await apiRequest<unknown>({
        url: buildApiUrl(`/Nota/crud?${query.toString()}`),
        method: "GET",
        fallback: [],
      });
      setListRows(parseSaleListResponse(response));
    } catch (error) {
      console.error("No se pudo cargar el listado de ventas", error);
      toast.error("No se pudo cargar el listado.");
    } finally {
      setIsListLoading(false);
    }
  }, [listFrom, listTo]);

  useEffect(() => {
    if (activeTab === "list") void fetchListRows();
  }, [activeTab, fetchListRows]);

  useEffect(() => {
    if (!clients.length) {
      void fetchClients({ estado: "", page: 1, pageSize: 100 });
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
    return products
      .filter((product) => product.estado !== "INACTIVO")
      .filter((product) => {
        if (!query) return true;
        return (
          normalizeLabelText(product.codigo).includes(query) ||
          normalizeLabelText(product.nombre).includes(query)
        );
      })
      .slice(0, 20);
  }, [manualProductSearch, products]);

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
  const selectedClient = useMemo(
    () =>
      clientOptions.find(
        (opt) =>
          opt.label === safeTrim(form.customerName) ||
          (safeTrim(form.memberCode) && opt.code === safeTrim(form.memberCode)) ||
          (safeTrim(form.customerDoc) && opt.doc === safeTrim(form.customerDoc)),
      )?.client ?? null,
    [clientOptions, form.customerDoc, form.customerName, form.memberCode],
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
    (client: Client | null) => {
      if (!client) return;
      formMethods.setValue("customerName", client.nombreRazon ?? "", {
        shouldDirty: true,
      });
      formMethods.setValue("customerEmail", client.email ?? "", {
        shouldDirty: true,
      });
      formMethods.setValue("customerDoc", client.ruc || client.dni || "", {
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
      formMethods.setValue("docTypeCode", client.ruc ? "01" : form.docTypeCode, {
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

      await fetchClients({ estado: "", page: 1, pageSize: 100 });
      const refreshedClients = useClientsStore.getState().clients;
      const normalizedName = safeTrim(payload.nombreRazon).toLowerCase();
      const normalizedRuc = safeTrim(payload.ruc);
      const normalizedDni = safeTrim(payload.dni);
      const normalizedCode = safeTrim(payload.clienteCodigo);

      const created =
        result.client ??
        refreshedClients.find((client) => {
          const clientName = safeTrim(client.nombreRazon).toLowerCase();
          return (
            (normalizedRuc && safeTrim(client.ruc) === normalizedRuc) ||
            (normalizedDni && safeTrim(client.dni) === normalizedDni) ||
            (normalizedCode && getClientCode(client) === normalizedCode) ||
            (!!normalizedName && clientName === normalizedName)
          );
        }) ??
        null;

      if (created) applyClient(created);
      setMonthlyPvs(0);
      toast.success("Cliente creado correctamente.");
      closeDialog();
      return true;
    },
    [addClient, applyClient, closeDialog, fetchClients, session.username],
  );

  const handleAddManualProduct = async () => {
    if (isReadOnly) {
      toast.error("Este registro solo se puede visualizar.");
      return;
    }
    if (isCapturedSale) {
      toast.error("Los productos capturados no se pueden editar.");
      return;
    }
    const query = safeTrim(manualProductInputRef.current?.value);
    const quantity = Number(manualQuantity);
    if (!query) {
      toast.error("Seleccione un producto.");
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("La cantidad debe ser mayor a 0.");
      return;
    }

    let source = products;
    if (!source.length) {
      await fetchProducts("");
      source = useProductsStore.getState().products;
    }

    const queryCode = normalizeCode(query.split(" - ")[0]);
    const queryText = normalizeLabelText(query);
    const product =
      productByCode.get(queryCode) ??
      source.find(
        (item) => {
          const code = normalizeCode(item.codigo);
          const name = normalizeLabelText(item.nombre);
          return (
            code === normalizeCode(query) ||
            code.includes(queryCode) ||
            name.includes(queryText)
          );
        },
      ) ??
      null;

    if (!product) {
      toast.error("Producto no encontrado.");
      return;
    }

    setRows((current) => {
      const existing = current.findIndex((row) => row.code === product.codigo);
      if (existing < 0) return [...current, productToRow(product, quantity)];
      return current.map((row, index) =>
        index === existing
          ? { ...row, quantity: row.quantity + quantity }
          : row,
      );
    });
    setManualProductSearch("");
    if (manualProductInputRef.current) manualProductInputRef.current.value = "";
    setManualQuantity(1);
    setLastTicket(null);
    setActiveTab("sale");
  };

  const handleRemoveRow = (code: string) => {
    if (isReadOnly || isCapturedSale) return;
    setRows((current) => current.filter((row) => row.code !== code));
    setLastTicket(null);
  };

  const handleOpenCreateClientModal = useCallback(() => {
    if (isReadOnly) {
      toast.error("Este registro solo se puede visualizar.");
      return;
    }
    openDialog({
      title: "Clientes",
      maxWidth: "lg",
      fullWidth: true,
      cancelText: "Cerrar",
      content: (
        <CustomerDialogContent
          initialData={{
            clienteCodigo: safeTrim(form.memberCode),
            nombreRazon: safeTrim(form.customerName),
            email: safeTrim(form.customerEmail),
            dni:
              form.docTypeCode === "03" && safeTrim(form.customerDoc).length === 8
                ? safeTrim(form.customerDoc)
                : "",
            ruc: form.docTypeCode === "01" ? safeTrim(form.customerDoc) : "",
            direccionFiscal: safeTrim(form.address),
            direccionDespacho: safeTrim(form.address),
          }}
          initialQuery={
            safeTrim(form.customerName).toUpperCase() === "VARIOS"
              ? ""
              : safeTrim(form.customerName || form.customerDoc || form.memberCode)
          }
          onSelectClient={handleSelectClientFromDialog}
          onCreateClient={handleCreateClientFromDialog}
        />
      ),
    });
  }, [
    form.address,
    form.customerDoc,
    form.customerName,
    form.customerEmail,
    form.docTypeCode,
    form.memberCode,
    handleCreateClientFromDialog,
    handleSelectClientFromDialog,
    isReadOnly,
    openDialog,
  ]);

  useEffect(() => {
    const code = safeTrim(form.memberCode);
    if (!code || selectedClient) return;
    const match = clientOptions.find((opt) => opt.code === code)?.client ?? null;
    if (match) applyClient(match);
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
        toast.error("Este registro solo se puede visualizar.");
        return;
      }
      const captureKey = JSON.stringify(data);
      if (appliedCaptureKeyRef.current === captureKey) return;
      appliedCaptureKeyRef.current = captureKey;

      const docMatches =
        data.ruc
          .replace(/FACTURA|BOLETA|RUC|DNI|DOCUMENTO|:/gi, " ")
          .match(/\d{8,11}/g) ?? [];
      const docValue = docMatches.at(-1) ?? "";
      const nextRows = buildRows(data);
      setCapture(data);
      setRows(nextRows);
      const docTypeText = data.ruc.toUpperCase();
      const nextDocTypeCode = docTypeText.includes("FACTURA")
        ? "01"
        : docTypeText.includes("BOLETA")
          ? "03"
          : docValue.length === 11
            ? "01"
            : "03";
      const customerDocValue =
        nextDocTypeCode === "01" || docValue.length === 8 ? docValue : "";
      const localClient =
        clientOptions.find(
          (opt) => opt.code && opt.code === safeTrim(data.memberCode),
        )?.client ?? null;
      const matchedClient =
        localClient ??
        (data.memberCode
          ? await fetchClientByCodigo(safeTrim(data.memberCode)).catch(() => null)
          : null);
      formMethods.setValue("docTypeCode", nextDocTypeCode, {
        shouldDirty: true,
      });
      if (matchedClient) {
        applyClient(matchedClient);
        if (data.customerEmail) {
          formMethods.setValue("customerEmail", data.customerEmail, {
            shouldDirty: true,
          });
        }
      } else {
        formMethods.setValue(
          "customerName",
          data.customerName || formMethods.getValues("customerName"),
          { shouldDirty: true },
        );
        formMethods.setValue(
          "customerDoc",
          customerDocValue || formMethods.getValues("customerDoc"),
          { shouldDirty: true },
        );
        formMethods.setValue(
          "customerEmail",
          data.customerEmail || formMethods.getValues("customerEmail"),
          { shouldDirty: true },
        );
      }
      formMethods.setValue(
        "memberCode",
        data.memberCode || formMethods.getValues("memberCode"),
        { shouldDirty: true },
      );
      formMethods.setValue(
        "transactionNumber",
        data.transactionNumber || formMethods.getValues("transactionNumber"),
        { shouldDirty: true },
      );
      setLastTicket(null);
      setActiveTab("sale");
      toast.success(`Capturados ${nextRows.length} productos.`);
    },
    [
      applyClient,
      buildRows,
      clientOptions,
      fetchClientByCodigo,
      formMethods,
      isReadOnly,
    ],
  );

  const totals = useMemo(() => {
    const subtotal = rows.reduce(
      (sum, row) => sum + row.quantity * row.price,
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
      pv: rows.reduce((sum, row) => sum + row.pv * row.quantity, 0),
      sv: rows.reduce((sum, row) => sum + row.sv * row.quantity, 0),
    };
  }, [capture?.discount, rows]);

  const cartItems = useMemo<PosCartItem[]>(
    () =>
      rows.map((row) => ({
        productId: row.product.id,
        codigo: row.code,
        nombre: row.description,
        unidadMedida: row.product.unidadMedida || "UNIDAD",
        precio: row.price,
        precioMinimo: row.price,
        cantidad: row.quantity,
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

  const validate = () => {
    if (!rows.length) return "Agrega productos o captura un HTML antes de vender.";
    const missing = rows.filter((row) => !row.matched);
    if (missing.length) {
      return `Productos no encontrados: ${missing
        .slice(0, 5)
        .map((row) => row.code)
        .join(", ")}`;
    }
    if (form.docTypeCode === "01" && safeTrim(form.customerDoc).length !== 11) {
      return "Factura requiere RUC de 11 digitos.";
    }
    if (form.paymentMethod === "(SELECCIONE)") {
      return "Seleccione forma de pago.";
    }
    if (
      !["EFECTIVO", "-"].includes(form.paymentMethod) &&
      !safeTrim(form.operationNumber)
    ) {
      return "Ingresa el numero de operacion.";
    }
    return "";
  };

  const renderTicketDocument = (
    documentNumber: string,
    noteId: number,
    preGeneratedQrBase64?: string,
  ) => (
    <TicketDocument
      clientName={form.customerName || "VARIOS"}
      clientId={
        form.docTypeCode === "03" && safeTrim(form.customerDoc).length !== 8
          ? ""
          : form.customerDoc
      }
      clientAddress={form.address}
      docType={DOC_CONFIG[form.docTypeCode].ticket}
      paymentMethod={form.paymentMethod}
      condition={form.condition}
      bankEntity={form.bankEntity}
      operationNumber={form.operationNumber}
      memberCode={form.memberCode}
      transactionNumber={form.transactionNumber}
      saleType="CASH BILL"
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
      form.docTypeCode === "03" && safeTrim(form.customerDoc).length !== 8
        ? ""
        : safeTrim(form.customerDoc);
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

  const downloadTicket = async (documentNumber: string, noteId: number) => {
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

  const printTicket = async () => {
    if (!lastTicket) return;
    const blob = await buildTicketBlob(lastTicket.documentNumber, lastTicket.noteId);
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      toast.error("No se pudo abrir la ventana de impresión.");
      URL.revokeObjectURL(url);
      return;
    }
    win.addEventListener("load", () => win.print(), { once: true });
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
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

    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    const doc = DOC_CONFIG[form.docTypeCode];
    const notaSerie = correlative?.serie || doc.serie;
    const notaNumero = correlative?.numero || "00000000";
    const total = Number(totals.total.toFixed(2));
    const efectivo = form.paymentMethod === "EFECTIVO" ? total : 0;
    const deposito = form.paymentMethod === "EFECTIVO" ? 0 : total;
    let saleClient = selectedClient;
    const hasCapturedClientData = Boolean(
        safeTrim(form.customerName) ||
        safeTrim(form.customerDoc) ||
        safeTrim(form.customerEmail) ||
        safeTrim(form.memberCode),
    );

    if (!saleClient && form.docTypeCode === "03" && hasCapturedClientData) {
      const customerDoc = safeTrim(form.customerDoc);
      const created = await addClient({
        clienteCodigo: safeTrim(form.memberCode),
        nombreRazon: safeTrim(form.customerName) || "VARIOS",
        ruc: "",
        dni: customerDoc.length === 8 ? customerDoc : "",
        direccionFiscal: safeTrim(form.address) || "-",
        direccionDespacho: safeTrim(form.address),
        telefonoMovil: "",
        email: safeTrim(form.customerEmail),
        registradoPor: session.username,
        estado: "ACTIVO",
        fecha: null,
      });

      if (!created.ok) {
        toast.error(created.error ?? "No se pudo crear el cliente.");
        return;
      }

      saleClient =
        created.client ??
        (safeTrim(form.memberCode)
          ? await fetchClientByCodigo(safeTrim(form.memberCode))
          : null);
    }

    if (!saleClient && form.docTypeCode === "01") {
      toast.error(
        "Para Factura debes registrar o seleccionar el cliente con + Cliente.",
      );
      return;
    }

    const clienteId = Number(saleClient?.id ?? 1) || 1;

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
            notaFormaPago: form.paymentMethod,
            notaCondicion: form.condition,
            notaFechaPago: new Date().toISOString(),
            notaDireccion: form.address || "-",
            notaSubtotal: total,
            notaMovilidad: 0,
            notaDescuento: Number(totals.discount.toFixed(2)),
            notaTotal: total,
            notaAcuenta: 0,
            notaSaldo: total,
            notaAdicional: 0,
            notaTarjeta: 0,
            notaPagar: total,
            notaEstado: "CANCELADO",
            companiaId: session.companyId,
            notaEntrega: form.delivery,
            notaConcepto: form.concept || "MERCADERIA",
            notaSerie,
            notaNumero,
            notaGanancia: 0,
            icbper: 0,
            entidadBancaria: form.bankEntity || "-",
            nroOperacion: form.operationNumber,
            efectivo,
            deposito,
            notaTransaccion: form.transactionNumber,
            miembro: form.customerName || "VARIOS",
            codigoCliente: form.memberCode,
            conceptoOBS: "VENTA",
            estadoOBS: "EMITIDO",
            pv: `${Number(totals.pv.toFixed(2))} PV`,
            image: "",
            codigoRes: "",
            responsable: "",
          },
          detalles: rows.map((row) => ({
            idProducto: row.product.id,
            detalleCantidad: row.quantity,
            detalleUm: row.product.unidadMedida || "UNIDAD",
            detalleDescripcion: row.description,
            detalleCosto: row.cost,
            detallePrecio: row.price,
            detallePV: Number((row.pv * row.quantity).toFixed(2)),
            detalleSV: Number((row.sv * row.quantity).toFixed(2)),
            detalleImporte: Number((row.price * row.quantity).toFixed(2)),
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

      setLastTicket({ documentNumber, noteId: parsed.noteId });
      localStorage.setItem(
        ticketStorageKey(parsed.noteId),
        JSON.stringify({
          capture,
          documentNumber,
          form: formMethods.getValues(),
          monthlyPvs,
          noteId: parsed.noteId,
          rows,
        } satisfies StoredTicket),
      );
      setActiveTab("ticket");
      navigate(`/sales/html_capture/${parsed.noteId}`, { replace: true });
      await downloadTicket(documentNumber, parsed.noteId);
      toast.success(`${doc.docu} registrada: ${documentNumber}`);
    } catch (err) {
      console.error("No se pudo registrar venta HTML", err);
      toast.error("No se pudo registrar la venta.");
    } finally {
      setIsSaving(false);
    }
  };

  const TicketPreview = (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2">
        <h2 className="mr-auto text-sm font-semibold text-slate-700">
          Ticket {lastTicket ? lastTicket.documentNumber : ""}
        </h2>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={printTicket}
          disabled={!lastTicket}
        >
          <Printer className="h-4 w-4" />
          Imprimir ticket
        </button>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() =>
            lastTicket && downloadTicket(lastTicket.documentNumber, lastTicket.noteId)
          }
          disabled={!lastTicket}
        >
          <FileDown className="h-4 w-4" />
          Descargar
        </button>
      </div>
      {lastTicket ? (
        <div className="h-[72vh] min-h-[420px] bg-slate-100 sm:h-[680px]">
          <PDFViewer
            key={`${lastTicket.noteId}-${lastTicket.documentNumber}`}
            style={{ width: "100%", height: "100%" }}
            showToolbar={false}
          >
            {renderTicketDocument(lastTicket.documentNumber, lastTicket.noteId)}
          </PDFViewer>
        </div>
      ) : (
        <div className="px-5 py-16 text-center text-sm text-slate-400">
          Registra la venta para habilitar el ticket.
        </div>
      )}
    </section>
  );

  const ListPanel = (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2">
        <div className="mr-auto">
          <h2 className="text-sm font-semibold text-slate-700">
            Listado de ventas
          </h2>
          <p className="text-xs text-slate-400">
            {listRows.length} registros encontrados.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-3">
        <label className="grid gap-1 text-xs font-medium text-slate-500">
          Fecha inicio
          <input
            type="date"
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none transition-colors focus:border-slate-400"
            value={listFrom}
            onChange={(event) => setListFrom(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs font-medium text-slate-500">
          Fecha fin
          <input
            type="date"
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none transition-colors focus:border-slate-400"
            value={listTo}
            onChange={(event) => setListTo(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={fetchListRows}
          disabled={isListLoading}
        >
          <Search className={`h-4 w-4 ${isListLoading ? "animate-pulse" : ""}`} />
          Buscar
        </button>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => {
            const today = localDate();
            setListFrom(today);
            setListTo(today);
          }}
          disabled={isListLoading}
        >
          <RotateCcw className="h-4 w-4" />
          Hoy
        </button>
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              {[
                "Fecha",
                "Documento",
                "Cliente",
                "Forma pago",
                "PVS",
                "Total",
                "Estado",
                "",
              ].map((header, index) => (
                <th
                  key={header || "acciones"}
                  className={`border-b border-slate-100 px-4 py-2 font-medium ${
                    index >= 4 ? "text-right" : "text-left"
                  }`}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isListLoading ? (
              <tr>
                <td colSpan={8} className="px-5 py-14 text-center text-sm text-slate-400">
                  Cargando listado...
                </td>
              </tr>
            ) : listRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-14 text-center text-sm text-slate-400">
                  No hay ventas para mostrar.
                </td>
              </tr>
            ) : (
              listRows.map((row) => (
                <tr
                  key={row.noteId}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-4 py-2 text-slate-500">{row.date}</td>
                  <td className="px-4 py-2 font-medium text-slate-700">
                    {row.document || `Nota #${row.noteId}`}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{row.customer}</td>
                  <td className="px-4 py-2 text-slate-500">{row.paymentMethod}</td>
                  <td className="px-4 py-2 text-right font-medium text-slate-700">
                    {money(row.pvs)}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-800">
                    S/ {money(row.total)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-500">
                    {row.state}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      className="inline-flex h-8 items-center rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                      onClick={() => navigate(`/sales/html_capture/${row.noteId}`)}
                    >
                      Abrir
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-[1760px] space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm sm:w-fit">
          <button
            type="button"
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${
              activeTab === "sale"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
            onClick={() => setActiveTab("sale")}
          >
            Venta
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${
              activeTab === "ticket"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
            }`}
            onClick={() => setActiveTab("ticket")}
            disabled={!lastTicket && !isExistingRoute}
          >
            Ticket
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-4 py-2 text-sm font-semibold transition-colors sm:flex-none ${
              activeTab === "list"
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
            onClick={() => setActiveTab("list")}
          >
            Listado
          </button>
        </div>
        {isExistingRoute ? (
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            onClick={openNewRecord}
          >
            <Plus className="h-4 w-4" />
            Nuevo registro
          </button>
        ) : null}
      </div>
      {activeTab === "ticket" ? (
        TicketPreview
      ) : activeTab === "list" ? (
        ListPanel
      ) : (
        <>
      {/* Datos de la venta */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <HookForm methods={formMethods} onSubmit={() => undefined}>
          <div className="px-5 py-3">
            <SaleCaptureFormFields
              clientOptions={clientOptions}
              disabled={isSaving || isReadOnly}
              summary={{
                pvs: totals.pv,
                saleTotal: totals.total,
                monthTotal: monthlyPvs,
              }}
              correlative={correlative?.nroComprobante}
              onClientSelected={applyClient}
              onCreateClient={isReadOnly ? undefined : handleOpenCreateClientModal}
            />
          </div>
        </HookForm>
      </section>

      {/* Productos capturados */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2">
          <h2 className="mr-auto text-sm font-semibold text-slate-700">
            Productos de venta
            {rows.length > 0 && (
              <span className="ml-2 font-normal text-slate-400">
                ({rows.length})
              </span>
            )}
          </h2>

          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm,text/html"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || isSaving || isReadOnly}
          >
            <FileUp className="h-4 w-4" />
            Capturar datos
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={clearForm}
            disabled={isSaving || isReadOnly}
          >
            <RotateCcw className="h-4 w-4" />
            Limpiar
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
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
            {isSaving ? "Registrando..." : "Registrar y descargar ticket"}
          </button>
          {lastTicket ? (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              onClick={printTicket}
            >
              <Printer className="h-4 w-4" />
              Imprimir ticket
            </button>
          ) : null}
        </div>

        <div className="grid gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-3 md:grid-cols-[1fr_120px_auto]">
          <div className="relative">
            <input
              ref={manualProductInputRef}
              type="text"
              className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400"
              placeholder="Buscar producto por código o nombre"
              onChange={(event) => {
                setManualProductSearch(event.currentTarget.value);
                setManualProductSearchFocused(true);
              }}
              onFocus={() => setManualProductSearchFocused(true)}
              onBlur={() =>
                window.setTimeout(() => setManualProductSearchFocused(false), 120)
              }
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void handleAddManualProduct();
              }}
              disabled={loading || isSaving || isReadOnly || isCapturedSale}
            />
            {manualProductSearchFocused ? (
              <div className="absolute left-0 right-0 top-10 z-30 max-h-72 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
                {filteredManualProducts.length ? (
                  filteredManualProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-slate-50"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        const value = `${product.codigo} - ${product.nombre}`;
                        if (manualProductInputRef.current) {
                          manualProductInputRef.current.value = value;
                        }
                        setManualProductSearch(value);
                        setManualProductSearchFocused(false);
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
                        S/ {money(Number(product.preVenta ?? product.preVentaB ?? 0))}
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
          <input
            type="number"
            min="1"
            step="1"
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-slate-400"
            value={manualQuantity}
            onChange={(event) => setManualQuantity(Number(event.target.value))}
            disabled={loading || isSaving || isReadOnly || isCapturedSale}
          />
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleAddManualProduct}
            disabled={loading || isSaving || isReadOnly || isCapturedSale}
          >
            <Plus className="h-4 w-4" />
            Agregar
          </button>
        </div>

        <div className="max-h-[46vh] overflow-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {[
                  "Descripcion",
                  "Cantidad",
                  "Precio",
                  "PV Unit.",
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
                    colSpan={8}
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
                      {row.quantity}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {money(row.price)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500">
                      {money(row.pv)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-700">
                      {money(row.pv * row.quantity)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500">
                      {money(row.sv * row.quantity)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-800">
                      {money(row.price * row.quantity)}
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
        <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-sm">
          <Summary label="Sub total" value={totals.subtotal} />
          <Summary label="IGV" value={totals.igv} />
          <Summary label="PVS" value={totals.pv} />
          {totals.discount > 0 && (
            <Summary label="Descuento" value={totals.discount} negative />
          )}
          <div className="flex items-baseline gap-2 border-l border-slate-200 pl-6">
            <span className="text-sm font-semibold text-slate-700">Total</span>
            <span className="text-lg font-semibold text-slate-900">
              S/ {money(totals.total)}
            </span>
          </div>
        </div>
      </section>
        </>
      )}
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
