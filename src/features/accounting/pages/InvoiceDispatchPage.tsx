import DataTable from "@/components/DataTable";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import { useAuthStore } from "@/store/auth/auth.store";
import { createColumnHelper } from "@tanstack/react-table";
import { Eye, RefreshCw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";

type InvoiceDispatchRow = {
  docuId: number;
  notaId: number | null;
  comprobante: string;
  fechaEmision: string;
  cliente: string;
  documentoCliente: string;
  total: number;
  estado: string;
  estadoSunat: string;
  codigoSunat: string;
  mensajeSunat: string;
};

const columnHelper = createColumnHelper<InvoiceDispatchRow>();
const PAGE_SIZE = 200;

const pad2 = (value: number) => String(value).padStart(2, "0");

const toLocalIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const safeText = (value: unknown, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseArrayResponse = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const candidate = Object.values(record).find(Array.isArray);
  return Array.isArray(candidate) ? candidate : [];
};

const mapInvoice = (item: unknown): InvoiceDispatchRow => {
  const row = (item ?? {}) as Record<string, unknown>;
  const serie = safeText(row.serie ?? row.docuSerie ?? row.DocuSerie);
  const numero = safeText(row.numero ?? row.docuNumero ?? row.DocuNumero);
  const comprobante =
    safeText(row.nroComprobante ?? row.NroComprobante) ||
    (serie && numero ? `${serie}-${numero}` : "-");
  const ruc = safeText(row.clienteRuc ?? row.ClienteRuc);
  const dni = safeText(row.clienteDni ?? row.ClienteDni);

  return {
    docuId: safeNumber(row.docuId ?? row.DocuId),
    notaId:
      row.notaId === null || row.NotaId === null
        ? null
        : safeNumber(row.notaId ?? row.NotaId) || null,
    comprobante,
    fechaEmision: safeText(row.fechaEmision ?? row.FechaEmision, "-"),
    cliente: safeText(row.clienteRazon ?? row.ClienteRazon, "-"),
    documentoCliente: ruc || dni || "-",
    total: safeNumber(row.total ?? row.Total),
    estado: safeText(row.docuEstado ?? row.DocuEstado, "-"),
    estadoSunat: safeText(row.estadoSunat ?? row.EstadoSunat, "PENDIENTE"),
    codigoSunat: safeText(row.codigoSunat ?? row.CodigoSunat),
    mensajeSunat: safeText(row.mensajeSunat ?? row.MensajeSunat),
  };
};

const formatMoney = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const estadoBadgeClass = (value: string) => {
  const normalized = value.toUpperCase();
  if (normalized.includes("RECHAZ")) return "border-red-200 bg-red-100 text-red-700";
  if (normalized.includes("PEND")) return "border-amber-200 bg-amber-100 text-amber-700";
  if (normalized.includes("ENVI") || normalized.includes("ACEPT")) {
    return "border-emerald-200 bg-emerald-100 text-emerald-700";
  }
  return "border-slate-200 bg-slate-100 text-slate-700";
};

export default function InvoiceDispatchPage() {
  const user = useAuthStore((state) => state.user);
  const todayIso = useMemo(() => toLocalIsoDate(new Date()), []);
  const firstDayOfMonthIso = useMemo(
    () => `${todayIso.slice(0, 8)}01`,
    [todayIso],
  );
  const [fechaInicio, setFechaInicio] = useState(firstDayOfMonthIso);
  const [fechaFin, setFechaFin] = useState(todayIso);
  const [estadoSunat, setEstadoSunat] = useState("");
  const [rows, setRows] = useState<InvoiceDispatchRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadInvoices = useCallback(
    async (notifyEmpty = false) => {
      const start = safeText(fechaInicio);
      const end = safeText(fechaFin);

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
        const allRows: InvoiceDispatchRow[] = [];
        for (let page = 1; ; page += 1) {
          const query = new URLSearchParams({
            fechaInicio: start,
            fechaFin: end,
            soloServicio: "false",
            page: String(page),
            pageSize: String(PAGE_SIZE),
          });
          const companyId = safeNumber(user?.companyId);
          const sunatState = safeText(estadoSunat);
          if (companyId > 0) query.set("companiaId", String(companyId));
          if (sunatState) query.set("estadoSunat", sunatState);

          const response = await apiRequest<unknown>({
            url: buildApiUrl(`/Nota/facturas-servicio?${query.toString()}`),
            method: "GET",
            config: { timeout: 20000 },
            fallback: [],
          });
          const pageRows = parseArrayResponse(response).map(mapInvoice);
          allRows.push(...pageRows);
          if (pageRows.length < PAGE_SIZE) break;
        }

        setRows(allRows);
        if (notifyEmpty && !allRows.length) {
          toast.info("No hay facturas en ese rango.");
        }
      } catch (error) {
        console.error("Error cargando facturas OSE", error);
        setRows([]);
        toast.error("No se pudo cargar facturas.");
      } finally {
        setLoading(false);
      }
    },
    [estadoSunat, fechaFin, fechaInicio, user?.companyId],
  );

  useEffect(() => {
    void loadInvoices(false);
  }, [loadInvoices]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => {
          acc.count += 1;
          acc.total += row.total;
          return acc;
        },
        { count: 0, total: 0 },
      ),
    [rows],
  );

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "abrir",
        header: "",
        cell: ({ row }) =>
          row.original.notaId ? (
            <Link
              to={`/sales/order_notes/${row.original.notaId}/view`}
              title="Abrir venta"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              aria-label="Abrir venta"
            >
              <Eye className="h-4 w-4" />
            </Link>
          ) : (
            <span className="text-slate-400">-</span>
          ),
      }),
      columnHelper.accessor("comprobante", {
        header: "Factura",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("fechaEmision", {
        header: "Fecha",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("cliente", {
        header: "Cliente",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("documentoCliente", {
        header: "RUC/DNI",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("total", {
        header: "Total",
        cell: (info) => formatMoney(info.getValue()),
        meta: { align: "right", tdClassName: "text-right" },
      }),
      columnHelper.accessor("estado", {
        header: "Estado",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("estadoSunat", {
        header: "SUNAT",
        cell: (info) => {
          const value = safeText(info.getValue(), "-");
          return (
            <span
              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${estadoBadgeClass(value)}`}
            >
              {value}
            </span>
          );
        },
      }),
      columnHelper.accessor("codigoSunat", {
        header: "Codigo",
        cell: (info) => info.getValue() || "-",
      }),
      columnHelper.accessor("mensajeSunat", {
        header: "Mensaje",
        cell: (info) => (
          <span className="line-clamp-2 min-w-52">{info.getValue() || "-"}</span>
        ),
      }),
    ],
    [],
  );

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5 xl:w-auto">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              F-Inicio
              <input
                type="date"
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
                value={fechaInicio}
                onChange={(event) => setFechaInicio(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              F-Fin
              <input
                type="date"
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
                value={fechaFin}
                onChange={(event) => setFechaFin(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              SUNAT
              <select
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
                value={estadoSunat}
                onChange={(event) => setEstadoSunat(event.target.value)}
              >
                <option value="">Todos</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="RECHAZADO">Rechazado</option>
                <option value="ENVIADO">Enviado</option>
              </select>
            </label>
            <button
              type="button"
              onClick={() => void loadInvoices(true)}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-md border border-slate-300 bg-slate-50 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              Buscar
            </button>
            <button
              type="button"
              onClick={() => void loadInvoices(false)}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:w-72">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Facturas
              </p>
              <p className="text-lg font-bold text-slate-900">{totals.count}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-right">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Total S/
              </p>
              <p className="text-lg font-bold text-slate-900">
                {formatMoney(totals.total)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <DataTable
        data={rows}
        columns={columns}
        isLoading={loading}
        filterKeys={[
          "comprobante",
          "cliente",
          "documentoCliente",
          "estado",
          "estadoSunat",
          "codigoSunat",
          "mensajeSunat",
        ]}
        searchPlaceholder="Buscar factura, cliente o estado..."
        emptyMessage="No hay facturas."
        initialPageSize={50}
        tableMaxHeight="68vh"
      />
    </div>
  );
}
