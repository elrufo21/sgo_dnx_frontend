import { BackArrowButton } from "@/components/common/BackArrowButton";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

type RenewalSettings = { renovacionOse: string; renovacionFirma: string; renovacionSome: string };
const empty: RenewalSettings = { renovacionOse: "", renovacionFirma: "", renovacionSome: "" };
const endpoint = buildApiUrl("/configuracion/renovaciones");
const isAxiosError = (value: unknown) => Boolean(value && typeof value === "object" && "isAxiosError" in value);

export default function RenewalSettingsPage() {
  const methods = useForm<RenewalSettings>({ defaultValues: empty });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await apiRequest<RenewalSettings | null>({ url: endpoint, fallback: null });
      if (!response || isAxiosError(response)) toast.error("No se pudieron cargar las renovaciones.");
      else methods.reset({ ...empty, ...(response as RenewalSettings) });
      setLoading(false);
    })();
  }, [methods]);

  const save = async (values: RenewalSettings) => {
    setSaving(true);
    const response = await apiRequest<unknown, RenewalSettings>({ url: endpoint, method: "PUT", data: values, fallback: null });
    if (response === null || isAxiosError(response)) toast.error("No se pudieron guardar las fechas de renovación.");
    else toast.success("Fechas de renovación guardadas.");
    setSaving(false);
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <BackArrowButton fallbackTo="/configuration" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Renovaciones</h1>
          <p className="text-sm text-slate-500">Actualiza las fechas de OSE, firma digital y servicio.</p>
        </div>
      </div>
      <HookForm methods={methods} onSubmit={save} className="space-y-4" preventSubmitOnEnter>
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3 sm:p-6">
          <HookFormInput<RenewalSettings> name="renovacionOse" label="Renovación OSE" type="date" />
          <HookFormInput<RenewalSettings> name="renovacionFirma" label="Renovación de firma" type="date" />
          <HookFormInput<RenewalSettings> name="renovacionSome" label="Renovación SOME" type="date" />
        </section>
        <div className="flex justify-end">
          <button type="submit" disabled={loading || saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#B23636] px-4 text-sm font-semibold text-white hover:bg-[#9f2e2e] disabled:cursor-not-allowed disabled:opacity-60">
            <Save className="h-4 w-4" />{saving ? "Guardando..." : "Guardar fechas"}
          </button>
        </div>
      </HookForm>
    </div>
  );
}
