import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useForm } from "react-hook-form";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Search } from "lucide-react";
import axios from "axios";
import Alert from "@mui/material/Alert";
import DataTable from "@/components/DataTable";
import { TotalsSummary } from "@/components/common/TotalsSummary";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormAutocomplete } from "@/components/forms/HookFormAutocomplete";
import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { formatDate } from "@/shared/helpers/formatDate";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import { useClientsStore } from "@/store/customers/customers.store";
import type { Client } from "@/types/customer";

type Filters = { clienteId: number | null; fechaInicio: string; fechaFin: string };
type Row = { notaId: number; fecha: string; transaccion: string; codigo: string; cliente: string; pv: number; sv: number; importe: number };
const column = createColumnHelper<Row>();
const formatAmount = (value: number) => value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PvsReportPage() {
  const [initialDates] = useState(() => {
    const today = new Date();
    return { fechaInicio: getLocalDateISO(new Date(today.getFullYear(), today.getMonth(), 1)), fechaFin: getLocalDateISO(new Date(today.getFullYear(), today.getMonth() + 1, 0)) };
  });
  const methods = useForm<Filters>({ defaultValues: { clienteId: null, ...initialDates } });
  const searchClients = useClientsStore((state) => state.searchClients);
  const [term, setTerm] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [selected, setSelected] = useState<Client | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const searchInProgress = useRef(false);

  useEffect(() => {
    const query = term.trim();
    let active = true;
    const timer = window.setTimeout(() => {
      void searchClients(query, "", 30, false, 0).then((result) => {
        if (active) { setClients(result); setLoadingClients(false); }
      }).catch(() => { if (active) setLoadingClients(false); });
    }, query ? 300 : 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [term, searchClients]);

  const options = useMemo(() => {
    const all = selected && !clients.some((client) => client.id === selected.id) ? [selected, ...clients] : clients;
    return all.map((client) => ({ value: client.id, label: [client.clienteCodigo, client.nombreRazon, client.dni].filter(Boolean).join(" · ") }));
  }, [clients, selected]);

  const columns = useMemo(() => [
    column.accessor("fecha", { header: "Fecha", cell: (info) => formatDate(info.getValue()) || "-" }),
    column.accessor("transaccion", { header: "Nro. transacción" }),
    column.accessor("codigo", { header: "Código" }),
    column.accessor("cliente", { header: "Cliente" }),
    column.accessor("pv", { header: "PV", cell: (info) => formatAmount(info.getValue()) }),
    column.accessor("sv", { header: "SV", cell: (info) => formatAmount(info.getValue()) }),
    column.accessor("importe", { header: "Importe", cell: (info) => formatAmount(info.getValue()) }),
  ] as unknown as ColumnDef<Row, unknown>[], []);
  const totals = useMemo(() => rows.reduce((sum, row) => ({ pv: sum.pv + Math.round(row.pv * 100), sv: sum.sv + Math.round(row.sv * 100), importe: sum.importe + Math.round(row.importe * 100) }), { pv: 0, sv: 0, importe: 0 }), [rows]);

  const submit = async (values: Filters) => {
    if (searchInProgress.current) return;
    setRows([]);
    setSearched(false);
    setError("");
    if (!values.clienteId || !values.fechaInicio || !values.fechaFin || values.fechaInicio > values.fechaFin) {
      setError("Seleccione un cliente y un rango de fechas válido.");
      return;
    }
    searchInProgress.current = true;
    setLoading(true);
    try {
      const query = new URLSearchParams({ clienteId: String(values.clienteId), fechaInicio: values.fechaInicio, fechaFin: values.fechaFin });
      const response = await apiRequest<unknown>({ url: `${API_BASE_URL}/PvsReport?${query}` });
      if (!Array.isArray(response)) {
        const status = axios.isAxiosError(response) ? response.response?.status : undefined;
        setError(status === 401
          ? "Tu sesión no está disponible o ha vencido. Inicia sesión nuevamente."
          : status === 403
            ? "No tienes permiso para consultar el resumen PVS."
            : status === undefined
              ? "No se pudo conectar con la API. Comprueba que el servidor esté iniciado."
              : "No se pudo consultar el resumen. Inténtalo nuevamente.");
        return;
      }
      setRows(response);
      setSearched(true);
    } finally { searchInProgress.current = false; setLoading(false); }
  };

  const searchOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    if (event.currentTarget.getAttribute("aria-expanded") === "true") {
      queueMicrotask(() => {
        if (!searchInProgress.current) void submit(methods.getValues());
      });
      return;
    }
    if (event.defaultPrevented) return;
    event.preventDefault();
    void methods.handleSubmit(submit)();
  };

  return (
    <div className="p-2 sm:p-4 space-y-4">
      <HookForm methods={methods} onSubmit={submit}>
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="min-w-[230px] flex-1">
            <HookFormAutocomplete<Filters> name="clienteId" label="Cliente (código, DNI o nombre)" options={options} disabled={loading}
              placeholder="Escriba o seleccione un cliente" loading={loadingClients} noOptionsText="No se encontraron clientes"
              onInputKeyDown={searchOnEnter}
              onInputValueChange={(value) => { setClients([]); setLoadingClients(true); setTerm(value); }}
              onOptionSelected={(option) => {
                setSelected(clients.find((client) => client.id === option?.value) ?? (selected?.id === option?.value ? selected : null));
                if (option) void submit({ ...methods.getValues(), clienteId: Number(option.value) });
                if (!option && term !== "") { setLoadingClients(true); setTerm(""); }
              }} />
          </div>
          <div className="w-44"><HookFormInput<Filters> name="fechaInicio" label="Fecha inicio" type="date" disabled={loading} onKeyDown={searchOnEnter} /></div>
          <div className="w-44"><HookFormInput<Filters> name="fechaFin" label="Fecha fin" type="date" disabled={loading} onKeyDown={searchOnEnter} /></div>
          <button type="submit" disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"><Search size={17} /> Buscar</button>
        </div>
      </HookForm>
      {error && <Alert severity="error">{error}</Alert>}
      {searched && <p className="text-sm text-slate-600">Se muestran los resultados de la última búsqueda.</p>}
      <DataTable data={rows} columns={columns} isLoading={loading} showSearch={false} initialPageSize={50} persistPageSize={false}
        emptyMessage={searched ? "No hay notas con estado CANCELADO y fecha de pago dentro del período seleccionado." : "Seleccione un cliente y un período para consultar."}
        footerContent={
          <div className="flex flex-wrap items-end justify-between gap-3">
            <span className="text-sm font-semibold text-slate-700">Registros: {rows.length}</span>
            <div className="w-full sm:min-w-0 sm:flex-1">
              <TotalsSummary items={[
                { label: "PV", value: formatAmount(totals.pv / 100) },
                { label: "SV", value: formatAmount(totals.sv / 100) },
                { label: "Total", value: formatAmount(totals.importe / 100) },
              ]} />
            </div>
          </div>
        } />
    </div>
  );
}
