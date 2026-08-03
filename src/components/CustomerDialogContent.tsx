import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { BlockingSpinner } from "@/components/common/BlockingSpinner";
import CustomerFormBase from "@/components/CustomerFormBase";
import { useDialogStore } from "@/store/app/dialog.store";
import { useClientsStore } from "@/store/customers/customers.store";
import type { Client } from "@/types/customer";

const safeTrim = (value: unknown) => String(value ?? "").trim();
const normalizeSearch = (value: unknown) =>
  safeTrim(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
const tokenizeSearch = (value: unknown) =>
  normalizeSearch(value).split(" ").filter(Boolean);
const formatCount = (value: number) =>
  Number(value || 0).toLocaleString("en-US");
const CUSTOMER_DIALOG_FORM_ID = "customer-dialog-form";

type CustomerDialogContentProps = {
  initialData?: Partial<Client>;
  initialQuery?: string;
  onSelectClient: (client: Client) => void;
  onCreateClient: (client: Omit<Client, "id">) => Promise<boolean> | boolean;
  onUpdateClient?: (
    client: Client,
    data: Omit<Client, "id">,
  ) => Promise<boolean> | boolean;
  onDeleteClient?: (client: Client) => Promise<boolean> | boolean;
  initialEditingClient?: Client | null;
};

export default function CustomerDialogContent({
  initialData,
  initialQuery = "",
  onSelectClient,
  onCreateClient,
  onUpdateClient,
  onDeleteClient,
  initialEditingClient = null,
}: CustomerDialogContentProps) {
  const clients = useClientsStore((state) => state.clients);
  const totalClients = useClientsStore((state) => state.totalClients);
  const fetchClients = useClientsStore((state) => state.fetchClients);
  const loadingClients = useClientsStore((state) => state.loading);
  const closeDialog = useDialogStore((state) => state.closeDialog);
  const [activeTab, setActiveTab] = useState<"list" | "form">("form");
  const [query, setQuery] = useState(initialQuery);
  const [editingClient, setEditingClient] = useState<Client | null>(
    initialEditingClient,
  );
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void fetchClients("");
  }, [fetchClients]);

  useEffect(() => {
    if (activeTab !== "list") return;
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [activeTab]);

  const filteredClients = useMemo(() => {
    const tokens = tokenizeSearch(query);
    const sorted = [...clients].sort((a, b) => Number(b.id) - Number(a.id));
    if (!tokens.length) return sorted.slice(0, 100);

    return sorted
      .filter((client) => {
        const haystack = normalizeSearch(
          `${client.clienteCodigo} ${client.nombreRazon} ${client.ruc} ${client.dni} ${client.telefonoMovil}`,
        );
        return tokens.every((token) => haystack.includes(token));
      })
      .slice(0, 100);
  }, [clients, query]);

  const openNewForm = () => {
    setEditingClient(null);
    setActiveTab("form");
  };

  const submitForm = () => {
    setActiveTab("form");
    window.requestAnimationFrame(() => {
      (
        document.getElementById(
          CUSTOMER_DIALOG_FORM_ID,
        ) as HTMLFormElement | null
      )?.requestSubmit();
    });
  };

  const deleteEditingClient = async () => {
    if (!editingClient || !onDeleteClient) return;
    const confirmed = window.confirm(
      `¿Eliminar cliente ${editingClient.nombreRazon || editingClient.clienteCodigo}?`,
    );
    if (!confirmed) return;
    const deleted = await onDeleteClient(editingClient);
    if (!deleted) return;
    setEditingClient(null);
    setActiveTab("list");
  };

  return (
    <div className="flex h-[68dvh] max-h-[38rem] flex-col overflow-hidden bg-white">
      <BlockingSpinner show={loadingClients} text="Cargando clientes..." />
      <div className="shrink-0 bg-[#B23636] px-2 py-2 text-white sm:px-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid w-full grid-cols-2 rounded-md bg-white/10 p-1 lg:w-[28rem]">
            <button
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                activeTab === "list"
                  ? "bg-white text-slate-700 shadow-sm"
                  : "text-white hover:bg-white/10"
              }`}
              onClick={() => setActiveTab("list")}
            >
              Clientes
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                activeTab === "form"
                  ? "bg-red-700 text-white shadow-sm"
                  : "text-white hover:bg-white/10"
              }`}
              onClick={openNewForm}
            >
              Formulario
            </button>
          </div>
          <div className="flex items-center justify-end gap-2 overflow-x-auto pb-1 lg:pb-0">
            <button
              type="button"
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-white/10 px-3 text-sm font-semibold hover:bg-white/20"
              onClick={openNewForm}
            >
              <Plus className="h-4 w-4" />
              Nuevo
            </button>
            {activeTab === "form" ? (
              <>
                {editingClient && onDeleteClient ? (
                  <button
                    type="button"
                    className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-white/10 px-3 text-sm font-semibold hover:bg-white/20"
                    onClick={deleteEditingClient}
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-red-600 px-3 text-sm font-semibold hover:bg-red-700"
                  onClick={submitForm}
                >
                  <Save className="h-4 w-4" />
                  Guardar
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/20 bg-white/10 hover:bg-white/20"
              onClick={closeDialog}
              title="Cerrar"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-4 sm:p-6">
        {activeTab === "list" ? (
          <div className="flex h-full min-h-0 flex-col gap-3">
            <input
              ref={searchInputRef}
              type="search"
              data-no-uppercase="true"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre, codigo, DNI, RUC o telefono"
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-500">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-semibold">Cliente</th>
                    <th className="px-3 py-2 font-semibold">Codigo</th>
                    <th className="px-3 py-2 font-semibold">DNI</th>
                    <th className="px-3 py-2 font-semibold">RUC</th>
                    <th className="px-3 py-2 text-right font-semibold">
                      Accion
                    </th>
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
                  ) : filteredClients.length ? (
                    filteredClients.map((client) => (
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
                          <div className="flex justify-end gap-2">
                            {onUpdateClient ? (
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
                                onClick={() => {
                                  setEditingClient(client);
                                  setActiveTab("form");
                                }}
                                title="Editar"
                                aria-label="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#B23636] text-white hover:bg-[#9f2f2f]"
                              onClick={() => onSelectClient(client)}
                              title="Usar"
                              aria-label="Usar"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </div>
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
                {formatCount(filteredClients.length)} de{" "}
                {formatCount(totalClients || clients.length)} clientes
              </span>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <CustomerFormBase
              key={editingClient?.id ?? "create"}
              mode={editingClient ? "edit" : "create"}
              variant="modal"
              initialData={editingClient ?? initialData}
              formId={CUSTOMER_DIALOG_FORM_ID}
              onSave={(data) =>
                editingClient && onUpdateClient
                  ? onUpdateClient(editingClient, data)
                  : onCreateClient(data)
              }
              onNew={() => setEditingClient(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
