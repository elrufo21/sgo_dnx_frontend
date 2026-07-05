import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { createColumnHelper } from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { esES } from "@mui/x-date-pickers/locales";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/es";
import { Eye, FilePlus2, Search } from "lucide-react";
import DataTable from "@/components/DataTable";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import { toast } from "@/shared/ui/toast";
import { useServiceInvoicesStore } from "@/store/serviceInvoices/serviceInvoices.store";
import type { ServiceInvoiceListItem } from "@/types/serviceInvoice";

const columnHelper = createColumnHelper<ServiceInvoiceListItem>();

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const normalizeInvoiceEstado = (estado?: string) =>
  String(estado ?? "")
    .trim()
    .toUpperCase();

const isAnnulledInvoice = (row: ServiceInvoiceListItem) =>
  normalizeInvoiceEstado(row.compra.estado) === "ANULADO";

const annulledRowClassName =
  "bg-red-50 text-red-800 border-red-200 hover:bg-red-100/80";

export default function ServiceInvoiceList() {
  const { invoices, loading, error, fetchInvoices } = useServiceInvoicesStore();
  const initialRange = useMemo(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    return {
      from: getLocalDateISO(firstDay),
      to: getLocalDateISO(lastDay),
    };
  }, []);
  const [estado] = useState("");
  const [fechaInicio, setFechaInicio] = useState(initialRange.from);
  const [fechaFin, setFechaFin] = useState(initialRange.to);
  const fechaInicioRef = useRef(fechaInicio);
  const fechaFinRef = useRef(fechaFin);
  const estadoRef = useRef(estado);
  const endDateAcceptedRef = useRef(false);
  const lastFetchedRangeRef = useRef<{
    from: string;
    to: string;
    estado: string;
  } | null>({
    from: initialRange.from,
    to: initialRange.to,
    estado,
  });

  useEffect(() => {
    fechaInicioRef.current = fechaInicio;
  }, [fechaInicio]);

  useEffect(() => {
    fechaFinRef.current = fechaFin;
  }, [fechaFin]);

  useEffect(() => {
    estadoRef.current = estado;
  }, [estado]);

  const requestInvoicesByRange = useCallback(
    (fromValue: string, toValue: string, estadoValue = estadoRef.current) => {
      const from = String(fromValue ?? "").trim();
      const to = String(toValue ?? "").trim();
      const estadoFilter = String(estadoValue ?? "").trim();

      if (!from || !to) {
        toast.error("Debes seleccionar fecha inicio y fecha fin.");
        return false;
      }

      if (from > to) {
        toast.error("La fecha inicio no puede ser mayor que la fecha fin.");
        return false;
      }

      void fetchInvoices({
        estado: estadoFilter,
        fechaInicio: from,
        fechaFin: to,
      });
      lastFetchedRangeRef.current = { from, to, estado: estadoFilter };
      return true;
    },
    [fetchInvoices],
  );

  useEffect(() => {
    requestInvoicesByRange(fechaInicioRef.current, fechaFinRef.current);
  }, [requestInvoicesByRange]);

  const handleSearch = useCallback(() => {
    requestInvoicesByRange(fechaInicio, fechaFin, estado);
  }, [estado, fechaFin, fechaInicio, requestInvoicesByRange]);

  const parsePickerDate = useCallback((value: Dayjs | null) => {
    const formatted = value?.format("YYYY-MM-DD") ?? "";
    return formatted.trim();
  }, []);

  const columns = useMemo<ColumnDef<ServiceInvoiceListItem, unknown>[]>(
    () =>
      [
        columnHelper.accessor((row) => row.compra.compraId, {
          id: "id",
          header: "ID",
          cell: (info) => info.getValue(),
        }),
        columnHelper.accessor(
          (row) =>
            row.compra.nroComprobante ||
            `${row.compra.serie}-${row.compra.numero}`,
          {
            id: "comprobante",
            header: "Comprobante",
            cell: (info) => info.getValue(),
          },
        ),
        columnHelper.accessor((row) => row.compra.fechaEmision, {
          id: "fecha",
          header: "Fecha",
          cell: (info) => info.getValue() || "-",
        }),
        columnHelper.accessor((row) => row.compra.compraConcepto, {
          id: "concepto",
          header: "Concepto",
          cell: (info) => info.getValue() || "SERVICIO",
        }),
        columnHelper.accessor((row) => row.compra.clienteRazon, {
          id: "cliente",
          header: "Cliente",
          cell: (info) => info.getValue() || "-",
        }),
        columnHelper.display({
          id: "estado",
          header: "Estado",
          cell: ({ row }) => {
            const estado = normalizeInvoiceEstado(row.original.compra.estado);
            if (!estado) return "-";

            const isAnnulled = estado === "ANULADO";
            const badgeClass = isAnnulled
              ? "bg-red-100 text-red-700 border-red-200"
              : "bg-emerald-100 text-emerald-700 border-emerald-200";

            return (
              <span
                className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass}`}
              >
                {estado}
              </span>
            );
          },
        }),
        columnHelper.accessor((row) => row.compra.estadoSunat ?? "", {
          id: "estadoSunat",
          header: "SUNAT",
          cell: (info) => info.getValue() || "-",
        }),
        columnHelper.accessor((row) => row.compra.total, {
          id: "total",
          header: "Total",
          cell: (info) => formatMoney(info.getValue()),
          meta: { align: "right" },
        }),
        columnHelper.accessor((row) => row.compra.saldo ?? 0, {
          id: "saldo",
          header: "Saldo",
          cell: (info) => formatMoney(info.getValue()),
          meta: { align: "right" },
        }),
        columnHelper.display({
          id: "acciones",
          header: "",
          cell: ({ row }) => (
            <Link
              to={`/service-invoices/${row.original.compra.compraId}`}
              title="Ver factura"
              className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              aria-label="Ver factura"
            >
              <Eye className="h-4 w-4" />
            </Link>
          ),
          meta: { align: "right" },
        }),
      ] as ColumnDef<ServiceInvoiceListItem, unknown>[],
    [],
  );

  return (
    <div className="space-y-4 p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackArrowButton fallbackTo="/shopping" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              Facturas de servicio
            </h1>
            <p className="text-sm text-slate-500">
              Facturas de servicio enviadas al OSE
            </p>
          </div>
        </div>
      </div>

      <DataTable
        data={invoices}
        columns={columns}
        isLoading={loading}
        filterKeys={[]}
        searchPlaceholder="Buscar comprobante o servicio..."
        emptyMessage="No hay facturas de servicio."
        initialPageSize={50}
        rowClassName={(row) =>
          isAnnulledInvoice(row) ? annulledRowClassName : undefined
        }
        tdClassName={(cell) =>
          isAnnulledInvoice(cell.row.original) ? "text-red-800" : undefined
        }
        toolbarLeading={undefined}
        toolbarAction={
          <Link
            to="/service-invoices/create"
            title="Nueva factura"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#B23636] px-3 text-sm font-semibold text-white shadow-sm hover:bg-[#96312a]"
          >
            <FilePlus2 className="h-5 w-5" />
            Nueva
          </Link>
        }
        footerContent={
          error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null
        }
        renderFilters={
          <LocalizationProvider
            dateAdapter={AdapterDayjs}
            adapterLocale="es"
            localeText={
              esES.components.MuiLocalizationProvider.defaultProps.localeText
            }
          >
            <div className="flex w-full flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 xl:w-auto">
              <label className="flex min-w-[160px] flex-col gap-1 text-xs text-slate-600">
                Fecha Inicio
                <DatePicker
                  format="DD/MM/YY"
                  value={fechaInicio ? dayjs(fechaInicio) : null}
                  onChange={(value) => {
                    setFechaInicio(parsePickerDate(value));
                  }}
                  slotProps={{
                    textField: {
                      size: "small",
                      sx: {
                        width: "100%",
                        "& .MuiOutlinedInput-root": {
                          height: 44,
                          borderRadius: "0.5rem",
                          backgroundColor: "#ffffff",
                        },
                      },
                    },
                  }}
                />
              </label>

              <label className="flex min-w-[160px] flex-col gap-1 text-xs text-slate-600">
                Fecha Fin
                <DatePicker
                  format="DD/MM/YY"
                  value={fechaFin ? dayjs(fechaFin) : null}
                  onOpen={() => {
                    endDateAcceptedRef.current = false;
                  }}
                  onChange={(value) => {
                    setFechaFin(parsePickerDate(value));
                  }}
                  onAccept={(value) => {
                    const nextValue = parsePickerDate(value);
                    endDateAcceptedRef.current = true;
                    setFechaFin(nextValue);
                    requestInvoicesByRange(
                      fechaInicioRef.current,
                      nextValue,
                      estadoRef.current,
                    );
                  }}
                  onClose={() => {
                    if (endDateAcceptedRef.current) {
                      endDateAcceptedRef.current = false;
                      return;
                    }

                    const currentStart = fechaInicioRef.current;
                    const currentEnd = fechaFinRef.current;
                    const currentEstado = estadoRef.current;
                    const lastRange = lastFetchedRangeRef.current;
                    const mustFetch =
                      !lastRange ||
                      lastRange.from !== currentStart ||
                      lastRange.to !== currentEnd ||
                      lastRange.estado !== currentEstado;

                    if (mustFetch) {
                      requestInvoicesByRange(
                        currentStart,
                        currentEnd,
                        currentEstado,
                      );
                    }
                  }}
                  slotProps={{
                    textField: {
                      size: "small",
                      sx: {
                        width: "100%",
                        "& .MuiOutlinedInput-root": {
                          height: 44,
                          borderRadius: "0.5rem",
                          backgroundColor: "#ffffff",
                        },
                      },
                    },
                  }}
                />
              </label>

              <div className="relative group">
                <button
                  type="button"
                  onClick={handleSearch}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white transition-colors hover:bg-slate-700"
                  aria-label="Buscar"
                >
                  <Search className="h-4 w-4" />
                </button>
                <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                  Buscar
                </span>
              </div>
            </div>
          </LocalizationProvider>
        }
      />
    </div>
  );
}
