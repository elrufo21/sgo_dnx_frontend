import DataTable from "@/components/DataTable";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import { toast } from "@/shared/ui/toast";
import { useCashFlowStore } from "@/store/cashFlow/cashFlow.store";
import type { CashFlow } from "@/types/cashFlow";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { esES } from "@mui/x-date-pickers/locales";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/es";
import { Eye, PlusIcon, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

const formatDate = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-PE");
};
const formatAmount = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const CashFlowList = () => {
  const { flows, fetchFlows, loading } = useCashFlowStore();
  const navigate = useNavigate();
  const columnHelper = createColumnHelper<CashFlow>();
  const today = useMemo(() => getLocalDateISO(), []);
  const [fechaInicio, setFechaInicio] = useState(today);
  const [fechaFin, setFechaFin] = useState(today);

  const buscar = useCallback(() => {
    if (!fechaInicio || !fechaFin) {
      toast.error("Selecciona fecha inicio y fecha fin.");
      return;
    }
    if (fechaInicio > fechaFin) {
      toast.error("La fecha inicio no puede ser mayor que la fecha fin.");
      return;
    }
    void fetchFlows({ fechaInicio, fechaFin });
  }, [fechaFin, fechaInicio, fetchFlows]);

  useEffect(() => {
    buscar();
  }, [buscar]);

  const columns = [
    columnHelper.display({
      id: "ver",
      header: "Ver",
      cell: ({ row }) => {
        const caja = row.original;
        return (
          <button
            type="button"
            onClick={() => {
              navigate(`/cash_flow_control/view/${caja.id}`);
            }}
            title="Ver caja"
            aria-label="Ver caja"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100"
          >
            VER
          </button>
        );
      },
    }),
    columnHelper.accessor("fechaApertura", {
      header: "Fecha Apertura",
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("fechaCierre", {
      header: "Fecha Cierre",
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("montoInicial", {
      header: "Monto inic.",
      cell: (info) => formatAmount(info.getValue()),
      meta: { tdClassName: "text-right" },
    }),
    columnHelper.accessor("ingresos", {
      header: "Ingresos",
      cell: (info) => formatAmount(info.getValue()),
      meta: { tdClassName: "text-right" },
    }),
    columnHelper.accessor("salidas", {
      header: "Salidas",
      cell: (info) => formatAmount(info.getValue()),
      meta: { tdClassName: "text-right" },
    }),
    columnHelper.accessor("diferencia", {
      header: "Diferencia",
      cell: (info) => formatAmount(info.getValue()),
      meta: { tdClassName: "text-right" },
    }),
    columnHelper.accessor("encargado", { header: "Encargado" }),
    columnHelper.accessor("estado", {
      header: "Estado",
      cell: (info) => {
        const activa = info.getValue().trim().toUpperCase() === "ACTIVO";
        return (
          <span
            className={`rounded border px-2 py-1 text-xs font-medium ${activa ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}
          >
            {activa ? "ABIERTA" : info.getValue() || "-"}
          </span>
        );
      },
    }),
  ] as unknown as ColumnDef<CashFlow, unknown>[];

  return (
    <div className="p-3 sm:p-4">
      <DataTable
        columns={columns}
        data={flows}
        isLoading={loading}
        emptyMessage="No hay cajas registradas"
        searchPlaceholder="Buscar caja, encargado o estado..."
        filterKeys={["id", "encargado", "usuario", "estado"]}
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
                  onChange={(value: Dayjs | null) =>
                    setFechaInicio(value?.format("YYYY-MM-DD") ?? "")
                  }
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
                  onChange={(value: Dayjs | null) =>
                    setFechaFin(value?.format("YYYY-MM-DD") ?? "")
                  }
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
              <button
                type="button"
                onClick={buscar}
                disabled={loading}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
                aria-label="Buscar por fecha"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </LocalizationProvider>
        }
        toolbarAction={
          <button
            type="button"
            onClick={() => navigate("/cash_flow_control/create")}
            title="Abrir caja"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#B23636] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#96312a]"
          >
            <PlusIcon className="h-5 w-5" />
            Abrir caja
          </button>
        }
      />
    </div>
  );
};

export default CashFlowList;
