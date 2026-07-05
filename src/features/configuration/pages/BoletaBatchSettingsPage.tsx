import { BackArrowButton } from "@/components/common/BackArrowButton";
import { toast } from "@/shared/ui/toast";
import { useBoletaBatchConfigStore } from "@/store/configuration/boletaBatchConfig.store";
import { Layers3, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function BoletaBatchSettingsPage() {
  const { boletaPorLote, loading, saving, fetchConfig, saveConfig } =
    useBoletaBatchConfigStore();
  const [nextValue, setNextValue] = useState<boolean>(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (touched) return;
    setNextValue(boletaPorLote);
  }, [boletaPorLote, touched]);

  const currentLabel = useMemo(
    () => (boletaPorLote ? "Envío por lote habilitado" : "Boleta individual"),
    [boletaPorLote],
  );

  const nextLabel = nextValue ? "Envío por lote" : "Boleta individual";
  const hasChanges = nextValue !== boletaPorLote;

  const handleRefresh = useCallback(() => {
    setTouched(false);
    void fetchConfig();
  }, [fetchConfig]);

  const handleSave = useCallback(async () => {
    const ok = await saveConfig(nextValue);
    if (!ok) {
      toast.error("No se pudo guardar el modo de envío de boleta.");
      return;
    }
    setTouched(false);
    toast.success("Modo de envío de boleta actualizado.");
  }, [nextValue, saveConfig]);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackArrowButton />
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              Envío de boletas
            </h1>
            <p className="text-sm text-slate-500">
              Elige si las boletas se envían por lote o de forma individual.
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
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Próxima configuración
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{nextLabel}</p>
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
              setTouched(true);
              setNextValue(true);
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
              setTouched(true);
              setNextValue(false);
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

