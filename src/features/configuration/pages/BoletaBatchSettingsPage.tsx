import { BackArrowButton } from "@/components/common/BackArrowButton";
import { toast } from "@/shared/ui/toast";
import { useBoletaBatchConfigStore } from "@/store/configuration/boletaBatchConfig.store";
import { Layers3, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function BoletaBatchSettingsPage() {
  const { boletaPorLote, flagCaptura, loading, saving, fetchConfig, saveConfig } =
    useBoletaBatchConfigStore();
  const [draft, setDraft] = useState<{
    boletaPorLote: boolean;
    flagCaptura: boolean;
  } | null>(null);
  const nextValue = draft?.boletaPorLote ?? boletaPorLote;
  const nextFlagCaptura = draft?.flagCaptura ?? flagCaptura;

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const currentLabel = useMemo(
    () => (boletaPorLote ? "Envío por lote habilitado" : "Boleta individual"),
    [boletaPorLote],
  );

  const nextLabel = nextValue ? "Envío por lote" : "Boleta individual";
  const captureLabel = flagCaptura ? "Captura habilitada" : "Captura oculta";
  const nextCaptureLabel = nextFlagCaptura ? "Captura habilitada" : "Captura oculta";
  const hasChanges = nextValue !== boletaPorLote || nextFlagCaptura !== flagCaptura;

  const handleRefresh = useCallback(() => {
    setDraft(null);
    void fetchConfig();
  }, [fetchConfig]);

  const handleSave = useCallback(async () => {
    const ok = await saveConfig(nextValue, nextFlagCaptura);
    if (!ok) {
      toast.error("No se pudo guardar la configuración.");
      return;
    }
    setDraft(null);
    toast.success("Configuración actualizada.");
  }, [nextFlagCaptura, nextValue, saveConfig]);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackArrowButton />
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              Ventas y boletas
            </h1>
            <p className="text-sm text-slate-500">
              Configura el envío de boletas y la captura de datos.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={handleRefresh}
          disabled={loading || saving}
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Estado actual
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {loading ? "Cargando..." : currentLabel}
          </p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {loading ? "" : captureLabel}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Próxima configuración
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{nextLabel}</p>
          <p className="mt-1 text-xs font-medium text-slate-500">
            {nextCaptureLabel}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3 rounded-lg border border-[#B23636]/20 bg-[#B23636]/5 px-4 py-3">
          <Layers3 className="mt-0.5 h-5 w-5 shrink-0 text-[#B23636]" />
          <p className="text-sm text-slate-700">
            Si habilitas <strong>Envío por lote</strong>, las boletas se enviarán
            por resumen. Si lo deshabilitas, se enviarán de manera individual.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setDraft({ boletaPorLote: true, flagCaptura: nextFlagCaptura });
            }}
            className={`rounded-xl border px-4 py-4 text-left transition ${
              nextValue
                ? "border-[#B23636] bg-[#B23636]/10"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <p className="text-sm font-semibold text-slate-900">Envío por lote</p>
            <p className="mt-1 text-xs text-slate-600">
              Usa resumen diario (ticket SUNAT).
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setDraft({ boletaPorLote: false, flagCaptura: nextFlagCaptura });
            }}
            className={`rounded-xl border px-4 py-4 text-left transition ${
              !nextValue
                ? "border-[#B23636] bg-[#B23636]/10"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <p className="text-sm font-semibold text-slate-900">Boleta individual</p>
            <p className="mt-1 text-xs text-slate-600">
              Envía boleta por boleta al momento de emitir.
            </p>
          </button>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <p className="text-sm font-semibold text-slate-900">
            Capturar datos en nota de venta
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Controla si aparece el botón Capturar datos.
          </p>

          <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4">
            <span className="text-sm font-medium text-slate-800">
              Mostrar botón Capturar datos
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-[#B23636]"
              checked={nextFlagCaptura}
              onChange={(event) => {
                setDraft({
                  boletaPorLote: nextValue,
                  flagCaptura: event.target.checked,
                });
              }}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving || !hasChanges}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#B23636] px-4 text-sm font-semibold text-white hover:bg-[#9f2e2e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>
      </div>
    </div>
  );
}
