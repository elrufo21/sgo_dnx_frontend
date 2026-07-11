import { useEffect, useMemo, useState } from "react";
import CustomerFormBase from "@/components/CustomerFormBase";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { useDialogStore } from "@/store/app/dialog.store";
import type { Client } from "@/types/customer";

const safeTrim = (value: unknown) => String(value ?? "").trim();
const PAGE_SIZE = 20;
const normalizeSearch = (value: unknown) =>
  safeTrim(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const parseComboClients = (value: unknown): Client[] =>
  String(value ?? "")
    .split(/[¬\n\r]+/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const parts = row.split("|");
      return {
        id: Number(parts[0]) || 0,
        nombreRazon: safeTrim(parts[1]),
        ruc: safeTrim(parts[2]),
        dni: safeTrim(parts[3]),
        direccionFiscal: safeTrim(parts[4]),
        telefonoMovil: safeTrim(parts[5]),
        email: safeTrim(parts[6]),
        estado: safeTrim(parts[7]) || "ACTIVO",
        direccionDespacho: safeTrim(parts[8]),
        registradoPor: safeTrim(parts[9]),
        fecha: safeTrim(parts[10]) || null,
        clienteCodigo: safeTrim(parts[11]),
      };
    })
    .filter((client) => client.id || client.nombreRazon);

type CustomerDialogContentProps = {
  initialData?: Partial<Client>;
  initialQuery?: string;
  onSelectClient: (client: Client) => void;
  onCreateClient: (client: Omit<Client, "id">) => Promise<boolean> | boolean;
};

export default function CustomerDialogContent({
  initialData,
  initialQuery = "",
  onSelectClient,
  onCreateClient,
}: CustomerDialogContentProps) {
  const [activeTab, setActiveTab] = useState<"list" | "form">("list");
  const [query, setQuery] = useState(initialQuery);
  const [clients, setClients] = useState<Client[]>([]);
  const [page, setPage] = useState(1);
  const [loadingClients, setLoadingClients] = useState(false);

  useEffect(() => {
    let active = true;
    setLoadingClients(true);
    apiRequest<string>({
      url: buildApiUrl("/Cliente"),
      method: "GET",
      fallback: "",
    })
      .then((response) => {
        if (active) setClients(parseComboClients(response));
      })
      .finally(() => {
        if (active) setLoadingClients(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    useDialogStore.setState({
      confirmText: "Guardar",
      onConfirm:
        activeTab === "form"
          ? (data?: unknown) => onCreateClient((data ?? {}) as Omit<Client, "id">)
          : undefined,
    });

    return () => {
      useDialogStore.setState({ onConfirm: undefined });
    };
  }, [activeTab, onCreateClient]);

  const filteredClients = useMemo(() => {
    const tokens = normalizeSearch(query).split(" ").filter(Boolean);
    if (!tokens.length) return clients;

    return clients
      .filter((client) => {
        const haystack = normalizeSearch(
          `${client.clienteCodigo} ${client.nombreRazon} ${client.ruc} ${client.dni} ${client.telefonoMovil}`,
        );
        return tokens.every((token) => haystack.includes(token));
      });
  }, [clients, query]);
  const totalPages = Math.max(1, Math.ceil(filteredClients.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedClients = filteredClients.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-100 p-1">
        <button
          type="button"
          className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
            activeTab === "list"
              ? "bg-slate-800 text-white shadow-sm"
              : "text-slate-600 hover:bg-white"
          }`}
          onClick={() => setActiveTab("list")}
        >
          Clientes
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
            activeTab === "form"
              ? "bg-slate-800 text-white shadow-sm"
              : "text-slate-600 hover:bg-white"
          }`}
          onClick={() => setActiveTab("form")}
        >
          Formulario
        </button>
      </div>

      {activeTab === "list" ? (
        <div className="space-y-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre, codigo, DNI, RUC o telefono"
            className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <div className="max-h-[55vh] overflow-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-500">
                <tr className="text-left">
                  <th className="px-3 py-2 font-semibold">Cliente</th>
                  <th className="px-3 py-2 font-semibold">Codigo</th>
                  <th className="px-3 py-2 font-semibold">DNI</th>
                  <th className="px-3 py-2 font-semibold">RUC</th>
                  <th className="px-3 py-2 text-right font-semibold">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-slate-800">
                {loadingClients ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-slate-500"
                    >
                      Cargando clientes...
                    </td>
                  </tr>
                ) : pagedClients.length ? (
                  pagedClients.map((client) => (
                    <tr
                      key={client.id}
                      className="hover:bg-slate-50"
                      onDoubleClick={() => onSelectClient(client)}
                    >
                      <td className="px-3 py-2 font-medium">
                        {client.nombreRazon}
                      </td>
                      <td className="px-3 py-2">{client.clienteCodigo}</td>
                      <td className="px-3 py-2">{client.dni}</td>
                      <td className="px-3 py-2">{client.ruc}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900"
                          onClick={() => onSelectClient(client)}
                        >
                          Usar
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-slate-500"
                    >
                      No se encontraron clientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {filteredClients.length} de {clients.length} clientes
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Anterior
              </button>
              <span>
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-40"
                disabled={currentPage >= totalPages}
                onClick={() =>
                  setPage((value) => Math.min(totalPages, value + 1))
                }
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      ) : (
        <CustomerFormBase
          mode="create"
          variant="modal"
          initialData={initialData}
          onSave={onCreateClient}
          onNew={() => {}}
        />
      )}
    </div>
  );
}
