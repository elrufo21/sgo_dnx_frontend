import DataTable from "@/components/DataTable";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { useCashFlowStore } from "@/store/cashFlow/cashFlow.store";
import type { CashFlow } from "@/types/cashFlow";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Eye, PlusIcon } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";

const formatDate = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-PE");
};

const CashFlowList = () => {
  const { flows, fetchFlows, loading, selectCashForClosing } = useCashFlowStore();
  const navigate = useNavigate();
  const columnHelper = createColumnHelper<CashFlow>();

  useEffect(() => {
    void fetchFlows();
  }, [fetchFlows]);

  const columns = [
    columnHelper.accessor("id", { header: "Caja" }),
    columnHelper.accessor("encargado", { header: "Responsable" }),
    columnHelper.accessor("montoInicial", {
      header: "Monto inicial",
      cell: (info) => `S/ ${info.getValue().toFixed(2)}`,
      meta: { tdClassName: "text-right" },
    }),
    columnHelper.accessor("fechaApertura", {
      header: "Apertura",
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("fechaCierre", {
      header: "Cierre",
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("estado", {
      header: "Estado",
      cell: (info) => {
        const activa = info.getValue().trim().toUpperCase() === "ACTIVO";
        return (
          <span className={`rounded border px-2 py-1 text-xs font-medium ${activa ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
            {activa ? "ABIERTA" : info.getValue() || "-"}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: "acciones",
      header: "Acciones",
      cell: ({ row }) => {
        const caja = row.original;
        const activa = caja.estado.trim().toUpperCase() === "ACTIVO";
        if (!activa) return <span className="text-xs text-slate-400">-</span>;

        return (
          <button
            type="button"
            onClick={() => {
              selectCashForClosing(caja.id);
              navigate("/cash_flow_control/create");
            }}
            title="Ver caja"
            aria-label="Ver caja"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100"
          >
            <Eye className="h-4 w-4" />
          </button>
        );
      },
    }),
  ] as unknown as ColumnDef<CashFlow, unknown>[];

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-3">
        <h1 className="text-2xl font-semibold text-[#0f2748]">Flujo de Caja</h1>
        <p className="text-sm text-slate-500">Aperturas registradas.</p>
      </div>

      <DataTable
        columns={columns}
        data={flows}
        isLoading={loading}
        emptyMessage="No hay cajas registradas"
        toolbarLeading={<BackArrowButton className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-100" />}
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
