import { BackArrowButton } from "@/components/common/BackArrowButton";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

type EmailSenderForm = { email: string; appPassword: string };
type EmailSenderSettings = { email: string; hasAppPassword: boolean; source: string };

const empty: EmailSenderForm = { email: "", appPassword: "" };
const endpoint = buildApiUrl("/configuracion/correo-emisor");
const isAxiosError = (value: unknown) => Boolean(value && typeof value === "object" && "isAxiosError" in value);

export default function EmailSenderSettingsPage() {
  const methods = useForm<EmailSenderForm>({ defaultValues: empty });
  const { reset } = methods;
  const [settings, setSettings] = useState<EmailSenderSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void apiRequest<EmailSenderSettings | null>({ url: endpoint, fallback: null }).then((response) => {
      if (!active) return;
      if (!response || isAxiosError(response)) {
        toast.error("No se pudo cargar la configuración del correo emisor.");
        setSettings(null);
      } else {
        const value = response as EmailSenderSettings;
        setSettings(value);
        reset({ email: value.email ?? "", appPassword: "" });
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, [reset]);

  const save = async (values: EmailSenderForm) => {
    if (!settings?.hasAppPassword && !values.appPassword.trim()) {
      toast.error("Ingresa la contraseña de aplicación de Google.");
      return;
    }
    setSaving(true);
    const response = await apiRequest<unknown, EmailSenderForm>({
      url: endpoint,
      method: "PUT",
      data: values,
      fallback: null,
    });
    if (response === null || isAxiosError(response)) {
      toast.error("No se pudo guardar la cuenta de correo emisor.");
    } else {
      setSettings({ email: values.email.trim(), hasAppPassword: true, source: "Indicador" });
      reset({ email: values.email.trim(), appPassword: "" });
      toast.success("Cuenta de correo emisor guardada.");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <BackArrowButton fallbackTo="/configuration" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Correo emisor</h1>
          <p className="text-sm text-slate-500">Configura la cuenta Gmail que envía los correos del sistema.</p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Usa una contraseña de aplicación de Google, no la contraseña normal de Gmail. La clave se guarda protegida y nunca se muestra después de guardarla.
      </div>

      <HookForm methods={methods} onSubmit={save} className="space-y-4" preventSubmitOnEnter>
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-6">
          <div className="rounded-lg bg-slate-50 p-3 sm:col-span-2">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Configuración actual</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">
              {loading ? "Cargando..." : settings?.hasAppPassword ? `Cuenta ${settings.email} · origen ${settings.source}` : "Sin cuenta configurada"}
            </div>
          </div>
          <HookFormInput<EmailSenderForm>
            name="email"
            label="Correo Gmail emisor"
            type="email"
            autoComplete="email"
            maxLength={254}
            rules={{ required: "El correo emisor es obligatorio." }}
          />
          <HookFormInput<EmailSenderForm>
            name="appPassword"
            label="Contraseña de aplicación de Google"
            type="password"
            autoComplete="new-password"
            placeholder={settings?.hasAppPassword ? "Configurada; vacío conserva la actual" : "Obligatoria al configurar"}
            helperText="Puedes pegarla con o sin espacios; se normaliza antes de guardarla."
          />
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
