import DataTable from "@/components/DataTable";
import { BlockingSpinner } from "@/components/common/BlockingSpinner";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import { useAuthStore } from "@/store/auth/auth.store";
import { createColumnHelper } from "@tanstack/react-table";
import { Workbook } from "exceljs";
import { FileSpreadsheet } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

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
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const estadoSunat = "PENDIENTE";
  const [rows, setRows] = useState<InvoiceDispatchRow[]>([]);
  const [loading, setLoading] = useState(false);

  const loadInvoices = useCallback(
    async () => {
      setLoading(true);
      try {
        const allRows: InvoiceDispatchRow[] = [];
        for (let page = 1; ; page += 1) {
          const query = new URLSearchParams({
            soloServicio: "false",
            pendientesOse: "true",
            page: String(page),
            pageSize: String(PAGE_SIZE),
          });
          const companyId = safeNumber(user?.companyId);
          if (companyId > 0) query.set("companiaId", String(companyId));
          query.set("estadoSunat", estadoSunat);

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

        setRows(
          allRows.sort(
            (left, right) =>
              left.docuId - right.docuId ||
              left.comprobante.localeCompare(right.comprobante, undefined, {
                numeric: true,
              }),
          ),
        );
      } catch (error) {
        console.error("Error cargando facturas OSE", error);
        setRows([]);
        toast.error("No se pudo cargar facturas.");
      } finally {
        setLoading(false);
      }
    },
    [user?.companyId],
  );

  useEffect(() => {
    void loadInvoices();
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

  const exportExcel = useCallback(async () => {
    if (!rows.length) {
      toast.info("No hay pendientes para exportar en Excel.");
      return;
    }

    const workbook = new Workbook();
    workbook.creator = "SGO";
    const worksheet = workbook.addWorksheet("Pendientes OSE", {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    worksheet.columns = [
      { header: "Comprobante", key: "comprobante", width: 20 },
      { header: "Fecha", key: "fechaEmision", width: 18 },
      { header: "Cliente", key: "cliente", width: 38 },
      { header: "RUC/DNI", key: "documentoCliente", width: 16 },
      { header: "Total", key: "total", width: 14 },
      { header: "Estado", key: "estado", width: 16 },
      { header: "SUNAT", key: "estadoSunat", width: 14 },
      { header: "Código", key: "codigoSunat", width: 14 },
      { header: "Mensaje", key: "mensajeSunat", width: 42 },
    ];
    worksheet.getColumn("total").numFmt = "#,##0.00";
    worksheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "B23636" },
    };
    rows.forEach((row) => worksheet.addRow(row));

    const buffer = await workbook.xlsx.writeBuffer();
    const objectUrl = URL.createObjectURL(
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "pendientes-ose.xlsx";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1200);
    toast.success("Excel generado correctamente.");
  }, [rows]);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "ver",
        header: "Ver",
        cell: ({ row }) => {
          const noteId = row.original.notaId;
          return noteId ? (
            <button
              type="button"
              className="text-sm font-medium text-blue-600 hover:underline"
              onClick={() => {
                navigate(`/sales/html_capture/${noteId}`, {
                  state: {
                    invoiceDispatch: {
                      docuId: row.original.docuId,
                      estadoSunat: row.original.estadoSunat,
                    },
                  },
                });
              }}
            >
              Ver
            </button>
          ) : (
            <span className="text-slate-400">-</span>
          );
        },
      }),
      columnHelper.accessor("comprobante", {
        header: "Comprobante",
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
    [navigate],
  );

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <BlockingSpinner
        show={loading}
        text="Cargando documentos pendientes de envío..."
      />
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid w-full grid-cols-[auto_auto] gap-2 xl:w-auto">
            <div className="shrink-0">
              <BackArrowButton
                fallbackTo="/accounting"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-black transition-colors hover:bg-slate-100"
              />
            </div>
            <button
              type="button"
              onClick={() => void exportExcel()}
              disabled={loading || !rows.length}
              className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-md border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:w-72">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase text-slate-500">
                Pendientes OSE
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
        showSearch={false}
        emptyMessage="No hay facturas ni notas de crédito pendientes de envío a OSE."
        initialPageSize={50}
        tableMaxHeight="68vh"
      />
    </div>
  );
}
