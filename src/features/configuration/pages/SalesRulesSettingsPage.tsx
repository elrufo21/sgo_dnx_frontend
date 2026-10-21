import { BackArrowButton } from "@/components/common/BackArrowButton";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

type SalesSettings = {
  descuentoMaximo: number;
  diasAnulacionBoleta: number;
  diasAnulacionFactura: number;
  excluirDomingos: boolean;
};

const defaults: SalesSettings = { descuentoMaximo: 0, diasAnulacionBoleta: 2, diasAnulacionFactura: 6, excluirDomingos: true };
const endpoint = buildApiUrl("/configuracion/ventas-operativas");
const isAxiosError = (value: unknown) => Boolean(value && typeof value === "object" && "isAxiosError" in value);

export default function SalesRulesSettingsPage() {
  const methods = useForm<SalesSettings>({ defaultValues: defaults });
  const { control, reset, setValue } = methods;
  const excluirDomingos = useWatch({ control, name: "excluirDomingos" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const response = await apiRequest<SalesSettings | null>({ url: endpoint, fallback: null });
      if (!response || isAxiosError(response)) {
        toast.error("No se pudo cargar la configuración de ventas.");
      } else {
        reset({ ...defaults, ...(response as SalesSettings) });
      }
      setLoading(false);
    })();
  }, [reset]);

  const save = async (values: SalesSettings) => {
    setSaving(true);
    const response = await apiRequest<unknown, SalesSettings>({
      url: endpoint,
      method: "PUT",
      data: {
        ...values,
        descuentoMaximo: Number(values.descuentoMaximo),
        diasAnulacionBoleta: Number(values.diasAnulacionBoleta),
        diasAnulacionFactura: Number(values.diasAnulacionFactura),
      },
      fallback: null,
    });
    if (response === null || isAxiosError(response)) {
      toast.error("No se pudo guardar. Revisa los valores e inténtalo de nuevo.");
    } else {
      toast.success("Configuración de ventas guardada.");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <BackArrowButton fallbackTo="/configuration" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Anulaciones y descuentos</h1>
          <p className="text-sm text-slate-500">Define los límites usados por las ventas de esta compañía.</p>
        </div>
      </div>

      <HookForm methods={methods} onSubmit={save} className="space-y-4" preventSubmitOnEnter>
        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-6">
          <HookFormInput<SalesSettings> name="descuentoMaximo" label="Descuento máximo (S/)" type="number" min={0} step={0.01} helperText="Importe máximo permitido por venta." rules={{ required: "Ingresa el descuento máximo.", min: { value: 0, message: "No puede ser menor a S/ 0." } }} />
          <div className="hidden sm:block" />
          <HookFormInput<SalesSettings> name="diasAnulacionBoleta" label="Plazo para anular boletas (días)" type="number" min={0} max={365} step={1} rules={{ required: "Ingresa el plazo de boletas.", min: 0, max: 365 }} />
          <HookFormInput<SalesSettings> name="diasAnulacionFactura" label="Plazo para anular facturas (días)" type="number" min={0} max={365} step={1} rules={{ required: "Ingresa el plazo de facturas.", min: 0, max: 365 }} />
          <div className="rounded-xl border border-slate-200 px-4 py-3 sm:col-span-2">
            <FormControlLabel
              control={<Checkbox checked={Boolean(excluirDomingos)} onChange={(event) => setValue("excluirDomingos", event.target.checked, { shouldDirty: true })} sx={{ color: "#B23636", "&.Mui-checked": { color: "#B23636" } }} />}
              label={<span><span className="block text-sm font-medium text-slate-800">Excluir domingos del plazo</span><span className="mt-1 block text-xs text-slate-500">Si está activo, los domingos no cuentan como días para anular.</span></span>}
              className="m-0"
            />
          </div>
        </section>
        <div className="flex justify-end">
          <button type="submit" disabled={loading || saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#B23636] px-4 text-sm font-semibold text-white hover:bg-[#9f2e2e] disabled:cursor-not-allowed disabled:opacity-60">
            <Save className="h-4 w-4" />{saving ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>
      </HookForm>
    </div>
  );
}
