import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Pencil, PlusIcon, Search, Trash2 } from "lucide-react";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { useDialogStore } from "@/store/app/dialog.store";
import { useClientsStore } from "@/store/customers/customers.store";
import { toast } from "@/shared/ui/toast";

const PAGE_SIZE = 50;

const CustomerList = () => {
  const navigate = useNavigate();
  const openDialog = useDialogStore((s) => s.openDialog);
  const { clients, totalClients, loading, fetchClients, deleteClient } =
    useClientsStore();
  const [estado, setEstado] = useState<"ACTIVO" | "INACTIVO">("ACTIVO");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchClients({ estado, search, page, pageSize: PAGE_SIZE });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [estado, fetchClients, page, search]);

  const canGoNext = page * PAGE_SIZE < totalClients;
  const from = useMemo(
    () => (clients.length ? (page - 1) * PAGE_SIZE + 1 : 0),
    [clients.length, page],
  );
  const to = clients.length ? from + clients.length - 1 : 0;
  const totalPages = Math.max(1, Math.ceil(totalClients / PAGE_SIZE));

  const askDelete = (id: number) =>
    openDialog({
      title: "Eliminar cliente",
      content: <p>¿Seguro que deseas eliminar este cliente?</p>,
      onConfirm: async () => {
        const ok = await deleteClient(id);
        if (ok === false) {
          toast.error("No se pudo eliminar el cliente.");
          return;
        }
        toast.success("Cliente eliminado.");
        void fetchClients({ estado, search, page, pageSize: PAGE_SIZE });
      },
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <BackArrowButton className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100" />
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Buscar por codigo, nombre, RUC o DNI"
            className="h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-[#B23636]"
          />
        </div>
        <select
          value={estado}
          onChange={(event) => {
            setEstado(event.target.value as "ACTIVO" | "INACTIVO");
            setPage(1);
          }}
          className="h-10 rounded-lg border border-slate-300 px-3 text-sm"
        >
          <option value="ACTIVO">Activos</option>
          <option value="INACTIVO">Inactivos</option>
        </select>
        <button
          type="button"
          onClick={() => navigate("/customers/create")}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#B23636] px-3 text-sm font-semibold text-white hover:bg-[#96312a]"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Codigo</th>
                <th className="px-4 py-3">Nombre o razon social</th>
                <th className="px-4 py-3">RUC</th>
                <th className="px-4 py-3">DNI</th>
                <th className="px-4 py-3">Telefono</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Cargando clientes...
                  </td>
                </tr>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    No se encontraron clientes.
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {client.clienteCodigo || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{client.nombreRazon}</td>
                    <td className="px-4 py-3 text-slate-600">{client.ruc || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">{client.dni || "-"}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {client.telefonoMovil || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{client.email || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          to={`/customers/${client.id}/edit`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => askDelete(client.id)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
          <span>
            Mostrando {from} - {to} de {totalClients} clientes · Página {page} de{" "}
            {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page === 1 || loading}
              className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((value) => value + 1)}
              disabled={!canGoNext || loading}
              className="rounded-lg border border-slate-300 px-3 py-2 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerList;
