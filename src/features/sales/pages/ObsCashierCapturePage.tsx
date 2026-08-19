import DataTable from "@/components/DataTable";
import { API_BASE_URL } from "@/config";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";

type ObsRow = {
  id: number;
  fecha: string;
  notaTransaccion: string;
  codigoMiembro: string;
  nombreMiembro: string;
  importe: number;
  usuario: string;
  estado: string;
  cajaId: string;
};
type SaleType = "OBS" | "IOC";

type ObsCapturePayload = {
  kind: "obs_summary";
  saleType?: SaleType;
  lines: Array<{
    date: string;
    transactionNumber: string;
    memberCode: string;
    customerName: string;
    amount: number;
  }>;
};

const money = (value: number) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export default function ObsCashierCapturePage() {
  const today = useMemo(() => getLocalDateISO(), []);
  const [fechaInicio, setFechaInicio] = useState(today);
  const [fechaFin, setFechaFin] = useState(today);
  const [saleType, setSaleType] = useState<SaleType>("OBS");
  const [rows, setRows] = useState<ObsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const columns = useMemo(() => {
    const helper = createColumnHelper<ObsRow>();
    return [
      helper.accessor("fecha", { header: "Fecha" }),
      helper.accessor("notaTransaccion", { header: "Nro. transacción" }),
      helper.accessor("codigoMiembro", { header: "Código" }),
      helper.accessor("nombreMiembro", { header: "Cliente" }),
      helper.accessor("importe", {
        header: "Importe",
        cell: (info) => money(info.getValue()),
        meta: { align: "right" },
      }),
      helper.accessor("usuario", { header: "Usuario" }),
      helper.accessor("estado", {
        header: "Estado",
        cell: (info) => {
          const value = info.getValue();
          const emitted = value.trim().toUpperCase() !== "NO EXISTE";
          return (
            <span className={emitted ? "text-emerald-700" : "text-amber-700"}>
              {emitted ? value : "PENDIENTE"}
            </span>
          );
        },
      }),
    ] as ColumnDef<ObsRow, unknown>[];
  }, []);

  const load = useCallback(async () => {
    if (!fechaInicio || !fechaFin || fechaInicio > fechaFin) {
      toast.error("Selecciona un rango de fechas válido.");
      return;
    }
    setLoading(true);
    const query = new URLSearchParams({ fechaInicio, fechaFin, tipoVenta: saleType });
    const result = await apiRequest<ObsRow[]>({
      url: `${API_BASE_URL}/ObsCapture?${query.toString()}`,
      fallback: [],
    });
    setRows(Array.isArray(result) ? result : []);
    setLoading(false);
  }, [fechaFin, fechaInicio, saleType]);

  const receive = useCallback(async (payload: ObsCapturePayload) => {
    const capturedType: SaleType = payload.saleType === "IOC" ? "IOC" : "OBS";
    const lines = payload.lines
      .filter(
        (line) =>
          line.date &&
          line.transactionNumber.trim() &&
          Number.isFinite(Number(line.amount)) &&
          Number(line.amount) > 0,
      )
      .map((line) => ({
        fecha: line.date,
        notaTransaccion: line.transactionNumber.trim(),
        codigoMiembro: line.memberCode.trim(),
        nombreMiembro: line.customerName.trim(),
        importe: Number(line.amount),
      }));
    if (!lines.length) {
      toast.error(`No se encontraron transacciones ${capturedType} válidas.`);
      return;
    }

    setSaving(true);
    const response = await apiRequest<{ ok?: boolean; mensaje?: string }>({
      url: `${API_BASE_URL}/ObsCapture`,
      method: "POST",
      data: { lines, tipoVenta: capturedType },
    });
    const result =
      response && typeof response === "object"
        ? (response as { ok?: boolean; mensaje?: string })
        : null;
    setSaving(false);
    if (!result || typeof result !== "object" || result.ok !== true) {
      toast.error(result?.mensaje || `No se pudo guardar la captura ${capturedType}.`);
      return;
    }

    const dates = lines.map((line) => line.fecha).sort();
    setFechaInicio(dates[0]);
    setFechaFin(dates[dates.length - 1]);
    setSaleType(capturedType);
    toast.success(result.mensaje || `Datos ${capturedType} actualizados.`);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data?.payload as ObsCapturePayload | undefined;
      if (event.data?.type !== "SGO_DXN_OBS_CAPTURE" || payload?.kind !== "obs_summary") return;
      void receive(payload);
    };
    window.addEventListener("message", onMessage);
    window.postMessage({ type: "SGO_DXN_OBS_CAPTURE_READY" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [receive]);

  const total = rows.reduce((sum, row) => sum + Number(row.importe || 0), 0);
  return (
    <div className="space-y-4 p-3 sm:p-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Datos OBS por cajero</h1>
        <p className="mt-1 text-sm text-slate-600">
          Abre el resumen Cash Bill o IOC de DXN y usa “Enviar resumen a SGO”.
        </p>
      </section>
      <div className="flex gap-1 border-b border-slate-200">
        {(["OBS", "IOC"] as SaleType[]).map((type) => (
          <button key={type} type="button" onClick={() => setSaleType(type)} className={`border-b-2 px-4 py-2 text-sm font-semibold ${saleType === type ? "border-[#B23636] text-[#96312a]" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
            {type}
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={loading || saving}
        emptyMessage={`No hay datos ${saleType} para el periodo seleccionado.`}
        searchPlaceholder="Buscar por cliente, código o transacción..."
        filterKeys={["notaTransaccion", "codigoMiembro", "nombreMiembro", "usuario", "estado"]}
        renderFilters={
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Fecha inicio
              <input className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm" type="date" value={fechaInicio} onChange={(event) => setFechaInicio(event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Fecha fin
              <input className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm" type="date" value={fechaFin} onChange={(event) => setFechaFin(event.target.value)} />
            </label>
            <button type="button" onClick={() => void load()} disabled={loading || saving} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50" aria-label="Buscar">
              <Search className="h-4 w-4" />
            </button>
          </div>
        }
        toolbarAction={
          <button type="button" onClick={() => void load()} disabled={loading || saving} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
        }
        footerContent={<span className="font-semibold text-slate-800">Total: {money(total)}</span>}
      />
    </div>
  );
}
