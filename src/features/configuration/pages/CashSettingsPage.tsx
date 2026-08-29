import { BackArrowButton } from "@/components/common/BackArrowButton";
import { toast } from "@/shared/ui/toast";
import { useBoletaBatchConfigStore } from "@/store/configuration/boletaBatchConfig.store";
import { Mail, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export default function CashSettingsPage() {
  const { flagCaja, correosAdmin, loading, saving, fetchConfig, saveCajaConfig } =
    useBoletaBatchConfigStore();
  const [draft, setDraft] = useState<{ flagCaja: boolean; correosAdmin: string } | null>(null);
  const nextFlagCaja = draft?.flagCaja ?? flagCaja;
  const nextCorreosAdmin = draft?.correosAdmin ?? correosAdmin;
  const hasChanges = nextFlagCaja !== flagCaja || nextCorreosAdmin !== correosAdmin;

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const handleRefresh = useCallback(() => {
    setDraft(null);
    void fetchConfig();
  }, [fetchConfig]);

  const handleSave = useCallback(async () => {
    const ok = await saveCajaConfig(nextFlagCaja, nextCorreosAdmin);
    if (!ok) {
      toast.error("No se pudo guardar la configuración de caja.");
      return;
    }
    setDraft(null);
    toast.success("Configuración de caja actualizada.");
  }, [nextCorreosAdmin, nextFlagCaja, saveCajaConfig]);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackArrowButton />
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Caja</h1>
            <p className="text-sm text-slate-500">Configura el envío del PDF de cierre de caja por correo.</p>
          </div>
        </div>
        <button type="button" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50" onClick={handleRefresh} disabled={loading || saving}>
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cajas abiertas</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{loading ? "Cargando..." : flagCaja ? "Múltiples cajas permitidas" : "Una sola caja permitida"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Próxima configuración</p>
          <p className="mt-2 text-sm font-semibold text-slate-800">{nextFlagCaja ? "Múltiples cajas permitidas" : "Una sola caja permitida"}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{nextCorreosAdmin || "Sin destinatarios configurados"}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-start gap-3 rounded-lg border border-[#B23636]/20 bg-[#B23636]/5 px-4 py-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-[#B23636]" />
          <p className="text-sm text-slate-700">Con el flag activado se pueden mantener varias cajas abiertas. Con el flag desactivado, se debe cerrar la caja activa antes de abrir o reactivar otra.</p>
        </div>

        <div className="mt-6 space-y-5">
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4">
            <span>
              <span className="block text-sm font-medium text-slate-800">Permitir múltiples cajas abiertas</span>
              <span className="mt-1 block text-xs text-slate-600">Desactivado: solo una caja abierta. Activado: se permiten varias cajas abiertas.</span>
            </span>
            <input type="checkbox" className="h-5 w-5 accent-[#B23636]" checked={nextFlagCaja} onChange={(event) => setDraft({ flagCaja: event.target.checked, correosAdmin: nextCorreosAdmin })} />
          </label>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="correos-admin-caja">Destinatarios del cierre de caja</label>
            <input id="correos-admin-caja" type="text" value={nextCorreosAdmin} onChange={(event) => setDraft({ flagCaja: nextFlagCaja, correosAdmin: event.target.value })} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#B23636] focus:ring-2 focus:ring-[#B23636]/20" placeholder="correo@empresa.com; otro@empresa.com" />
            <p className="text-xs text-slate-500">Separa varios correos con coma o punto y coma. Al registrarlos aparecerá el botón para enviar el PDF del cierre.</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button" onClick={handleSave} disabled={loading || saving || !hasChanges} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#B23636] px-4 text-sm font-semibold text-white hover:bg-[#9f2e2e] disabled:cursor-not-allowed disabled:opacity-60">
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>
      </div>
    </div>
  );
}
