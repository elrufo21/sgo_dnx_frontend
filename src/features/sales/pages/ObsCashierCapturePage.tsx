import DataTable from "@/components/DataTable";
import { API_BASE_URL } from "@/config";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const formatDate = (value: string) => {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || "-";
};

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

const noExiste = (value: string) => value.trim().toUpperCase() === "NO EXISTE";

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
      helper.accessor("fecha", {
        header: "Fecha",
        cell: (info) => formatDate(info.getValue()),
      }),
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
          const missing = noExiste(value);
          return (
            <span className={missing ? "font-semibold text-red-600" : "text-emerald-700"}>
              {value}
            </span>
          );
        },
      }),
      helper.accessor("cajaId", {
        header: "CajaId",
        cell: (info) => {
          const value = info.getValue() || "NO EXISTE";
          return (
            <span className={noExiste(value) ? "font-semibold text-red-600" : "text-slate-700"}>
              {value}
            </span>
          );
        },
      }),
    ] as ColumnDef<ObsRow, unknown>[];
  }, []);

  const fetchRows = useCallback(async (inicio: string, fin: string, tipoVenta: SaleType) => {
    if (!inicio || !fin || inicio > fin) {
      toast.error("Selecciona un rango de fechas válido.");
      return;
    }
    setLoading(true);
    const query = new URLSearchParams({
      fechaInicio: inicio,
      fechaFin: fin,
      tipoVenta,
    });
    const result = await apiRequest<ObsRow[]>({
      url: `${API_BASE_URL}/ObsCapture?${query.toString()}`,
      fallback: [],
    });
    setRows(Array.isArray(result) ? result : []);
    setLoading(false);
  }, []);

  const load = useCallback(
    () => fetchRows(fechaInicio, fechaFin, saleType),
    [fechaFin, fechaInicio, fetchRows, saleType],
  );

  const receivingCapture = useRef(false);

  const receive = useCallback(async (payload: ObsCapturePayload) => {
    if (receivingCapture.current) return;
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

    receivingCapture.current = true;
    setSaving(true);
    try {
      const response = await apiRequest<{ ok?: boolean; mensaje?: string }>({
        url: `${API_BASE_URL}/ObsCapture`,
        method: "POST",
        data: { lines, tipoVenta: capturedType },
      });
      const result =
        response && typeof response === "object"
          ? (response as { ok?: boolean; mensaje?: string })
          : null;
      if (!result || result.ok !== true) {
        toast.error(
          result?.mensaje || `No se pudo guardar la captura ${capturedType}.`,
        );
        return;
      }

      const dates = lines.map((line) => line.fecha).sort();
      const inicio = dates[0];
      const fin = dates[dates.length - 1];
      setFechaInicio(inicio);
      setFechaFin(fin);
      setSaleType(capturedType);
      await fetchRows(inicio, fin, capturedType);
      toast.success(result.mensaje || `Datos ${capturedType} actualizados.`);
    } finally {
      setSaving(false);
      receivingCapture.current = false;
    }
  }, [fetchRows]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const payload = event.data?.payload as ObsCapturePayload | undefined;
      if (
        event.data?.type !== "SGO_DXN_OBS_CAPTURE" ||
        payload?.kind !== "obs_summary"
      )
        return;
      void receive(payload);
    };
    window.addEventListener("message", onMessage);
    window.postMessage(
      { type: "SGO_DXN_OBS_CAPTURE_READY" },
      window.location.origin,
    );
    return () => window.removeEventListener("message", onMessage);
  }, [receive]);

  const total = rows.reduce((sum, row) => sum + Number(row.importe || 0), 0);
  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="flex gap-1 border-b border-slate-200">
        {(["OBS", "IOC"] as SaleType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setSaleType(type)}
            className={`border-b-2 px-4 py-2 text-sm font-semibold ${saleType === type ? "border-[#B23636] text-[#96312a]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {type}
          </button>
        ))}
      </div>
      <DataTable
        columns={columns}
        data={rows}
        initialPageSize={50}
        persistPageSize={false}
        tableMaxHeight="52vh"
        isLoading={loading || saving}
        emptyMessage={`No hay datos ${saleType} para el periodo seleccionado.`}
        searchPlaceholder="Buscar por cliente, código o transacción..."
        filterKeys={[
          "notaTransaccion",
          "codigoMiembro",
          "nombreMiembro",
          "usuario",
          "estado",
          "cajaId",
        ]}
        renderFilters={
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Fecha inicio
              <input
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                type="date"
                value={fechaInicio}
                onChange={(event) => setFechaInicio(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-600">
              Fecha fin
              <input
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                type="date"
                value={fechaFin}
                onChange={(event) => setFechaFin(event.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || saving}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
              aria-label="Buscar"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        }
        toolbarAction={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || saving}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" /> Actualizar
          </button>
        }
        footerContent={
          <div className="flex justify-end">
            <div className="w-full max-w-xs rounded-xl border border-slate-200 bg-white px-4 py-3 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Total
              </p>
              <p className="text-xl font-semibold text-slate-900">
                {money(total)}
              </p>
            </div>
          </div>
        }
      />
    </div>
  );
}
