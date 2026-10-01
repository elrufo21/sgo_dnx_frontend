import { BackArrowButton } from "@/components/common/BackArrowButton";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

type SunatForm = {
  usuarioSol: string;
  claveSol: string;
  sireClientId: string;
  sireClientSecret: string;
  comprobanteClientId: string;
  comprobanteClientSecret: string;
};

type SunatSettings = SunatForm & {
  ruc: string;
  tieneClaveSol: boolean;
  tieneSireClientSecret: boolean;
  tieneComprobanteClientSecret: boolean;
};

const empty: SunatForm = {
  usuarioSol: "",
  claveSol: "",
  sireClientId: "",
  sireClientSecret: "",
  comprobanteClientId: "",
  comprobanteClientSecret: "",
};

const errorMessage = (value: unknown, fallback: string) => {
  if (!value || typeof value !== "object") return fallback;
  const error = value as { response?: { data?: { message?: string } }; message?: string };
  return error.response?.data?.message ?? error.message ?? fallback;
};

export default function SunatSettingsPage() {
  const methods = useForm<SunatForm>({ defaultValues: empty });
  const [settings, setSettings] = useState<SunatSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const response = await apiRequest<SunatSettings | null>({
      url: buildApiUrl("/configuracion/sunat"),
      fallback: null,
    });
    if (!response || (typeof response === "object" && "isAxiosError" in response)) {
      toast.error(errorMessage(response, "No se pudo cargar la configuración SUNAT."));
      setSettings(null);
    } else {
      const payload = response as SunatSettings;
      setSettings(payload);
      methods.reset({ ...empty, ...payload, claveSol: "", sireClientSecret: "", comprobanteClientSecret: "" });
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const save = async (values: SunatForm) => {
    if (settings && (!settings.tieneClaveSol || !settings.tieneSireClientSecret || !settings.tieneComprobanteClientSecret) &&
      (!values.claveSol.trim() || !values.sireClientSecret.trim() || !values.comprobanteClientSecret.trim())) {
      toast.error("Completa las tres claves para configurar SUNAT por primera vez.");
      return;
    }
    setSaving(true);
    const response = await apiRequest<unknown, SunatForm>({
      url: buildApiUrl("/configuracion/sunat"),
      method: "PUT",
      data: values,
      fallback: null,
    });
    if (response === null || (response && typeof response === "object" && "isAxiosError" in response)) {
      toast.error(errorMessage(response, "No se pudo guardar la configuración SUNAT."));
    } else {
      toast.success("Configuración SUNAT guardada.");
      methods.reset({ ...values, claveSol: "", sireClientSecret: "", comprobanteClientSecret: "" });
      await load();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <BackArrowButton fallbackTo="/configuration" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Credenciales SUNAT</h1>
          <p className="text-sm text-slate-500">Credenciales aplicadas únicamente a la compañía autenticada.</p>
        </div>
      </div>

      <HookForm methods={methods} onSubmit={save} className="space-y-4" preventSubmitOnEnter>
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-6">
          <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">RUC de la compañía</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">{settings?.ruc || "-"}</div>
          </div>
          <HookFormInput<SunatForm> name="usuarioSol" label="Usuario SOL" rules={{ required: "El usuario SOL es obligatorio." }} maxLength={250} />
          <HookFormInput<SunatForm> name="claveSol" label="Clave SOL" type="password" placeholder={settings?.tieneClaveSol ? "Configurada; vacío conserva la actual" : "Obligatoria la primera vez"} />
          <HookFormInput<SunatForm> name="sireClientId" label="Client ID SIRE" rules={{ required: "El Client ID SIRE es obligatorio." }} maxLength={250} />
          <HookFormInput<SunatForm> name="sireClientSecret" label="Client Secret SIRE" type="password" placeholder={settings?.tieneSireClientSecret ? "Configurado; vacío conserva el actual" : "Obligatorio la primera vez"} />
          <HookFormInput<SunatForm> name="comprobanteClientId" label="Client ID de validación de comprobantes" rules={{ required: "El Client ID es obligatorio." }} maxLength={250} />
          <HookFormInput<SunatForm> name="comprobanteClientSecret" label="Client Secret de validación" type="password" placeholder={settings?.tieneComprobanteClientSecret ? "Configurado; vacío conserva el actual" : "Obligatorio la primera vez"} />
        </section>
        <div className="flex justify-end">
          <button type="submit" disabled={loading || saving || !settings} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#B23636] px-4 text-sm font-semibold text-white hover:bg-[#9f2e2e] disabled:cursor-not-allowed disabled:opacity-60">
            <Save className="h-4 w-4" />{saving ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>
      </HookForm>
    </div>
  );
}
