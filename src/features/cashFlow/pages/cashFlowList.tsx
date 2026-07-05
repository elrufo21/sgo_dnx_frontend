import DataTable from "@/components/DataTable";
import { useCashFlowStore } from "@/store/cashFlow/cashFlow.store";
import type { CashFlow } from "@/types/cashFlow";
import { createColumnHelper } from "@tanstack/react-table";
import { Pencil, PlusIcon, Trash2 } from "lucide-react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";
import { formatDate } from "@/shared/helpers/formatDate";
import { BackArrowButton } from "@/components/common/BackArrowButton";

const CashFlowList = () => {
  const { flows, fetchFlows, deleteFlow, loading } = useCashFlowStore();
  const navigate = useNavigate();
  const columnHelper = createColumnHelper<CashFlow>();

  useEffect(() => {
    fetchFlows();
  }, [fetchFlows]);

  // Función para calcular totales de cada flujo
  const calcularTotales = (flow: CashFlow) => {
    const totalEfectivo = flow.conteoMonedas.reduce(
      (sum, item) => sum + item.cantidad * item.denominacion,
      0
    );
    const totalIngresos = flow.ingresos.reduce(
      (sum, item) => sum + item.importe,
      0
    );
    const totalGastos = flow.gastos.reduce(
      (sum, item) => sum + item.importe,
      0
    );
    const efectivoCaja = totalEfectivo + totalIngresos - totalGastos;
    const ventasTotal =
      flow.ventaTotal.efectivo +
      flow.ventaTotal.tarjeta +
      flow.ventaTotal.deposito;
    const total = ventasTotal - totalGastos;

    return { totalEfectivo, efectivoCaja, ventasTotal, total };
  };

  const columns = [
    columnHelper.accessor("id", {
      header: "ID",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("caja", {
      header: "Caja",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("encargado", {
      header: "Encargado",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("sencillo", {
      header: "Sencillo",
      cell: (info) => `S/ ${info.getValue().toFixed(2)}`,
    }),
    columnHelper.accessor("estado", {
      header: "Estado",
      cell: (info) => {
        const estado = info.getValue();
        return (
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              estado === "ABIERTA"
                ? "bg-green-100 text-green-700 border border-green-200"
                : "bg-red-100 text-red-700 border border-red-200"
            }`}
          >
            {estado}
          </span>
        );
      },
    }),
    columnHelper.accessor("fechaApertura", {
      header: "Fecha Apertura",
      cell: (info) => formatDate(info.getValue()),
    }),
    columnHelper.accessor("fechaCierre", {
      header: "Fecha Cierre",
      cell: (info) => (info.getValue() ? formatDate(info.getValue()) : "-"),
    }),
    columnHelper.display({
      id: "efectivoCaja",
      header: "Efectivo en Caja",
      cell: ({ row }) => {
        const { efectivoCaja } = calcularTotales(row.original);
        return (
          <span className="font-medium text-gray-700">
            S/ {efectivoCaja.toFixed(2)}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: "ventasTotal",
      header: "Ventas Total",
      cell: ({ row }) => {
        const { ventasTotal } = calcularTotales(row.original);
        return (
          <span className="font-medium text-blue-700">
            S/ {ventasTotal.toFixed(2)}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: "total",
      header: "Total",
      cell: ({ row }) => {
        const { total } = calcularTotales(row.original);
        return (
          <span className="font-bold text-slate-800">
            S/ {total.toFixed(2)}
          </span>
        );
      },
    }),
    columnHelper.accessor("id", {
      id: "actions",
      header: "Acciones",
      cell: (info) => {
        const id = info.getValue();
        return (
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/cash_flow_control/${id}/edit`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100"
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </Link>

            <button
              onClick={() => {
                if (
                  window.confirm(
                    "¿Estás seguro de eliminar este flujo de caja?"
                  )
                ) {
                  deleteFlow(id);
                  toast.success("Flujo de caja eliminado correctamente");
                }
              }}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition-colors hover:bg-red-100"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        );
      },
    }),
  ];

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-gray-600 text-lg">Cargando flujos de caja...</div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-3">
        <h1 className="text-2xl font-semibold text-[#0f2748]">Flujo de Caja</h1>
      </div>

      {flows.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-gray-500 mb-4">
            No hay flujos de caja registrados
          </p>
          <button
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded transition-colors"
            onClick={() => navigate("/cash_flow_control/create")}
          >
            Crear el primero
          </button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={flows}
          toolbarLeading={
            <BackArrowButton className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors" />
          }
          toolbarAction={
            <button
              type="button"
              onClick={() => navigate("/cash_flow_control/create")}
              title="Añadir Flujo de Caja"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#B23636] text-white hover:bg-[#96312a] transition-colors shadow-sm"
            >
              <PlusIcon className="h-5 w-5" />
            </button>
          }
        />
      )}
    </div>
  );
};

export default CashFlowList;
