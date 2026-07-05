import DataTable from "@/components/DataTable";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import { createColumnHelper } from "@tanstack/react-table";
import { Workbook } from "exceljs";
import { FileSpreadsheet, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type SourceType = "GET" | "POST_LEGACY" | null;
type ActiveTab = "ventas" | "compras";

type SalesDocument = {
  fecha: string;
  documento: string;
  nroDoc: string;
  cliente: string;
  ruc: string;
  dni: string;
  subTotal: string;
  igv: string;
  icbper: string;
  total: string;
  usuario: string;
  estado: string;
  referencia: string;
  codigo: string;
  mensaje: string;
  condicion: string;
  formaPago: string;
  entidad: string;
  nroOperacion: string;
  efectivo: string;
  deposito: string;
};

type PurchaseDocument = {
  fecha: string;
  documento: string;
  nroDoc: string;
  proveedor: string;
  ruc: string;
  subTotal: string;
  igv: string;
  total: string;
  moneda: string;
  estado: string;
  referencia: string;
};

type DelimitedDataset = {
  headers: string[];
  widths: number[];
  rows: string[][];
};

type ColumnFilterMap<TRow extends Record<string, unknown>> = Partial<
  Record<keyof TRow, string>
>;

const salesColumnHelper = createColumnHelper<SalesDocument>();
const purchaseColumnHelper = createColumnHelper<PurchaseDocument>();

const normalizeText = (value: unknown, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;

const pickFirstText = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

const parseMoney = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = normalizeText(value, "").replaceAll(",", "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatInteger = (value: number) =>
  Math.trunc(value).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });

const pad2 = (value: number) => String(value).padStart(2, "0");

const toLocalIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const toLegacyDate = (isoDate: string) => {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const [, yyyy, mm, dd] = match;
  return `${mm}/${dd}/${yyyy}`;
};

const normalizeHeader = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

const buildHeaderIndex = (headers: string[]) => {
  const index: Record<string, number> = {};

  headers.forEach((header, columnIndex) => {
    const normalized = normalizeHeader(header);
    if (normalized && index[normalized] === undefined) {
      index[normalized] = columnIndex;
    }
  });

  return index;
};

const readField = (
  parts: string[],
  headerIndex: Record<string, number>,
  aliases: string[],
  fallbackIndex: number,
) => {
  for (const alias of aliases) {
    const normalized = normalizeHeader(alias);
    const idx = headerIndex[normalized];
    if (idx !== undefined) {
      return normalizeText(parts[idx], "");
    }
  }

  return normalizeText(parts[fallbackIndex], "");
};

const extractPlainText = (payload: unknown): string => {
  if (typeof payload === "string") return payload.trim();

  const record = asRecord(payload);
  if (!record) return "";

  const directCandidates = [
    record.data,
    record.Data,
    record.resultado,
    record.Resultado,
    record.value,
    record.Value,
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  const nestedResponse = asRecord(record.response);
  if (nestedResponse && typeof nestedResponse.data === "string") {
    return nestedResponse.data.trim();
  }

  const firstString = Object.values(record).find(
    (value) => typeof value === "string" && String(value).trim() !== "",
  );

  return typeof firstString === "string" ? firstString.trim() : "";
};

const parseDelimitedDataset = (rawValue: string): DelimitedDataset | null => {
  const normalizedRaw = normalizeText(rawValue, "")
    .replaceAll("Â¬", "¬")
    .replace(/\uFFFD/g, "")
    .trim();

  if (!normalizedRaw) return null;

  const chunks = normalizedRaw
    .split("¬")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  if (!chunks.length || !chunks[0].includes("|")) return null;

  const headers = chunks[0].split("|").map((header) => header.trim());
  const widths = (chunks[1] ?? "")
    .split("|")
    .map((chunk) => Number.parseInt(chunk, 10))
    .map((value) => (Number.isFinite(value) ? value : 0));

  const rows = chunks.slice(2).map((chunk) => chunk.split("|"));

  return {
    headers,
    widths,
    rows,
  };
};

const resolveSalesStatus = (documento: string, estado: string) => {
  const docNormalized = normalizeFilterText(documento);
  const statusNormalized = normalizeFilterText(estado);
  const isFacturaOrBoleta =
    docNormalized.includes("factura") ||
    docNormalized.includes("boleta") ||
    docNormalized === "01" ||
    docNormalized === "03";
  const isCancelledOrDropped =
    statusNormalized.includes("anul") || statusNormalized.includes("baja");

  if (isFacturaOrBoleta && isCancelledOrDropped) {
    return "EMITIDO";
  }

  return estado;
};

const mapSalesRow = (
  rowParts: string[],
  headerIndex: Record<string, number>,
): SalesDocument => ({
  fecha: readField(rowParts, headerIndex, ["Fecha"], 0),
  documento: readField(rowParts, headerIndex, ["Documento"], 1),
  nroDoc: readField(rowParts, headerIndex, ["NroDoc", "NroDocumento"], 2),
  cliente: readField(rowParts, headerIndex, ["Cliente", "RazonSocial"], 3),
  ruc: readField(rowParts, headerIndex, ["RUC"], 4),
  dni: readField(rowParts, headerIndex, ["DNI"], 5),
  subTotal: readField(rowParts, headerIndex, ["SubTotal"], 6),
  igv: readField(rowParts, headerIndex, ["IGV"], 7),
  icbper: readField(rowParts, headerIndex, ["ICBPER"], 8),
  total: readField(rowParts, headerIndex, ["Total"], 9),
  usuario: readField(rowParts, headerIndex, ["Usuario"], 10),
  estado: resolveSalesStatus(
    readField(rowParts, headerIndex, ["Documento"], 1),
    readField(rowParts, headerIndex, ["Estado"], 11),
  ),
  referencia: readField(rowParts, headerIndex, ["Referencia"], 12),
  codigo: readField(rowParts, headerIndex, ["Codigo", "CDSunat"], 13),
  mensaje: readField(rowParts, headerIndex, ["Mensaje"], 14),
  condicion: readField(rowParts, headerIndex, ["Condicion"], 15),
  formaPago: readField(rowParts, headerIndex, ["FormaPago"], 16),
  entidad: readField(rowParts, headerIndex, ["Entidad", "EntidadBancaria"], 17),
  nroOperacion: readField(rowParts, headerIndex, ["NroOperacion"], 18),
  efectivo: readField(rowParts, headerIndex, ["Efectivo"], 19),
  deposito: readField(rowParts, headerIndex, ["Deposito"], 20),
});

const parseIsoDate = (rawValue: string) => {
  const raw = normalizeText(rawValue, "");
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

const isInRange = (value: string, startIso: string, endIso: string) => {
  const iso = parseIsoDate(value);
  if (!iso) return true;
  return iso >= startIso && iso <= endIso;
};

const roundLegacyNumber = (value: number) => {
  const absolute = Math.abs(value);
  const decimal = absolute % 1;
  const rounded = decimal < 0.45 ? Math.round(absolute) : Math.ceil(absolute);
  return value < 0 ? -rounded : rounded;
};

const resolvePurchaseDocumentName = (rawCode: string) => {
  const normalized = normalizeText(rawCode, "").toUpperCase();
  if (normalized === "01") return "FACTURA";
  if (normalized === "03") return "BOLETA";
  if (normalized === "07") return "NOTA CREDITO";
  if (normalized === "08") return "NOTA DEBITO";
  if (normalized === "101" || normalized === "00") return "NOTA VENTA";
  return normalized || "COMPRA";
};

const toFormattedMoneyText = (value: unknown) => formatMoney(parseMoney(value));

const toExcelSafeNumber = (value: string) =>
  Number(parseMoney(value).toFixed(2));

const EXCEL_HEADER_BG = "FFB23636";
const EXCEL_HEADER_TEXT = "FFFFFFFF";
const EXCEL_NEGATIVE_TEXT = "FFFF0000";
const EXCEL_AMOUNT_NUMFMT = "#,##0.00";

const normalizeDocumentReferenceToken = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const isCreditNoteDocument = (value: unknown) => {
  const normalized = normalizeFilterText(value);
  if (!normalized) return false;
  if (normalized === "07") return true;
  return normalized.includes("nota") && normalized.includes("credito");
};

const isCreditNoteFilter = (value: unknown) => {
  const normalized = normalizeFilterText(value);
  if (!normalized) return false;
  if (normalized === "07") return true;
  return normalized.includes("nota") && normalized.includes("credito");
};

const isInvoiceOrBoletaDocument = (value: unknown) => {
  const normalized = normalizeFilterText(value);
  if (!normalized) return false;
  if (normalized === "01" || normalized === "03") return true;
  return normalized.includes("factura") || normalized.includes("boleta");
};

const isCancelledSalesStatus = (value: unknown) => {
  const normalized = normalizeFilterText(value);
  if (!normalized) return false;
  return normalized.includes("anul") || normalized.includes("baja");
};

const toCreditNoteExcelNumber = (value: string) =>
  -Math.abs(toExcelSafeNumber(value));

const resolveSalesRowsForExcel = (
  filteredRows: SalesDocument[],
  allRows: SalesDocument[],
  documentoFilter: unknown,
) => {
  const onlyCreditNotesSelected =
    isCreditNoteFilter(documentoFilter) ||
    (filteredRows.length > 0 &&
      filteredRows.every((row) => isCreditNoteDocument(row.documento)));

  if (onlyCreditNotesSelected) {
    return filteredRows;
  }

  const shouldExpandPairs = filteredRows.some(
    (row) =>
      isCreditNoteDocument(row.documento) ||
      (isInvoiceOrBoletaDocument(row.documento) &&
        isCancelledSalesStatus(row.estado)),
  );

  if (!shouldExpandPairs) {
    return filteredRows;
  }

  const relatedDocumentMap = new Map<string, SalesDocument>();
  const creditNotesRows = allRows.filter((row) =>
    isCreditNoteDocument(row.documento),
  );

  allRows.forEach((row) => {
    if (isCreditNoteDocument(row.documento)) return;
    const token = normalizeDocumentReferenceToken(row.nroDoc);
    if (token && !relatedDocumentMap.has(token)) {
      relatedDocumentMap.set(token, row);
    }
  });

  const exportRows: SalesDocument[] = [];
  const seenRows = new Set<SalesDocument>();

  const pushUniqueRow = (row?: SalesDocument) => {
    if (!row || seenRows.has(row)) return;
    exportRows.push(row);
    seenRows.add(row);
  };

  const findRelatedDocumentForCreditNote = (row: SalesDocument) => {
    const referenceToken = normalizeDocumentReferenceToken(row.referencia);
    if (!referenceToken) return undefined;

    return (
      relatedDocumentMap.get(referenceToken) ??
      allRows.find((candidate) => {
        if (isCreditNoteDocument(candidate.documento)) return false;
        const candidateToken = normalizeDocumentReferenceToken(
          candidate.nroDoc,
        );
        if (!candidateToken) return false;
        return (
          referenceToken.includes(candidateToken) ||
          candidateToken.includes(referenceToken)
        );
      })
    );
  };

  const findRelatedCreditNotesForDocument = (row: SalesDocument) => {
    const documentToken = normalizeDocumentReferenceToken(row.nroDoc);
    if (!documentToken) return [] as SalesDocument[];

    return creditNotesRows.filter((creditRow) => {
      const referenceToken = normalizeDocumentReferenceToken(
        creditRow.referencia,
      );
      if (!referenceToken) return false;
      return (
        referenceToken.includes(documentToken) ||
        documentToken.includes(referenceToken)
      );
    });
  };

  filteredRows.forEach((row) => {
    if (isCreditNoteDocument(row.documento)) {
      pushUniqueRow(findRelatedDocumentForCreditNote(row));
      pushUniqueRow(row);
      return;
    }

    pushUniqueRow(row);

    if (
      isInvoiceOrBoletaDocument(row.documento) &&
      isCancelledSalesStatus(row.estado)
    ) {
      const relatedCreditNotes = findRelatedCreditNotesForDocument(row);
      relatedCreditNotes.forEach((creditRow) => pushUniqueRow(creditRow));
    }
  });

  return exportRows;
};

const sanitizeFilenameToken = (value: string) =>
  normalizeFilterText(value)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const toMonthYearLabel = (isoDate: string) => {
  const parsed = new Date(`${isoDate}T00:00:00`);
  const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  const monthRaw = new Intl.DateTimeFormat("es-PE", { month: "long" }).format(
    safeDate,
  );
  const month = sanitizeFilenameToken(monthRaw);
  return `${month}-${safeDate.getFullYear()}`;
};

const resolveDocumentoPluralToken = (rawValue: string) => {
  const normalized = normalizeFilterText(rawValue);
  if (!normalized) return "";
  if (normalized.includes("boleta")) return "boletas";
  if (normalized.includes("factura")) return "facturas";

  const token = sanitizeFilenameToken(normalized);
  if (!token) return "";
  if (token.endsWith("s")) return token;
  return `${token}s`;
};

const normalizeFilterText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();

const applyColumnFilters = <TRow extends Record<string, unknown>>(
  rows: TRow[],
  filters: ColumnFilterMap<TRow>,
) => {
  const activeFilters = (
    Object.entries(filters) as Array<[keyof TRow, string | undefined]>
  )
    .map(([key, value]) => [key, normalizeFilterText(value)] as const)
    .filter(([, value]) => value.length > 0);

  if (activeFilters.length === 0) return rows;

  return rows.filter((row) =>
    activeFilters.every(([key, value]) =>
      normalizeFilterText(row[key]).includes(value),
    ),
  );
};

const salesFilterFields: Array<{ key: keyof SalesDocument; label: string }> = [
  { key: "fecha", label: "Fecha" },
  { key: "documento", label: "Documento" },
  { key: "nroDoc", label: "NroDoc" },
  { key: "cliente", label: "Cliente" },
  { key: "ruc", label: "RUC" },
  { key: "dni", label: "DNI" },
  { key: "subTotal", label: "SubTotal" },
  { key: "igv", label: "IGV" },
  { key: "total", label: "Total" },
  { key: "usuario", label: "Usuario" },
  { key: "estado", label: "Estado" },
  { key: "referencia", label: "Referencia" },
];

const purchaseFilterFields: Array<{
  key: keyof PurchaseDocument;
  label: string;
}> = [
  { key: "fecha", label: "Fecha" },
  { key: "documento", label: "Documento" },
  { key: "nroDoc", label: "NroDoc" },
  { key: "proveedor", label: "Proveedor" },
  { key: "ruc", label: "RUC" },
  { key: "subTotal", label: "SubTotal" },
  { key: "igv", label: "IGV" },
  { key: "total", label: "Total" },
  { key: "moneda", label: "Moneda" },
  { key: "estado", label: "Estado" },
  { key: "referencia", label: "Referencia" },
];

export default function PdtCompanyPage() {
  const currentMonthRangeIso = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    return {
      firstDay: toLocalIsoDate(firstDay),
      lastDay: toLocalIsoDate(lastDay),
    };
  }, []);

  const [activeTab, setActiveTab] = useState<ActiveTab>("ventas");
  const [fechaInicio, setFechaInicio] = useState(currentMonthRangeIso.firstDay);
  const [fechaFin, setFechaFin] = useState(currentMonthRangeIso.lastDay);

  const [salesRows, setSalesRows] = useState<SalesDocument[]>([]);
  const [purchaseRows, setPurchaseRows] = useState<PurchaseDocument[]>([]);
  const [salesFilters, setSalesFilters] = useState<
    ColumnFilterMap<SalesDocument>
  >({});
  const [purchaseFilters, setPurchaseFilters] = useState<
    ColumnFilterMap<PurchaseDocument>
  >({});

  const [loading, setLoading] = useState(false);
  const [salesSource, setSalesSource] = useState<SourceType>(null);
  const [purchaseSource, setPurchaseSource] =
    useState<string>("Sin fuente activa");
  const [purchaseUnavailable, setPurchaseUnavailable] = useState(false);

  const setSalesFilterValue = useCallback(
    (key: keyof SalesDocument, value: string) => {
      setSalesFilters((prev) => {
        const next = { ...prev };
        if (value.trim()) next[key] = value;
        else delete next[key];
        return next;
      });
    },
    [],
  );

  const setPurchaseFilterValue = useCallback(
    (key: keyof PurchaseDocument, value: string) => {
      setPurchaseFilters((prev) => {
        const next = { ...prev };
        if (value.trim()) next[key] = value;
        else delete next[key];
        return next;
      });
    },
    [],
  );

  const clearSalesFilters = useCallback(() => {
    setSalesFilters({});
  }, []);

  const clearPurchaseFilters = useCallback(() => {
    setPurchaseFilters({});
  }, []);

  const salesFilterLabels = useMemo(
    () =>
      Object.fromEntries(
        salesFilterFields.map((field) => [String(field.key), field.label]),
      ) as Record<string, string>,
    [],
  );

  const purchaseFilterLabels = useMemo(
    () =>
      Object.fromEntries(
        purchaseFilterFields.map((field) => [String(field.key), field.label]),
      ) as Record<string, string>,
    [],
  );

  const renderSalesHeaderFilterCell = useCallback(
    (columnId: string) => {
      if (!salesFilterLabels[columnId]) return null;
      const key = columnId as keyof SalesDocument;
      return (
        <input
          type="text"
          data-no-uppercase="true"
          value={salesFilters[key] ?? ""}
          onChange={(event) => setSalesFilterValue(key, event.target.value)}
          placeholder={salesFilterLabels[columnId]}
          className="h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-[#B23636] focus:ring-2 focus:ring-[#B23636]/20"
        />
      );
    },
    [salesFilterLabels, salesFilters, setSalesFilterValue],
  );

  const renderPurchaseHeaderFilterCell = useCallback(
    (columnId: string) => {
      if (!purchaseFilterLabels[columnId]) return null;
      const key = columnId as keyof PurchaseDocument;
      return (
        <input
          type="text"
          data-no-uppercase="true"
          value={purchaseFilters[key] ?? ""}
          onChange={(event) => setPurchaseFilterValue(key, event.target.value)}
          placeholder={purchaseFilterLabels[columnId]}
          className="h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-[#B23636] focus:ring-2 focus:ring-[#B23636]/20"
        />
      );
    },
    [purchaseFilterLabels, purchaseFilters, setPurchaseFilterValue],
  );

  const fetchSalesDocuments = useCallback(
    async (range: { fechaInicio: string; fechaFin: string }) => {
      const start = normalizeText(range.fechaInicio, "");
      const end = normalizeText(range.fechaFin, "");

      const startLegacy = toLegacyDate(start);
      const endLegacy = toLegacyDate(end);
      const legacyData = `${startLegacy}|${endLegacy}`;

      const query = new URLSearchParams({
        fechaInicio: start,
        fechaFin: end,
      });

      const getResponse = await apiRequest<unknown>({
        url: `${buildApiUrl("/Nota/ld-documentos")}?${query.toString()}`,
        method: "GET",
        config: {
          responseType: "text",
          headers: {
            Accept: "text/plain",
          },
        },
        fallback: "",
      });

      const parsedGet = parseDelimitedDataset(extractPlainText(getResponse));
      if (parsedGet !== null) {
        const headerIndex = buildHeaderIndex(parsedGet.headers);
        return {
          rows: parsedGet.rows.map((row) => mapSalesRow(row, headerIndex)),
          source: "GET" as SourceType,
        };
      }

      const postResponse = await apiRequest<unknown>({
        url: buildApiUrl("/Nota/ld-documentos"),
        method: "POST",
        data: { data: legacyData },
        config: {
          responseType: "text",
          headers: {
            Accept: "text/plain",
            "Content-Type": "application/json",
          },
        },
        fallback: "",
      });

      const parsedPost = parseDelimitedDataset(extractPlainText(postResponse));
      if (parsedPost !== null) {
        const headerIndex = buildHeaderIndex(parsedPost.headers);
        return {
          rows: parsedPost.rows.map((row) => mapSalesRow(row, headerIndex)),
          source: "POST_LEGACY" as SourceType,
        };
      }

      throw new Error("Respuesta de ventas invalida.");
    },
    [],
  );

  const fetchPurchaseDocuments = useCallback(
    async (range: { fechaInicio: string; fechaFin: string }) => {
      const response = await apiRequest<unknown>({
        url: buildApiUrl("/Compra/list"),
        method: "GET",
        fallback: [],
      });

      if (!Array.isArray(response)) {
        return {
          rows: [] as PurchaseDocument[],
          source: "Sin endpoint /Compra/list",
          unavailable: true,
        };
      }

      const rows = response
        .map((item) => {
          const row = asRecord(item);
          if (!row) return null;

          const fecha = pickFirstText(row, [
            "compraEmision",
            "CompraEmision",
            "fechaEmision",
            "FechaEmision",
          ]);

          if (!isInRange(fecha, range.fechaInicio, range.fechaFin)) {
            return null;
          }

          const serie = pickFirstText(row, [
            "compraSerie",
            "CompraSerie",
            "serie",
          ]);
          const numero = pickFirstText(row, [
            "compraNumero",
            "CompraNumero",
            "numero",
          ]);
          const correlativo = pickFirstText(row, [
            "compraCorrelativo",
            "CompraCorrelativo",
            "correlativo",
          ]);

          const nroDoc =
            serie && numero
              ? `${serie}-${numero}`
              : correlativo || pickFirstText(row, ["nroDoc", "NroDoc"]);

          const documento = resolvePurchaseDocumentName(
            pickFirstText(row, ["tipoCodigo", "TipoCodigo", "documento"]),
          );

          return {
            fecha: fecha || "-",
            documento,
            nroDoc: nroDoc || "-",
            proveedor:
              pickFirstText(row, [
                "proveedorNombre",
                "ProveedorNombre",
                "proveedor",
                "Proveedor",
                "razonSocial",
                "RazonSocial",
              ]) || "-",
            ruc:
              pickFirstText(row, [
                "proveedorRuc",
                "ProveedorRuc",
                "ruc",
                "RUC",
              ]) || "-",
            subTotal: toFormattedMoneyText(
              row.compraSubtotal ?? row.CompraSubtotal ?? row.compraSubTotal,
            ),
            igv: toFormattedMoneyText(row.compraIgv ?? row.CompraIgv),
            total: toFormattedMoneyText(
              row.compraTotal ?? row.CompraTotal ?? row.compraValorVenta,
            ),
            moneda:
              pickFirstText(row, ["compraMoneda", "CompraMoneda", "moneda"]) ||
              "-",
            estado:
              pickFirstText(row, ["compraEstado", "CompraEstado", "estado"]) ||
              "-",
            referencia:
              pickFirstText(row, [
                "compraObs",
                "CompraObs",
                "observacion",
                "referencia",
              ]) || "-",
          } satisfies PurchaseDocument;
        })
        .filter((row): row is PurchaseDocument => Boolean(row));

      return {
        rows,
        source: "GET /Compra/list",
        unavailable: false,
      };
    },
    [],
  );

  const loadData = useCallback(
    async (notifyEmpty = false) => {
      const start = normalizeText(fechaInicio, "");
      const end = normalizeText(fechaFin, "");

      if (!start || !end) {
        toast.error("Selecciona fecha inicio y fecha fin.");
        return;
      }

      if (start > end) {
        toast.error("Fecha inicio no puede ser mayor a fecha fin.");
        return;
      }

      setLoading(true);

      try {
        const [salesResult, purchaseResult] = await Promise.all([
          fetchSalesDocuments({ fechaInicio: start, fechaFin: end }),
          fetchPurchaseDocuments({ fechaInicio: start, fechaFin: end }),
        ]);

        setSalesRows(salesResult.rows);
        setSalesSource(salesResult.source);

        setPurchaseRows(purchaseResult.rows);
        setPurchaseSource(purchaseResult.source);
        setPurchaseUnavailable(purchaseResult.unavailable);

        if (notifyEmpty && salesResult.rows.length === 0) {
          toast.info("No hay documentos de ventas en ese rango.");
        }
      } catch (error) {
        console.error("Error cargando PDT Empresa", error);
        setSalesRows([]);
        setSalesSource(null);
        toast.error("No se pudo cargar documentos de ventas.");
      } finally {
        setLoading(false);
      }
    },
    [fechaFin, fechaInicio, fetchPurchaseDocuments, fetchSalesDocuments],
  );

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

  const filteredSalesRows = useMemo(
    () => applyColumnFilters(salesRows, salesFilters),
    [salesFilters, salesRows],
  );

  const filteredPurchaseRows = useMemo(
    () => applyColumnFilters(purchaseRows, purchaseFilters),
    [purchaseFilters, purchaseRows],
  );

  const salesRowsForExcel = useMemo(
    () =>
      resolveSalesRowsForExcel(
        filteredSalesRows,
        salesRows,
        salesFilters.documento,
      ),
    [filteredSalesRows, salesFilters.documento, salesRows],
  );

  const salesExcelTotals = useMemo(
    () =>
      salesRowsForExcel.reduce(
        (acc, row) => {
          const isCredit = isCreditNoteDocument(row.documento);
          const subTotal = parseMoney(row.subTotal);
          const igv = parseMoney(row.igv);
          const total = parseMoney(row.total);

          acc.count += 1;
          acc.baseImp += isCredit ? -Math.abs(subTotal) : subTotal;
          acc.igv += isCredit ? -Math.abs(igv) : igv;
          acc.total += isCredit ? -Math.abs(total) : total;
          return acc;
        },
        {
          count: 0,
          baseImp: 0,
          igv: 0,
          total: 0,
        },
      ),
    [salesRowsForExcel],
  );

  const salesTotals = useMemo(() => {
    const totals = filteredSalesRows.reduce(
      (acc, row) => {
        const subTotal = parseMoney(row.subTotal);
        const igv = parseMoney(row.igv);
        const icbper = parseMoney(row.icbper);

        acc.count += 1;
        acc.baseAndIgv += subTotal + igv;
        acc.icbper += icbper;
        return acc;
      },
      {
        count: 0,
        baseAndIgv: 0,
        icbper: 0,
      },
    );

    const baseImp = totals.baseAndIgv / 1.18;
    const igv = baseImp * 0.18;
    const total = totals.baseAndIgv + totals.icbper;

    return {
      count: totals.count,
      baseImp,
      igv,
      icbper: totals.icbper,
      total,
    };
  }, [filteredSalesRows]);

  const purchaseTotals = useMemo(() => {
    const totals = filteredPurchaseRows.reduce(
      (acc, row) => {
        acc.count += 1;
        acc.total += parseMoney(row.total);
        return acc;
      },
      {
        count: 0,
        total: 0,
      },
    );

    const baseImp = totals.total / 1.18;
    const igv = baseImp * 0.18;

    return {
      count: totals.count,
      baseImp,
      igv,
      total: totals.total,
    };
  }, [filteredPurchaseRows]);

  const pagoSunat = useMemo(() => {
    const value = salesTotals.igv - purchaseTotals.igv;
    return roundLegacyNumber(value);
  }, [purchaseTotals.igv, salesTotals.igv]);

  const impRenta = useMemo(() => {
    const value = salesTotals.baseImp / 100;
    return roundLegacyNumber(value);
  }, [salesTotals.baseImp]);

  const exportFileBaseName = useMemo(() => {
    const monthYear = toMonthYearLabel(fechaInicio || fechaFin);
    const documentoFilter =
      activeTab === "ventas"
        ? String(salesFilters.documento ?? "")
        : String(purchaseFilters.documento ?? "");
    const documentoToken = resolveDocumentoPluralToken(documentoFilter);

    if (documentoToken) return `${documentoToken}-${monthYear}`;
    return `pdt-${monthYear}`;
  }, [
    activeTab,
    fechaFin,
    fechaInicio,
    purchaseFilters.documento,
    salesFilters.documento,
  ]);

  const exportExcel = useCallback(async () => {
    try {
      if (activeTab === "ventas" && filteredSalesRows.length === 0) {
        toast.info("No hay ventas para exportar.");
        return;
      }

      if (activeTab === "compras" && filteredPurchaseRows.length === 0) {
        toast.info("No hay compras para exportar.");
        return;
      }

      const workbook = new Workbook();
      workbook.creator = "SGO";
      workbook.created = new Date();

      if (activeTab === "ventas") {
        const worksheet = workbook.addWorksheet("Ventas", {
          views: [{ state: "frozen", ySplit: 1 }],
        });

        worksheet.columns = [
          { header: "Fecha", key: "fecha", width: 13 },
          { header: "Documento", key: "documento", width: 20 },
          { header: "NroDoc", key: "nroDoc", width: 18 },
          { header: "Cliente", key: "cliente", width: 42 },
          { header: "RUC", key: "ruc", width: 14 },
          { header: "DNI", key: "dni", width: 14 },
          { header: "BaseImp", key: "subTotal", width: 14 },
          { header: "IGV", key: "igv", width: 14 },
          { header: "Total", key: "total", width: 14 },
          { header: "Usuario", key: "usuario", width: 16 },
          { header: "Estado", key: "estado", width: 14 },
          { header: "Referencia", key: "referencia", width: 18 },
          { header: "Codigo", key: "codigo", width: 10 },
          { header: "Mensaje", key: "mensaje", width: 35 },
          { header: "Condicion", key: "condicion", width: 14 },
          { header: "FormaPago", key: "formaPago", width: 14 },
          { header: "Entidad", key: "entidad", width: 16 },
          { header: "NroOperacion", key: "nroOperacion", width: 18 },
          { header: "Efectivo", key: "efectivo", width: 14 },
          { header: "Deposito", key: "deposito", width: 14 },
        ];
        ["subTotal", "igv", "total", "efectivo", "deposito"].forEach(
          (columnKey) => {
            worksheet.getColumn(columnKey).numFmt = EXCEL_AMOUNT_NUMFMT;
          },
        );
        worksheet.getColumn("codigo").alignment = {
          horizontal: "center",
          vertical: "middle",
        };

        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: EXCEL_HEADER_BG },
          };
          cell.font = { bold: true, color: { argb: EXCEL_HEADER_TEXT } };
          cell.alignment = { vertical: "middle", horizontal: "center" };
        });

        salesRowsForExcel.forEach((row) => {
          const isCredit = isCreditNoteDocument(row.documento);
          const subTotalValue = isCredit
            ? toCreditNoteExcelNumber(row.subTotal)
            : toExcelSafeNumber(row.subTotal);
          const igvValue = isCredit
            ? toCreditNoteExcelNumber(row.igv)
            : toExcelSafeNumber(row.igv);
          const totalValue = isCredit
            ? toCreditNoteExcelNumber(row.total)
            : toExcelSafeNumber(row.total);

          const rowRef = worksheet.addRow({
            ...row,
            subTotal: subTotalValue,
            igv: igvValue,
            total: totalValue,
            efectivo: toExcelSafeNumber(row.efectivo),
            deposito: toExcelSafeNumber(row.deposito),
          });

          if (isCredit) {
            ["subTotal", "igv", "total"].forEach((columnKey) => {
              const cell = rowRef.getCell(columnKey);
              cell.font = {
                ...(cell.font ?? {}),
                color: { argb: EXCEL_NEGATIVE_TEXT },
              };
            });
          }
        });

        worksheet.addRow({});
        const totalsRow = worksheet.addRow({
          fecha: `Items: ${salesExcelTotals.count}`,
          subTotal: Number(salesExcelTotals.baseImp.toFixed(2)),
          igv: Number(salesExcelTotals.igv.toFixed(2)),
          total: Number(salesExcelTotals.total.toFixed(2)),
        });

        totalsRow.font = { bold: true };
      } else {
        const worksheet = workbook.addWorksheet("Compras", {
          views: [{ state: "frozen", ySplit: 1 }],
        });

        worksheet.columns = [
          { header: "Fecha", key: "fecha", width: 13 },
          { header: "Documento", key: "documento", width: 20 },
          { header: "NroDoc", key: "nroDoc", width: 18 },
          { header: "Proveedor", key: "proveedor", width: 38 },
          { header: "RUC", key: "ruc", width: 14 },
          { header: "BaseImp", key: "subTotal", width: 14 },
          { header: "IGV", key: "igv", width: 14 },
          { header: "Total", key: "total", width: 14 },
          { header: "Moneda", key: "moneda", width: 10 },
          { header: "Estado", key: "estado", width: 22 },
          { header: "Referencia", key: "referencia", width: 28 },
        ];
        ["subTotal", "igv", "total"].forEach((columnKey) => {
          worksheet.getColumn(columnKey).numFmt = EXCEL_AMOUNT_NUMFMT;
        });

        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: EXCEL_HEADER_BG },
          };
          cell.font = { bold: true, color: { argb: EXCEL_HEADER_TEXT } };
          cell.alignment = { vertical: "middle", horizontal: "center" };
        });

        filteredPurchaseRows.forEach((row) => {
          worksheet.addRow({
            ...row,
            subTotal: toExcelSafeNumber(row.subTotal),
            igv: toExcelSafeNumber(row.igv),
            total: toExcelSafeNumber(row.total),
          });
        });

        worksheet.addRow({});
        const totalsRow = worksheet.addRow({
          fecha: `Items: ${purchaseTotals.count}`,
          subTotal: Number(purchaseTotals.baseImp.toFixed(2)),
          igv: Number(purchaseTotals.igv.toFixed(2)),
          total: Number(purchaseTotals.total.toFixed(2)),
        });

        totalsRow.font = { bold: true };
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${exportFileBaseName}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);

      toast.success("Excel generado correctamente.");
    } catch (error) {
      console.error("Error exportando excel PDT", error);
      toast.error("No se pudo exportar Excel.");
    }
  }, [
    activeTab,
    exportFileBaseName,
    fechaFin,
    fechaInicio,
    filteredPurchaseRows,
    filteredSalesRows,
    purchaseTotals.baseImp,
    purchaseTotals.count,
    purchaseTotals.igv,
    purchaseTotals.total,
    salesExcelTotals.baseImp,
    salesExcelTotals.count,
    salesExcelTotals.igv,
    salesExcelTotals.total,
    salesRowsForExcel,
  ]);

  const salesColumns = useMemo(
    () => [
      salesColumnHelper.accessor("fecha", {
        header: "Fecha",
        cell: (info) => info.getValue() || "-",
      }),
      salesColumnHelper.accessor("documento", {
        header: "Documento",
        cell: (info) => info.getValue() || "-",
      }),
      salesColumnHelper.accessor("nroDoc", {
        header: "NroDoc",
        cell: (info) => info.getValue() || "-",
      }),
      salesColumnHelper.accessor("cliente", {
        header: "Cliente",
        cell: (info) => info.getValue() || "-",
      }),
      salesColumnHelper.accessor("ruc", {
        header: "RUC",
        cell: (info) => info.getValue() || "-",
      }),
      salesColumnHelper.accessor("dni", {
        header: "DNI",
        cell: (info) => info.getValue() || "-",
      }),
      salesColumnHelper.accessor("subTotal", {
        header: "SubTotal",
        cell: (info) => info.getValue() || "0.00",
        meta: { tdClassName: "text-right", align: "right" },
      }),
      salesColumnHelper.accessor("igv", {
        header: "IGV",
        cell: (info) => info.getValue() || "0.00",
        meta: { tdClassName: "text-right", align: "right" },
      }),
      salesColumnHelper.accessor("total", {
        header: "Total",
        cell: (info) => info.getValue() || "0.00",
        meta: { tdClassName: "text-right", align: "right" },
      }),
      salesColumnHelper.accessor("usuario", {
        header: "Usuario",
        cell: (info) => info.getValue() || "-",
      }),
      salesColumnHelper.accessor("estado", {
        header: "Estado",
        cell: (info) => {
          const value = normalizeText(info.getValue(), "-");
          const normalized = value.toUpperCase();

          const stateClass =
            normalized.includes("ANUL") || normalized.includes("BAJA")
              ? "bg-red-100 text-red-700 border-red-200"
              : normalized.includes("PEND")
                ? "bg-amber-100 text-amber-700 border-amber-200"
                : "bg-emerald-100 text-emerald-700 border-emerald-200";

          return (
            <span
              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${stateClass}`}
            >
              {value}
            </span>
          );
        },
      }),
      salesColumnHelper.accessor("referencia", {
        header: "Referencia",
        cell: (info) => info.getValue() || "-",
      }),
    ],
    [],
  );

  const purchaseColumns = useMemo(
    () => [
      purchaseColumnHelper.accessor("fecha", {
        header: "Fecha",
        cell: (info) => info.getValue() || "-",
      }),
      purchaseColumnHelper.accessor("documento", {
        header: "Documento",
        cell: (info) => info.getValue() || "-",
      }),
      purchaseColumnHelper.accessor("nroDoc", {
        header: "NroDoc",
        cell: (info) => info.getValue() || "-",
      }),
      purchaseColumnHelper.accessor("proveedor", {
        header: "Proveedor",
        cell: (info) => info.getValue() || "-",
      }),
      purchaseColumnHelper.accessor("ruc", {
        header: "RUC",
        cell: (info) => info.getValue() || "-",
      }),
      purchaseColumnHelper.accessor("subTotal", {
        header: "SubTotal",
        cell: (info) => info.getValue() || "0.00",
        meta: { tdClassName: "text-right", align: "right" },
      }),
      purchaseColumnHelper.accessor("igv", {
        header: "IGV",
        cell: (info) => info.getValue() || "0.00",
        meta: { tdClassName: "text-right", align: "right" },
      }),
      purchaseColumnHelper.accessor("total", {
        header: "Total",
        cell: (info) => info.getValue() || "0.00",
        meta: { tdClassName: "text-right", align: "right" },
      }),
      purchaseColumnHelper.accessor("moneda", {
        header: "Moneda",
        cell: (info) => info.getValue() || "-",
      }),
      purchaseColumnHelper.accessor("estado", {
        header: "Estado",
        cell: (info) => info.getValue() || "-",
      }),
      purchaseColumnHelper.accessor("referencia", {
        header: "Referencia",
        cell: (info) => info.getValue() || "-",
      }),
    ],
    [],
  );

  const salesSourceLabel =
    salesSource === "GET"
      ? "GET /Nota/ld-documentos"
      : salesSource === "POST_LEGACY"
        ? "POST legacy /Nota/ld-documentos"
        : "Sin fuente activa";

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-end 2xl:justify-between">
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:w-auto 2xl:grid-cols-none 2xl:auto-cols-max 2xl:grid-flow-col 2xl:items-end">
            <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
              F-Inicio:
              <input
                type="date"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
                value={fechaInicio}
                onChange={(event) => setFechaInicio(event.target.value)}
              />
            </label>

            <label className="flex w-full flex-col gap-1 text-sm font-medium text-slate-700">
              F-Fin:
              <input
                type="date"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
                value={fechaFin}
                onChange={(event) => setFechaFin(event.target.value)}
              />
            </label>

            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={loading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              Buscar
            </button>

            <button
              type="button"
              onClick={() => void loadData(false)}
              disabled={loading}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </button>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 2xl:w-auto">
            <div className="flex items-center justify-between gap-2 rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5">
              <span className="text-sm font-semibold text-slate-700">
                PAGO SUNAT S/
              </span>
              <span className="inline-flex min-w-[92px] justify-end rounded bg-black px-3 py-1 text-base font-bold text-white">
                {formatMoney(pagoSunat)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-slate-300 bg-slate-100 px-2 py-1.5">
              <span className="text-sm font-semibold text-slate-700">
                IMP RENTA S/
              </span>
              <span className="inline-flex min-w-[92px] justify-end rounded bg-slate-700 px-3 py-1 text-base font-bold text-white">
                {formatMoney(impRenta)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void exportExcel()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Exportar Excel
            </button>
          </div>
        </div>
      </section>

      <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === "ventas"
                ? "bg-[#B23636]/10 text-[#B23636]"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            onClick={() => setActiveTab("ventas")}
          >
            Ventas
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === "compras"
                ? "bg-[#B23636]/10 text-[#B23636]"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            onClick={() => setActiveTab("compras")}
          >
            Compras
          </button>
        </div>
      </div>

      {activeTab === "ventas" ? (
        <DataTable
          columns={salesColumns}
          data={filteredSalesRows}
          isLoading={loading}
          showSearch={false}
          emptyMessage="No hay documentos de ventas para el rango seleccionado."
          renderHeaderFilterCell={renderSalesHeaderFilterCell}
          toolbarLeading={
            <div className="w-full md:hidden">
              <div className="flex min-w-max items-end gap-2 overflow-x-auto pb-1">
                {salesFilterFields.map((field) => (
                  <label
                    key={String(field.key)}
                    className="flex w-[130px] shrink-0 flex-col gap-1 text-[11px] text-slate-600"
                  >
                    <span className="truncate font-semibold text-slate-500">
                      {field.label}
                    </span>
                    <input
                      type="text"
                      data-no-uppercase="true"
                      value={salesFilters[field.key] ?? ""}
                      onChange={(event) =>
                        setSalesFilterValue(field.key, event.target.value)
                      }
                      className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-[#B23636] focus:ring-2 focus:ring-[#B23636]/20"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={clearSalesFilters}
                  className="h-9 shrink-0 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Limpiar
                </button>
              </div>
            </div>
          }
          toolbarAction={
            <button
              type="button"
              onClick={clearSalesFilters}
              className="hidden h-9 shrink-0 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 md:inline-flex md:items-center"
            >
              Limpiar filtros
            </button>
          }
          footerContent={
            <div className="flex w-full flex-col gap-2 text-sm font-semibold lg:flex-row lg:items-center lg:justify-between">
              <div className="text-slate-700">Items: {salesTotals.count}</div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-700">BaseImp </span>
                <span className="inline-flex min-w-[110px] justify-end rounded bg-black px-3 py-1.5 text-lg font-bold text-white sm:min-w-[140px] sm:text-xl">
                  {formatMoney(salesTotals.baseImp)}
                </span>

                <span className="text-slate-700">Igv </span>
                <span className="inline-flex min-w-[110px] justify-end rounded bg-red-600 px-3 py-1.5 text-lg font-bold text-white sm:min-w-[140px] sm:text-xl">
                  {formatMoney(salesTotals.igv)}
                </span>

                <span className="text-slate-700">Total </span>
                <span className="inline-flex min-w-[130px] justify-end rounded bg-black px-3 py-1.5 text-lg font-bold text-white sm:min-w-[170px] sm:text-xl">
                  {formatMoney(salesTotals.total)}
                </span>
              </div>
            </div>
          }
        />
      ) : (
        <DataTable
          columns={purchaseColumns}
          data={filteredPurchaseRows}
          isLoading={loading}
          showSearch={false}
          emptyMessage={
            purchaseUnavailable
              ? "No hay endpoint de compras disponible. Se dejo estructura lista."
              : "No hay documentos de compras para el rango seleccionado."
          }
          renderHeaderFilterCell={renderPurchaseHeaderFilterCell}
          toolbarLeading={
            <div className="w-full md:hidden">
              <div className="flex min-w-max items-end gap-2 overflow-x-auto pb-1">
                {purchaseFilterFields.map((field) => (
                  <label
                    key={String(field.key)}
                    className="flex w-[130px] shrink-0 flex-col gap-1 text-[11px] text-slate-600"
                  >
                    <span className="truncate font-semibold text-slate-500">
                      {field.label}
                    </span>
                    <input
                      type="text"
                      data-no-uppercase="true"
                      value={purchaseFilters[field.key] ?? ""}
                      onChange={(event) =>
                        setPurchaseFilterValue(field.key, event.target.value)
                      }
                      className="h-9 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-[#B23636] focus:ring-2 focus:ring-[#B23636]/20"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={clearPurchaseFilters}
                  className="h-9 shrink-0 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Limpiar
                </button>
              </div>
            </div>
          }
          toolbarAction={
            <button
              type="button"
              onClick={clearPurchaseFilters}
              className="hidden h-9 shrink-0 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 md:inline-flex md:items-center"
            >
              Limpiar filtros
            </button>
          }
          footerContent={
            <div className="flex w-full flex-col gap-2 text-sm font-semibold lg:flex-row lg:items-center lg:justify-between">
              <div className="text-slate-700">
                Items: {purchaseTotals.count}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-700">BaseImp </span>
                <span className="inline-flex min-w-[110px] justify-end rounded bg-black px-3 py-1.5 text-lg font-bold text-white sm:min-w-[140px] sm:text-xl">
                  {formatMoney(purchaseTotals.baseImp)}
                </span>

                <span className="text-slate-700">Igv </span>
                <span className="inline-flex min-w-[110px] justify-end rounded bg-red-600 px-3 py-1.5 text-lg font-bold text-white sm:min-w-[140px] sm:text-xl">
                  {formatMoney(purchaseTotals.igv)}
                </span>

                <span className="text-slate-700">Total </span>
                <span className="inline-flex min-w-[130px] justify-end rounded bg-black px-3 py-1.5 text-lg font-bold text-white sm:min-w-[170px] sm:text-xl">
                  {formatMoney(purchaseTotals.total)}
                </span>
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}
