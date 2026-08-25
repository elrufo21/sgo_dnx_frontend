import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Pencil, PlusIcon, Trash2 } from "lucide-react";
import DataTable from "@/components/DataTable";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { useDialogStore } from "@/store/app/dialog.store";
import { useClientsStore } from "@/store/customers/customers.store";
import { toast } from "@/shared/ui/toast";
import type { Client } from "@/types/customer";

const columnHelper = createColumnHelper<Client>();
const fallback = (value: unknown) => String(value ?? "").trim() || "-";

const CustomerList = () => {
  const navigate = useNavigate();
  const openDialog = useDialogStore((s) => s.openDialog);
  const { clients, loading, fetchClients, deleteClient } = useClientsStore();
  const [estado, setEstado] = useState<"ACTIVO" | "INACTIVO">("ACTIVO");

  useEffect(() => {
    void fetchClients("");
  }, [fetchClients]);

  const filteredClients = useMemo(() => {
    return [...clients]
      .sort((a, b) => Number(b.id) - Number(a.id))
      .filter((client) => client.estado === estado);
  }, [clients, estado]);

  const askDelete = useCallback(
    (id: number) =>
      openDialog({
        title: "Eliminar cliente",
        content: <p>¿Seguro que deseas eliminar este cliente?</p>,
        onConfirm: async () => {
          const ok = await deleteClient(id);
          if (ok === false) {
            toast.error("No se puede eliminar.");
            return;
          }
          toast.success("Cliente eliminado.");
          void fetchClients("");
        },
      }),
    [deleteClient, fetchClients, openDialog],
  );

  const columns = useMemo<ColumnDef<Client, unknown>[]>(
    () => [
      columnHelper.accessor("clienteCodigo", {
        header: "Codigo",
        cell: (info) => fallback(info.getValue()),
      }),
      columnHelper.accessor("nombreRazon", {
        header: "Razon Social",
        cell: (info) => fallback(info.getValue()),
      }),
      columnHelper.accessor("ruc", {
        header: "RUC",
        cell: (info) => fallback(info.getValue()),
      }),
      columnHelper.accessor("dni", {
        header: "DNI",
        cell: (info) => fallback(info.getValue()),
      }),
      columnHelper.accessor("registradoPor", {
        header: "Usuario",
        cell: (info) => fallback(info.getValue()),
      }),
      columnHelper.accessor("documentoPredeterminado", {
        header: "Documento",
        cell: (info) => fallback(info.getValue()),
      }),
      columnHelper.accessor("email", {
        header: "Correo",
        cell: (info) => fallback(info.getValue()),
      }),
      columnHelper.display({
        id: "acciones",
        header: "Acciones",
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Link
              to={`/customers/${row.original.id}/edit`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              title="Editar"
              aria-label="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => askDelete(row.original.id)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
              title="Eliminar"
              aria-label="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
        meta: { align: "right" },
      }),
    ],
    [askDelete],
  );

  return (
    <div className="h-[calc(100dvh-var(--app-shell-header-h)-var(--app-shell-main-py)-var(--app-shell-main-py))]">
      <DataTable
        data={filteredClients}
        columns={columns}
        isLoading={loading}
        filterKeys={[
          "clienteCodigo",
          "nombreRazon",
          "ruc",
          "dni",
          "registradoPor",
          "documentoPredeterminado",
        ]}
        searchPlaceholder="Buscar por codigo, razon social, RUC o DNI"
        emptyMessage="No se encontraron clientes."
        initialPageSize={50}
        persistPageSize={false}
        fillAvailableHeight
        renderFilters={
          <select
            value={estado}
            onChange={(event) =>
              setEstado(event.target.value as "ACTIVO" | "INACTIVO")
            }
            className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#B23636] focus:ring-2 focus:ring-[#B23636]/20"
          >
            <option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Inactivos</option>
          </select>
        }
        toolbarAction={
          <button
            type="button"
            onClick={() => navigate("/customers/create")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#B23636] px-3 text-sm font-semibold text-white hover:bg-[#96312a]"
          >
            <PlusIcon className="h-5 w-5" />
            Nuevo
          </button>
        }
      />
    </div>
  );
};

export default CustomerList;
