import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Workbook } from "exceljs";
import Checkbox from "@mui/material/Checkbox";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Search,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import DataTable from "@/components/DataTable";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";

type SireRegistroKey = `col${string}`;
type SireFilters = { period: string; dateFrom: string; dateTo: string; tipoCodigo: string; serie: string };

type SireVentaRegistro = Record<SireRegistroKey, string> & {
  id: string;
};

type SireArchivo = {
  nomArchivoReporte?: string | null;
  nomArchivoContenido?: string | null;
  delimiter?: string | null;
  totalRegistros?: number | null;
  columns?: string[] | null;
  registros?: Array<Record<string, unknown>> | null;
};

type SireVentasResponse = {
  periodo?: string | null;
  numTicket?: string | null;
  archivo?: SireArchivo | null;
};

type SireTab = "registros" | "comparacion";
type SireCompareTab = "diferencias" | "sunat";

type SireCompareRow = {
  origen: string;
  serie: string;
  numero: string;
  numeroNormalizado: string;
  numeroValor: number | null;
  clave: string;
  fecha: string;
  tipoDocumento: string;
  monto: string;
  estado: string;
  raw?: unknown;
};

type SireCompareResponse = {
  periodo?: string | null;
  serie?: string | null;
  tipoCodigo?: string | null;
  resumen?: {
    totalBd?: number | null;
    totalSire?: number | null;
    totalEnAmbos?: number | null;
    totalSoloEnBd?: number | null;
    totalSoloEnSire?: number | null;
  } | null;
  soloEnBd?: SireCompareRow[] | null;
  soloEnSire?: SireCompareRow[] | null;
};

type SireSunatValidationResult = {
  documento?: {
    ruc?: string | null;
    tipoDocumento?: string | null;
    serie?: string | null;
    numero?: string | null;
    fechaEmision?: string | null;
    monto?: number | string | null;
    original?: SireCompareRow | null;
  } | null;
  consultado?: boolean | null;
  existeEnSunat?: boolean | null;
  codigo?: string | null;
  mensaje?: string | null;
  statusCode?: number | null;
  sunatResponse?: string | null;
  error?: string | null;
};

type SireSunatValidationResponse = {
  resumen?: {
    total?: number | null;
    consultados?: number | null;
    existenEnSunat?: number | null;
    noExistenEnSunat?: number | null;
    conError?: number | null;
  } | null;
  resultados?: SireSunatValidationResult[] | null;
};

const columnHelper = createColumnHelper<SireVentaRegistro>();
const compareColumnHelper = createColumnHelper<SireCompareRow>();
const sunatColumnHelper = createColumnHelper<SireSunatValidationResult>();

const SIRE_COLUMN_KEYS = Array.from(
  { length: 40 },
  (_, index) => `col${String(index + 1).padStart(3, "0")}` as SireRegistroKey,
);

const DEFAULT_HEADERS: Record<SireRegistroKey, string> = {
  col001: "RUC",
  col002: "Razon Social",
  col003: "Periodo",
  col004: "CAR SUNAT",
  col005: "Fecha emision",
  col006: "Fecha vcto/pago",
  col007: "Tipo CP",
  col008: "Serie",
  col009: "Numero",
  col010: "Numero final",
  col011: "Tipo Doc",
  col012: "Nro Doc",
  col013: "Cliente",
  col014: "Exportacion",
  col015: "BI Gravada",
  col016: "Dscto BI",
  col017: "IGV/IPM",
  col018: "Dscto IGV",
  col019: "Exonerado",
  col020: "Inafecto",
  col021: "ISC",
  col022: "BI IVAP",
  col023: "IVAP",
  col024: "ICBPER",
  col025: "Otros Tributos",
  col026: "Total CP",
  col027: "Moneda",
  col028: "Tipo Cambio",
  col029: "Fec Doc Modif.",
  col030: "Tipo CP Modif.",
  col031: "Serie CP Modif.",
  col032: "Nro CP Modif.",
  col033: "Proyecto",
  col034: "Tipo Nota",
  col035: "Est. Comp.",
  col036: "FOB Embarcado",
  col037: "Op. Gratuitas",
  col038: "Tipo Operacion",
  col039: "DAM/CP",
  col040: "CLU",
};

const DISPLAY_COLUMN_KEYS: SireRegistroKey[] = [
  "col005",
  "col007",
  "col008",
  "col009",
  "col012",
  "col013",
  "col015",
  "col017",
  "col026",
  "col027",
  "col035",
  "col038",
];

const MONEY_COLUMNS = new Set<SireRegistroKey>([
  "col014",
  "col015",
  "col016",
  "col017",
  "col018",
  "col019",
  "col020",
  "col021",
  "col022",
  "col023",
  "col024",
  "col025",
  "col026",
  "col036",
  "col037",
]);

const safeText = (value: unknown) => String(value ?? "").trim();

const pad2 = (value: number) => String(value).padStart(2, "0");

const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const toPeriodInputValue = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

const toPeriodParam = (periodInput: string) => periodInput.replace("-", "");

const toSunatDate = (dateInput: string) => {
  const [year, month, day] = dateInput.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
};

const getMonthEnd = (periodInput: string) => {
  const [yearRaw, monthRaw] = periodInput.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return "";

  const end = new Date(year, month, 0);
  return toDateInputValue(end);
};

const resolveSireVentasUrl = () => buildApiUrl("/sunat/sire/ventas/registros");
const resolveSireCompararUrl = () => buildApiUrl("/sunat/sire/ventas/comparar");
const resolveSireValidarSunatUrl = () => buildApiUrl("/sunat/sire/ventas/validar-sunat");

const parseAmount = (value: unknown) => {
  const raw = safeText(value);
  if (!raw) return 0;

  const normalized =
    raw.includes(",") && !raw.includes(".")
      ? raw.replace(",", ".")
      : raw.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const looksLikeHeaderRow = (row: Record<string, unknown>) => {
  const first = safeText(row.col001).toUpperCase();
  const dateHeader = safeText(row.col005).toUpperCase();
  return first === "RUC" && dateHeader.includes("FECHA");
};

const normalizeRow = (
  row: Record<string, unknown>,
  index: number,
): SireVentaRegistro => {
  const normalized = SIRE_COLUMN_KEYS.reduce(
    (acc, key) => {
      acc[key] = safeText(row[key]);
      return acc;
    },
    {} as Record<SireRegistroKey, string>,
  );

  return {
    ...normalized,
    id:
      safeText(row.col004) ||
      `${safeText(row.col008)}-${safeText(row.col009)}-${index}`,
  };
};

const normalizeHeaderMap = (
  registros: Array<Record<string, unknown>>,
): Record<SireRegistroKey, string> => {
  const headerRow = registros.find(looksLikeHeaderRow);
  if (!headerRow) return DEFAULT_HEADERS;

  return SIRE_COLUMN_KEYS.reduce(
    (acc, key) => {
      acc[key] = safeText(headerRow[key]) || DEFAULT_HEADERS[key];
      return acc;
    },
    {} as Record<SireRegistroKey, string>,
  );
};

const normalizeRegistros = (
  registros: Array<Record<string, unknown>>,
): SireVentaRegistro[] =>
  registros
    .filter((row) => !looksLikeHeaderRow(row))
    .map((row, index) => normalizeRow(row, index));

const isSireVentasResponse = (value: unknown): value is SireVentasResponse => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as SireVentasResponse;
  return Boolean(candidate.archivo && typeof candidate.archivo === "object");
};

const isSireCompareResponse = (value: unknown): value is SireCompareResponse => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as SireCompareResponse;
  return Boolean(candidate.resumen && typeof candidate.resumen === "object");
};

const isSireSunatValidationResponse = (
  value: unknown,
): value is SireSunatValidationResponse => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as SireSunatValidationResponse;
  return Boolean(candidate.resumen && typeof candidate.resumen === "object");
};

const getEstadoComprobanteLabel = (value: string) => {
  if (value === "1") return "Activo";
  if (value === "2") return "Anulado";
  return value || "-";
};

const toExcelSafeText = (value: unknown) => {
  const text = safeText(value);
  const excelMaxCellLength = 32767;
  if (text.length <= excelMaxCellLength) return text;
  return `${text.slice(0, excelMaxCellLength - 3)}...`;
};

const getExcelColumnWidth = (key: SireRegistroKey, header: string) => {
  if (key === "col004") return 30;
  if (key === "col013") return 38;
  if (key === "col002") return 34;
  if (key === "col012") return 16;
  if (key === "col029") return 18;
  if (MONEY_COLUMNS.has(key)) return 15;
  return Math.min(Math.max(header.length + 3, 12), 24);
};

const getCompareRowKey = (row: SireCompareRow) =>
  safeText(row.clave) ||
  `${safeText(row.origen)}-${safeText(row.serie)}-${safeText(row.numero)}`;

const getCompareRowCount = (
  value: number | string | null | undefined,
  fallback = 0,
) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getCompareAmountTotal = (rows: SireCompareRow[] | null | undefined) =>
  (Array.isArray(rows) ? rows : []).reduce(
    (total, row) => total + parseAmount(row.monto),
    0,
  );

type ExcelColumnConfig<T> = {
  header: string;
  key: string;
  width: number;
  value: (row: T) => string | number;
  isMoney?: boolean;
};

export default function SireVentasRegistrosPage() {
  const now = useMemo(() => new Date(), []);
  const initialPeriod = useMemo(() => toPeriodInputValue(now), [now]);
  const initialDateFrom = useMemo(
    () => `${initialPeriod}-01`,
    [initialPeriod],
  );
  const initialDateTo = useMemo(() => getMonthEnd(initialPeriod), [initialPeriod]);
  const filterMethods = useForm<SireFilters>({
    defaultValues: { period: initialPeriod, dateFrom: initialDateFrom, dateTo: initialDateTo, tipoCodigo: "03", serie: "" },
  });
  const {
    period = initialPeriod,
    dateFrom = initialDateFrom,
    dateTo = initialDateTo,
    tipoCodigo = "03",
    serie = "",
  } = useWatch({ control: filterMethods.control });
  const [response, setResponse] = useState<SireVentasResponse | null>(null);
  const [compareResponse, setCompareResponse] =
    useState<SireCompareResponse | null>(null);
  const [compareRows, setCompareRows] = useState<SireCompareRow[]>([]);
  const [sunatValidationResponse, setSunatValidationResponse] =
    useState<SireSunatValidationResponse | null>(null);
  const [sunatValidationRows, setSunatValidationRows] = useState<
    SireSunatValidationResult[]
  >([]);
  const [selectedBdKeys, setSelectedBdKeys] = useState<string[]>([]);
  const [rows, setRows] = useState<SireVentaRegistro[]>([]);
  const [filteredRows, setFilteredRows] = useState<SireVentaRegistro[]>([]);
  const [headers, setHeaders] =
    useState<Record<SireRegistroKey, string>>(DEFAULT_HEADERS);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [validatingSunat, setValidatingSunat] = useState(false);
  const [activeTab, setActiveTab] = useState<SireTab>("registros");
  const [compareTab, setCompareTab] = useState<SireCompareTab>("diferencias");

  const fetchRegistros = useCallback(async () => {
    if (!period || !dateFrom || !dateTo) {
      toast.error("Seleccione periodo, fecha inicio y fecha fin.");
      return;
    }

    if (dateFrom > dateTo) {
      toast.error("La fecha inicio no puede ser mayor que la fecha fin.");
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({
        periodo: toPeriodParam(period),
        fecDocumentoDesde: toSunatDate(dateFrom),
        fecDocumentoHasta: toSunatDate(dateTo),
      });
      const data = await apiRequest<SireVentasResponse | null>({
        url: `${resolveSireVentasUrl()}?${params.toString()}`,
        method: "GET",
        fallback: null,
      });

      if (!isSireVentasResponse(data)) {
        throw new Error("Respuesta SIRE invalida");
      }

      const registros = Array.isArray(data.archivo?.registros)
        ? data.archivo.registros
        : [];
      const normalizedHeaders = normalizeHeaderMap(registros);
      const normalizedRows = normalizeRegistros(registros);

      setResponse(data);
      setHeaders(normalizedHeaders);
      setRows(normalizedRows);
      setFilteredRows(normalizedRows);

      if (!normalizedRows.length) {
        toast.info("No se encontraron registros SIRE para el rango seleccionado.");
      }
    } catch (error) {
      console.error("Error loading SIRE sales records", error);
      setResponse(null);
      setRows([]);
      setFilteredRows([]);
      toast.error("No se pudo cargar los registros de ventas SIRE.");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, period]);

  const totals = useMemo(
    () =>
      filteredRows.reduce(
        (acc, row) => {
          acc.count += 1;
          acc.base += parseAmount(row.col015);
          acc.igv += parseAmount(row.col017);
          acc.total += parseAmount(row.col026);
          return acc;
        },
        { count: 0, base: 0, igv: 0, total: 0 },
      ),
    [filteredRows],
  );

  const selectableBdRows = useMemo(
    () =>
      (Array.isArray(compareResponse?.soloEnBd)
        ? compareResponse.soloEnBd
        : []
      ).filter((row) => safeText(getCompareRowKey(row))),
    [compareResponse?.soloEnBd],
  );

  const selectedBdKeySet = useMemo(
    () => new Set(selectedBdKeys),
    [selectedBdKeys],
  );

  const selectedBdRows = useMemo(
    () =>
      selectableBdRows.filter((row) =>
        selectedBdKeySet.has(getCompareRowKey(row)),
      ),
    [selectableBdRows, selectedBdKeySet],
  );

  const allSelectableBdRowsSelected =
    selectableBdRows.length > 0 &&
    selectedBdRows.length === selectableBdRows.length;

  const compareSummary = useMemo(() => {
    const soloEnBd = Array.isArray(compareResponse?.soloEnBd)
      ? compareResponse.soloEnBd
      : [];
    const soloEnSire = Array.isArray(compareResponse?.soloEnSire)
      ? compareResponse.soloEnSire
      : [];
    const onlyBd = getCompareRowCount(
      compareResponse?.resumen?.totalSoloEnBd,
      soloEnBd.length,
    );
    const onlySire = getCompareRowCount(
      compareResponse?.resumen?.totalSoloEnSire,
      soloEnSire.length,
    );
    const totalBd = getCompareRowCount(compareResponse?.resumen?.totalBd);
    const totalSire = getCompareRowCount(compareResponse?.resumen?.totalSire);
    const countGap = totalBd - totalSire;
    const amountGap =
      getCompareAmountTotal(soloEnBd) - getCompareAmountTotal(soloEnSire);

    return {
      totalBd,
      totalSire,
      totalEnAmbos: getCompareRowCount(compareResponse?.resumen?.totalEnAmbos),
      onlyBd,
      onlySire,
      totalDiff: onlyBd + onlySire,
      countGap,
      amountGap,
    };
  }, [compareResponse]);

  const countGapLabel =
    compareSummary.countGap === 0
      ? "Sin diferencia neta"
      : compareSummary.countGap > 0
        ? `${compareSummary.countGap} mas en BD`
        : `${Math.abs(compareSummary.countGap)} mas en SIRE`;

  const toggleBdRowSelection = (row: SireCompareRow) => {
    const key = getCompareRowKey(row);
    if (!key) return;

    setSelectedBdKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  };

  const selectAllBdRows = () => {
    setSelectedBdKeys(selectableBdRows.map(getCompareRowKey).filter(Boolean));
  };

  const clearBdSelection = () => {
    setSelectedBdKeys([]);
  };

  const columns = useMemo(
    () =>
      DISPLAY_COLUMN_KEYS.map((key) =>
        columnHelper.accessor(key, {
          header: headers[key] ?? DEFAULT_HEADERS[key],
          cell: (info) => {
            const value = safeText(info.getValue());

            if (key === "col013") {
              return (
                <span className="inline-block max-w-[320px] truncate" title={value}>
                  {value || "-"}
                </span>
              );
            }

            if (key === "col035") {
              const label = getEstadoComprobanteLabel(value);
              const isActive = value === "1";
              const badgeClass = isActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700";

              return (
                <span
                  className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass}`}
                >
                  {label}
                </span>
              );
            }

            if (MONEY_COLUMNS.has(key)) {
              return formatMoney(parseAmount(value));
            }

            return value || "-";
          },
          meta: MONEY_COLUMNS.has(key)
            ? { align: "right", tdClassName: "text-right" }
            : undefined,
        }),
      ),
    [headers],
  );

  const compareColumns = useMemo(
    () => [
      compareColumnHelper.display({
        id: "seleccionar",
        header: "Sel.",
        cell: ({ row }) => {
          const isBdRow = safeText(row.original.origen).toUpperCase() === "BD";
          const key = getCompareRowKey(row.original);

          return (
            <Checkbox
              checked={selectedBdKeySet.has(key)}
              disabled={!isBdRow}
              onChange={() => toggleBdRowSelection(row.original)}
              size="small"
              inputProps={{ "aria-label": "Seleccionar para validar en SUNAT" }}
              sx={{ color: "#B23636", "&.Mui-checked": { color: "#B23636" } }}
            />
          );
        },
        meta: { align: "center" },
      }),
      compareColumnHelper.accessor("origen", {
        header: "Origen",
        cell: (info) => {
          const value = safeText(info.getValue());
          const badgeClass =
            value.toUpperCase() === "BD"
              ? "border-blue-200 bg-blue-50 text-blue-700"
              : "border-amber-200 bg-amber-50 text-amber-700";

          return (
            <span
              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass}`}
            >
              {value || "-"}
            </span>
          );
        },
      }),
      compareColumnHelper.accessor("fecha", {
        header: "Fecha",
        cell: (info) => safeText(info.getValue()) || "-",
      }),
      compareColumnHelper.accessor("tipoDocumento", {
        header: "Tipo",
        cell: (info) => safeText(info.getValue()) || "-",
      }),
      compareColumnHelper.accessor("serie", {
        header: "Serie",
        cell: (info) => safeText(info.getValue()) || "-",
      }),
      compareColumnHelper.accessor("numero", {
        header: "Numero",
        cell: (info) => (
          <span className="font-semibold text-slate-900">
            {safeText(info.getValue()) || "-"}
          </span>
        ),
      }),
      compareColumnHelper.accessor("clave", {
        header: "Clave",
        cell: (info) => safeText(info.getValue()) || "-",
      }),
      compareColumnHelper.accessor("monto", {
        header: "Monto",
        cell: (info) => formatMoney(parseAmount(info.getValue())),
        meta: { align: "right", tdClassName: "text-right" },
      }),
      compareColumnHelper.accessor("estado", {
        header: "Estado",
        cell: (info) => safeText(info.getValue()) || "-",
      }),
    ],
    [selectedBdKeySet],
  );

  const sunatColumns = useMemo(
    () => [
      sunatColumnHelper.display({
        id: "existeEnSunat",
        header: "SUNAT",
        cell: ({ row }) => {
          const exists = Boolean(row.original.existeEnSunat);
          const hasError = Boolean(safeText(row.original.error));
          const label = hasError ? "Error" : exists ? "Existe" : "No existe";
          const badgeClass = hasError
            ? "border-red-200 bg-red-50 text-red-700"
            : exists
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700";

          return (
            <span
              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass}`}
            >
              {label}
            </span>
          );
        },
      }),
      sunatColumnHelper.display({
        id: "tipoDocumento",
        header: "Tipo",
        cell: ({ row }) => safeText(row.original.documento?.tipoDocumento) || "-",
      }),
      sunatColumnHelper.display({
        id: "serie",
        header: "Serie",
        cell: ({ row }) => safeText(row.original.documento?.serie) || "-",
      }),
      sunatColumnHelper.display({
        id: "numero",
        header: "Numero",
        cell: ({ row }) => (
          <span className="font-semibold text-slate-900">
            {safeText(row.original.documento?.numero) || "-"}
          </span>
        ),
      }),
      sunatColumnHelper.display({
        id: "fechaEmision",
        header: "Fecha",
        cell: ({ row }) => safeText(row.original.documento?.fechaEmision) || "-",
      }),
      sunatColumnHelper.display({
        id: "monto",
        header: "Monto",
        cell: ({ row }) => formatMoney(parseAmount(row.original.documento?.monto)),
        meta: { align: "right", tdClassName: "text-right" },
      }),
      sunatColumnHelper.accessor("codigo", {
        header: "Codigo",
        cell: (info) => safeText(info.getValue()) || "-",
      }),
      sunatColumnHelper.accessor("mensaje", {
        header: "Mensaje",
        cell: (info) => {
          const value = safeText(info.getValue());
          return (
            <span className="inline-block max-w-[320px] truncate" title={value}>
              {value || "-"}
            </span>
          );
        },
      }),
      sunatColumnHelper.accessor("statusCode", {
        header: "HTTP",
        cell: (info) => safeText(info.getValue()) || "-",
      }),
      sunatColumnHelper.accessor("error", {
        header: "Error",
        cell: (info) => {
          const value = safeText(info.getValue());
          return value ? (
            <span className="inline-block max-w-[260px] truncate text-red-700" title={value}>
              {value}
            </span>
          ) : (
            "-"
          );
        },
      }),
    ],
    [],
  );

  const handlePeriodChange = (value: string) => {
    filterMethods.setValue("period", value);
    if (!value) return;
    filterMethods.setValue("dateFrom", `${value}-01`);
    filterMethods.setValue("dateTo", getMonthEnd(value));
  };

  const compareRegistros = async () => {
    if (!period || !dateFrom || !dateTo || !tipoCodigo.trim() || !serie.trim()) {
      toast.error("Seleccione periodo, fechas, tipo y serie para comparar.");
      return;
    }

    if (dateFrom > dateTo) {
      toast.error("La fecha inicio no puede ser mayor que la fecha fin.");
      return;
    }

    setComparing(true);

    try {
      const params = new URLSearchParams({
        periodo: toPeriodParam(period),
        tipoCodigo: tipoCodigo.trim(),
        serie: serie.trim().toUpperCase(),
        fecDocumentoDesde: toSunatDate(dateFrom),
        fecDocumentoHasta: toSunatDate(dateTo),
      });

      const data = await apiRequest<SireCompareResponse | null>({
        url: `${resolveSireCompararUrl()}?${params.toString()}`,
        method: "GET",
        fallback: null,
      });

      if (!isSireCompareResponse(data)) {
        throw new Error("Respuesta de comparacion SIRE invalida");
      }

      const bdRows = Array.isArray(data.soloEnBd) ? data.soloEnBd : [];
      const sireRows = Array.isArray(data.soloEnSire) ? data.soloEnSire : [];
      setCompareResponse(data);
      setCompareRows([...bdRows, ...sireRows]);
      setSelectedBdKeys([]);
      setSunatValidationResponse(null);
      setSunatValidationRows([]);
      setCompareTab("diferencias");

      const totalDiff = bdRows.length + sireRows.length;
      if (totalDiff) {
        toast.info(`Comparacion lista. Diferencias: ${totalDiff}.`);
      } else {
        toast.success("Comparacion lista. No hay diferencias.");
      }
    } catch (error) {
      console.error("Error comparing SIRE sales records", error);
      setCompareResponse(null);
      setCompareRows([]);
      setSelectedBdKeys([]);
      setSunatValidationResponse(null);
      setSunatValidationRows([]);
      toast.error(
        "No se pudo completar la comparación SIRE. SUNAT podría estar demorado o temporalmente no disponible; intente nuevamente en unos minutos.",
      );
    } finally {
      setComparing(false);
    }
  };

  const validarSunat = async () => {
    const soloEnBd = selectedBdRows;

    if (!soloEnBd.length) {
      toast.info("Seleccione al menos un comprobante de BD para validar en SUNAT.");
      return;
    }

    setValidatingSunat(true);

    try {
      const data = await apiRequest<SireSunatValidationResponse | null>({
        url: resolveSireValidarSunatUrl(),
        method: "POST",
        data: { soloEnBd },
        fallback: null,
      });

      if (!isSireSunatValidationResponse(data)) {
        throw new Error("Respuesta de validacion SUNAT invalida");
      }

      const resultados = Array.isArray(data.resultados) ? data.resultados : [];
      setSunatValidationResponse(data);
      setSunatValidationRows(resultados);
      setCompareTab("sunat");

      const resumen = data.resumen;
      toast.success(
        `Validacion SUNAT lista. Existen: ${resumen?.existenEnSunat ?? 0}. No existen: ${
          resumen?.noExistenEnSunat ?? 0
        }.`,
      );
    } catch (error) {
      console.error("Error validating SIRE sales in SUNAT", error);
      setSunatValidationResponse(null);
      setSunatValidationRows([]);
      toast.error("No se pudo validar los comprobantes en SUNAT.");
    } finally {
      setValidatingSunat(false);
    }
  };

  const downloadWorkbook = async (
    workbook: Workbook,
    fileName: string,
    successMessage: string,
  ) => {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    toast.success(successMessage);
  };

  const buildSimpleWorkbook = <T,>(
    sheetName: string,
    columnsConfig: ExcelColumnConfig<T>[],
    exportRows: T[],
  ) => {
    const workbook = new Workbook();
    workbook.creator = "SGO";
    workbook.created = new Date();
    workbook.modified = new Date();

    const dataSheet = workbook.addWorksheet(sheetName, {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    dataSheet.columns = columnsConfig.map((column) => ({
      header: column.header,
      key: column.key,
      width: column.width,
    }));

    exportRows.forEach((row) => {
      dataSheet.addRow(
        columnsConfig.reduce(
          (acc, column) => {
            acc[column.key] = column.value(row);
            return acc;
          },
          {} as Record<string, string | number>,
        ),
      );
    });

    const headerRow = dataSheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFB23636" },
      };
      cell.alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
      };
    });

    for (let rowNumber = 2; rowNumber <= exportRows.length + 1; rowNumber += 1) {
      const excelRow = dataSheet.getRow(rowNumber);
      excelRow.height = 22;
      excelRow.eachCell((cell, colNumber) => {
        const config = columnsConfig[colNumber - 1];
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: config?.isMoney ? "right" : "left",
          wrapText: true,
        };
        if (config?.isMoney) {
          cell.numFmt = "#,##0.00";
        }
      });
    }

    dataSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columnsConfig.length },
    };
    dataSheet.pageSetup = {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };

    return workbook;
  };

  const exportExcel = async () => {
    const exportRows = filteredRows.length ? filteredRows : rows;
    if (!exportRows.length) {
      toast.info("No hay registros para exportar.");
      return;
    }

    try {
      const workbook = new Workbook();
      workbook.creator = "SGO";
      workbook.created = new Date();
      workbook.modified = new Date();

      const dataSheet = workbook.addWorksheet("Registros", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      dataSheet.columns = SIRE_COLUMN_KEYS.map((key) => ({
        header: headers[key] || DEFAULT_HEADERS[key],
        key,
        width: getExcelColumnWidth(key, headers[key] || DEFAULT_HEADERS[key]),
      }));

      exportRows.forEach((row) => {
        dataSheet.addRow(
          SIRE_COLUMN_KEYS.reduce(
            (acc, key) => {
              acc[key] = MONEY_COLUMNS.has(key)
                ? Number(parseAmount(row[key]).toFixed(2))
                : toExcelSafeText(row[key]);
              return acc;
            },
            {} as Record<SireRegistroKey, string | number>,
          ),
        );
      });

      const headerRow = dataSheet.getRow(1);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFB23636" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
      });

      for (let rowNumber = 2; rowNumber <= exportRows.length + 1; rowNumber += 1) {
        const excelRow = dataSheet.getRow(rowNumber);
        excelRow.height = 22;
        excelRow.eachCell((cell, colNumber) => {
          const key = SIRE_COLUMN_KEYS[colNumber - 1];
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
          cell.alignment = {
            vertical: "middle",
            horizontal: MONEY_COLUMNS.has(key) ? "right" : "left",
            wrapText: key === "col013" || key === "col004",
          };
          if (MONEY_COLUMNS.has(key)) {
            cell.numFmt = "#,##0.00";
          }
        });
      }

      dataSheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: SIRE_COLUMN_KEYS.length },
      };
      dataSheet.pageSetup = {
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `sire-ventas-${toPeriodParam(period)}_${dateFrom}_${dateTo}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
      toast.success("Excel generado correctamente.");
    } catch (error) {
      console.error("Error exporting SIRE sales Excel", error);
      toast.error("No se pudo generar el Excel.");
    }
  };

  const exportCompareExcel = async () => {
    if (!compareRows.length) {
      toast.info("No hay diferencias para exportar.");
      return;
    }

    try {
      const workbook = buildSimpleWorkbook<SireCompareRow>(
        "Diferencias",
        [
          {
            header: "Origen",
            key: "origen",
            width: 12,
            value: (row) => toExcelSafeText(row.origen),
          },
          {
            header: "Fecha",
            key: "fecha",
            width: 14,
            value: (row) => toExcelSafeText(row.fecha),
          },
          {
            header: "Tipo",
            key: "tipoDocumento",
            width: 10,
            value: (row) => toExcelSafeText(row.tipoDocumento),
          },
          {
            header: "Serie",
            key: "serie",
            width: 12,
            value: (row) => toExcelSafeText(row.serie),
          },
          {
            header: "Numero",
            key: "numero",
            width: 14,
            value: (row) => toExcelSafeText(row.numero),
          },
          {
            header: "Numero normalizado",
            key: "numeroNormalizado",
            width: 18,
            value: (row) => toExcelSafeText(row.numeroNormalizado),
          },
          {
            header: "Clave",
            key: "clave",
            width: 18,
            value: (row) => toExcelSafeText(row.clave),
          },
          {
            header: "Monto",
            key: "monto",
            width: 14,
            value: (row) => Number(parseAmount(row.monto).toFixed(2)),
            isMoney: true,
          },
          {
            header: "Estado",
            key: "estado",
            width: 16,
            value: (row) => toExcelSafeText(row.estado),
          },
        ],
        compareRows,
      );

      await downloadWorkbook(
        workbook,
        `sire-comparacion-${toPeriodParam(period)}_${serie || "serie"}_${dateFrom}_${dateTo}.xlsx`,
        "Excel de diferencias generado correctamente.",
      );
    } catch (error) {
      console.error("Error exporting SIRE comparison Excel", error);
      toast.error("No se pudo generar el Excel de diferencias.");
    }
  };

  const exportSunatExcel = async () => {
    if (!sunatValidationRows.length) {
      toast.info("No hay resultados SUNAT para exportar.");
      return;
    }

    try {
      const workbook = buildSimpleWorkbook<SireSunatValidationResult>(
        "Validacion SUNAT",
        [
          {
            header: "Existe en SUNAT",
            key: "existeEnSunat",
            width: 16,
            value: (row) =>
              safeText(row.error)
                ? "ERROR"
                : row.existeEnSunat
                  ? "SI"
                  : "NO",
          },
          {
            header: "Consultado",
            key: "consultado",
            width: 12,
            value: (row) => (row.consultado ? "SI" : "NO"),
          },
          {
            header: "Tipo",
            key: "tipoDocumento",
            width: 10,
            value: (row) => toExcelSafeText(row.documento?.tipoDocumento),
          },
          {
            header: "Serie",
            key: "serie",
            width: 12,
            value: (row) => toExcelSafeText(row.documento?.serie),
          },
          {
            header: "Numero",
            key: "numero",
            width: 14,
            value: (row) => toExcelSafeText(row.documento?.numero),
          },
          {
            header: "Fecha emision",
            key: "fechaEmision",
            width: 14,
            value: (row) => toExcelSafeText(row.documento?.fechaEmision),
          },
          {
            header: "Monto",
            key: "monto",
            width: 14,
            value: (row) => Number(parseAmount(row.documento?.monto).toFixed(2)),
            isMoney: true,
          },
          {
            header: "Codigo",
            key: "codigo",
            width: 10,
            value: (row) => toExcelSafeText(row.codigo),
          },
          {
            header: "Mensaje",
            key: "mensaje",
            width: 42,
            value: (row) => toExcelSafeText(row.mensaje),
          },
          {
            header: "HTTP",
            key: "statusCode",
            width: 10,
            value: (row) => toExcelSafeText(row.statusCode),
          },
          {
            header: "Error",
            key: "error",
            width: 32,
            value: (row) => toExcelSafeText(row.error),
          },
        ],
        sunatValidationRows,
      );

      await downloadWorkbook(
        workbook,
        `sire-validacion-sunat-${toPeriodParam(period)}_${serie || "serie"}_${dateFrom}_${dateTo}.xlsx`,
        "Excel de validacion SUNAT generado correctamente.",
      );
    } catch (error) {
      console.error("Error exporting SIRE SUNAT validation Excel", error);
      toast.error("No se pudo generar el Excel de validacion SUNAT.");
    }
  };

  return (
    <HookForm methods={filterMethods} onSubmit={() => undefined} preventSubmitOnEnter>
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
          <BackArrowButton fallbackTo="/accounting" />
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#B23636]/10 text-[#B23636]">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-slate-950">
                SIRE ventas
              </h1>
              <p className="text-sm text-slate-600">
                Registros exportados de ventas por periodo tributario.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryTile label="Registros" value={String(totals.count)} />
            <SummaryTile label="BI S/" value={formatMoney(totals.base)} />
            <SummaryTile label="IGV S/" value={formatMoney(totals.igv)} />
            <SummaryTile label="Total S/" value={formatMoney(totals.total)} highlight />
          </div>
        </div>
      </section>

      <div className="rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === "registros"
                ? "bg-[#B23636]/10 text-[#B23636]"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            onClick={() => setActiveTab("registros")}
          >
            Registros SIRE
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === "comparacion"
                ? "bg-[#B23636]/10 text-[#B23636]"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            onClick={() => setActiveTab("comparacion")}
          >
            Comparacion
          </button>
        </div>
      </div>

      {activeTab === "registros" ? (
      <DataTable
        data={rows}
        columns={columns as ColumnDef<SireVentaRegistro, unknown>[]}
        isLoading={loading}
        emptyMessage={response ? "No hay registros SIRE en el rango seleccionado." : "Selecciona los filtros y presiona Buscar."}
        searchPlaceholder="Buscar por RUC, cliente, serie, numero, CAR SUNAT..."
        filterKeys={SIRE_COLUMN_KEYS}
        onFilteredDataChange={setFilteredRows}
        initialPageSize={20}
        pageSizeOptions={[10, 20, 50, 100]}
        tableMaxHeight="62vh"
        renderFilters={
          <div className="w-full">
            <div className="flex w-full flex-col gap-2 md:flex-row md:flex-wrap md:items-end md:justify-end">
              <div className="min-w-[140px]"><HookFormInput<SireFilters> name="period" label="Periodo" type="month" onChange={(event) => handlePeriodChange(event.target.value)} /></div>
              <div className="min-w-[150px]"><HookFormInput<SireFilters> name="dateFrom" label="Fecha inicio" type="date" /></div>
              <div className="min-w-[150px]"><HookFormInput<SireFilters> name="dateTo" label="Fecha fin" type="date" /></div>
              <button
                type="button"
                onClick={() => void fetchRegistros()}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Buscar
              </button>
              <button
                type="button"
                onClick={() => void exportExcel()}
                disabled={loading || !rows.length}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                Excel
              </button>
            </div>
          </div>
        }
        footerContent={
          <div className="flex flex-col gap-3 text-sm text-slate-600 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Periodo SUNAT:{" "}
                <strong>{response?.periodo ?? toPeriodParam(period)}</strong>
              </span>
              <span className="hidden text-slate-300 sm:inline">|</span>
              <span>
                Ticket: <strong>{response?.numTicket || "-"}</strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span>
                Archivo:{" "}
                <strong>{response?.archivo?.nomArchivoContenido || "-"}</strong>
              </span>
              <span className="hidden text-slate-300 sm:inline">|</span>
              <span>
                Total archivo:{" "}
                <strong>{response?.archivo?.totalRegistros ?? rows.length}</strong>
              </span>
            </div>
          </div>
        }
      />
      ) : (
        <section className="space-y-3">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Comparacion SIRE
                </h2>
                <p className="text-sm text-slate-600">
                  Cruza comprobantes entre BD y SIRE por periodo, fecha, tipo y serie.
                </p>
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-end md:justify-end">
                <div className="min-w-[140px]"><HookFormInput<SireFilters> name="period" label="Periodo" type="month" onChange={(event) => handlePeriodChange(event.target.value)} /></div>
                <div className="min-w-[150px]"><HookFormInput<SireFilters> name="dateFrom" label="Fecha inicio" type="date" /></div>
                <div className="min-w-[150px]"><HookFormInput<SireFilters> name="dateTo" label="Fecha fin" type="date" /></div>
                <div className="min-w-[110px]"><HookFormInput<SireFilters> name="tipoCodigo" label="Tipo" maxLength={2} placeholder="03" /></div>
                <div className="min-w-[120px]"><HookFormInput<SireFilters> name="serie" label="Serie" placeholder="BA02" onChange={(event) => filterMethods.setValue("serie", event.target.value.toUpperCase())} /></div>
                <button
                  type="button"
                  onClick={() => void compareRegistros()}
                  disabled={comparing || !tipoCodigo.trim() || !serie.trim()}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {comparing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Comparar
                </button>
              </div>
            </div>
          </div>

          {compareResponse ? (
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-slate-950">
                    Resultado
                  </h3>
                  <p className="text-sm text-slate-600">
                    {compareResponse.serie || serie} - Tipo{" "}
                    {compareResponse.tipoCodigo || tipoCodigo}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[720px] xl:grid-cols-[1.3fr_repeat(3,1fr)]">
                  <SummaryTile
                    label="Diferencias"
                    value={String(compareSummary.totalDiff)}
                    hint={countGapLabel}
                    highlight={compareSummary.totalDiff > 0}
                  />
                  <SummaryTile
                    label="Solo BD"
                    value={String(compareSummary.onlyBd)}
                    hint="Faltan en SIRE"
                  />
                  <SummaryTile
                    label="Solo SIRE"
                    value={String(compareSummary.onlySire)}
                    hint="Faltan en BD"
                  />
                  <SummaryTile
                    label="Monto neto S/"
                    value={formatMoney(compareSummary.amountGap)}
                    hint="BD faltante - SIRE faltante"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 xl:w-[360px]">
                  <SummaryTile
                    label="BD"
                    value={String(compareSummary.totalBd)}
                  />
                  <SummaryTile
                    label="SIRE"
                    value={String(compareSummary.totalSire)}
                  />
                  <SummaryTile
                    label="En ambos"
                    value={String(compareSummary.totalEnAmbos)}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              <button
                type="button"
                className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                  compareTab === "diferencias"
                    ? "bg-[#B23636]/10 text-[#B23636]"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                onClick={() => setCompareTab("diferencias")}
              >
                Diferencias ({compareSummary.totalDiff})
              </button>
              <button
                type="button"
                className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                  compareTab === "sunat"
                    ? "bg-[#B23636]/10 text-[#B23636]"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                onClick={() => setCompareTab("sunat")}
              >
                Validacion SUNAT
              </button>
            </div>
          </div>

          {compareTab === "diferencias" ? (
            <>
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="text-sm text-slate-600">
                    Seleccionados para SUNAT:{" "}
                    <strong className="text-slate-900">
                      {selectedBdRows.length}
                    </strong>{" "}
                    de <strong>{selectableBdRows.length}</strong>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={
                        allSelectableBdRowsSelected
                          ? clearBdSelection
                          : selectAllBdRows
                      }
                      disabled={!selectableBdRows.length}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {allSelectableBdRowsSelected
                        ? "Limpiar seleccion"
                        : "Seleccionar BD"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void validarSunat()}
                      disabled={validatingSunat || selectedBdRows.length === 0}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {validatingSunat ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      Validar seleccionados
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportCompareExcel()}
                      disabled={!compareRows.length || comparing}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download className="h-4 w-4" />
                      Excel
                    </button>
                  </div>
                </div>
              </div>

              <DataTable
                data={compareRows}
                columns={compareColumns as ColumnDef<SireCompareRow, unknown>[]}
                isLoading={comparing}
                emptyMessage={
                  compareResponse
                    ? "No hay diferencias para mostrar."
                    : "Ejecuta una comparacion para ver diferencias."
                }
                searchPlaceholder="Buscar diferencia por serie, numero, clave o estado..."
                filterKeys={["origen", "serie", "numero", "clave", "fecha", "estado"]}
                initialPageSize={20}
                pageSizeOptions={[10, 20, 50, 100]}
                tableMaxHeight="48vh"
                showSearch
              />
            </>
          ) : (
            <>
              {sunatValidationResponse ? (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">
                        Validacion SUNAT
                      </h3>
                      <p className="text-sm text-slate-600">
                        Consulta de comprobantes seleccionados de BD.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void exportSunatExcel()}
                      disabled={!sunatValidationRows.length || validatingSunat}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Download className="h-4 w-4" />
                      Excel
                    </button>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                      <SummaryTile
                        label="Total"
                        value={String(sunatValidationResponse.resumen?.total ?? 0)}
                      />
                      <SummaryTile
                        label="Consultados"
                        value={String(
                          sunatValidationResponse.resumen?.consultados ?? 0,
                        )}
                      />
                      <SummaryTile
                        label="Existen"
                        value={String(
                          sunatValidationResponse.resumen?.existenEnSunat ?? 0,
                        )}
                      />
                      <SummaryTile
                        label="No existen"
                        value={String(
                          sunatValidationResponse.resumen?.noExistenEnSunat ?? 0,
                        )}
                        highlight
                      />
                      <SummaryTile
                        label="Errores"
                        value={String(
                          sunatValidationResponse.resumen?.conError ?? 0,
                        )}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              <DataTable
                data={sunatValidationRows}
                columns={
                  sunatColumns as ColumnDef<SireSunatValidationResult, unknown>[]
                }
                isLoading={validatingSunat}
                emptyMessage={
                  sunatValidationResponse
                    ? "No hay resultados de validacion SUNAT."
                    : "Selecciona comprobantes en Diferencias y valida en SUNAT."
                }
                searchPlaceholder="Buscar por serie, numero, mensaje o error..."
                filterKeys={["documento", "codigo", "mensaje", "error"]}
                initialPageSize={20}
                pageSizeOptions={[10, 20, 50, 100]}
                tableMaxHeight="48vh"
                showSearch
              />
            </>
          )}
        </section>
      )}
    </div>
    </HookForm>
  );
}

function SummaryTile({
  label,
  value,
  hint,
  highlight = false,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        highlight
          ? "border-[#B23636]/25 bg-[#B23636]/10"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <p
        className={`text-xs ${highlight ? "text-[#B23636]/80" : "text-slate-500"}`}
      >
        {label}
      </p>
      <p
        className={`text-lg font-semibold ${
          highlight ? "text-[#B23636]" : "text-slate-800"
        }`}
      >
        {value}
      </p>
      {hint ? (
        <p className={`text-xs ${highlight ? "text-[#B23636]" : "text-slate-500"}`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
