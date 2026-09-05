import { pdf } from "@react-pdf/renderer";
import { Download, FilePlus2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { generateTicketQrBase64 } from "@/components/ticketQr";
import {
  DeliveryGuidePdf,
  type DeliveryGuideItem,
  type DeliveryGuideValues,
} from "@/features/sales/components/DeliveryGuidePdf";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import { toast } from "@/shared/ui/toast";
import { useAuthStore } from "@/store/auth/auth.store";

const newItem = (): DeliveryGuideItem => ({
  description: "",
  code: "",
  sunatCode: "",
  gtin: "",
  quantity: "1",
  unit: "UNIDAD (NIU)",
});

const currentTime = () =>
  new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export default function DeliveryGuidePage() {
  const user = useAuthStore((state) => state.user);
  const [generating, setGenerating] = useState(false);
  const methods = useForm<DeliveryGuideValues>({
    defaultValues: {
      serie: "EG07",
      number: "00000001",
      deliveryDate: getLocalDateISO(),
      emissionTime: currentTime(),
      reason: "OTROS",
      reasonDescription: "TRASLADO ENTRE ESTABLECIMIENTOS",
      recipient: user?.companyName || user?.companyCommercialName || "",
      recipientDocument: user?.companyRuc || "",
      departure: user?.companySunatAddress || "",
      arrival: "",
      transportMode: "PÚBLICO",
      transshipment: "NO",
      m1Vehicle: "NO",
      grossWeight: "",
      weightUnit: "KGM",
      items: [newItem()],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: methods.control,
    name: "items",
  });

  const onSubmit = async (values: DeliveryGuideValues) => {
    const validItems = values.items.filter(
      (item) => item.description.trim() && Number(item.quantity) > 0,
    );
    if (!validItems.length) {
      toast.error("Agrega al menos un bien con descripción y cantidad.");
      return;
    }

    const guideWindow = window.open("", "_blank");
    setGenerating(true);
    try {
      const documentNumber = `${values.serie.trim().toUpperCase()}-${values.number.trim().padStart(8, "0")}`;
      const qrBase64 = await generateTicketQrBase64(
        [user?.companyRuc, "09", documentNumber, values.recipientDocument, values.deliveryDate].join("|"),
      );
      const blob = await pdf(
        <DeliveryGuidePdf
          values={{ ...values, items: validItems }}
          company={{
            name: user?.companyName || user?.companyCommercialName,
            ruc: user?.companyRuc,
          }}
          qrBase64={qrBase64}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      if (guideWindow) guideWindow.location.href = url;
      else {
        const link = document.createElement("a");
        link.href = url;
        link.download = `Guia_remision_${documentNumber}.pdf`;
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      guideWindow?.close();
      toast.error(error instanceof Error ? error.message : "No se pudo generar la guía.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-2 py-2 sm:px-1">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Guía de remisión</h1>
          <p className="mt-1 text-sm text-slate-600">Genera la representación impresa con el mismo formato de la guía remitente.</p>
        </div>
        <button type="submit" form="delivery-guide-form" disabled={generating} className="inline-flex items-center gap-2 rounded-lg bg-[#96312a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#7d2924] disabled:cursor-not-allowed disabled:opacity-60">
          <Download className="h-4 w-4" />
          {generating ? "Generando..." : "Generar PDF"}
        </button>
      </section>

      <HookForm methods={methods} onSubmit={onSubmit} formId="delivery-guide-form" preventSubmitOnEnter className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Datos de la guía</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HookFormInput<DeliveryGuideValues> name="serie" label="Serie" rules={{ required: "Ingrese la serie." }} />
            <HookFormInput<DeliveryGuideValues> name="number" label="Número" rules={{ required: "Ingrese el número." }} inputMode="numeric" />
            <HookFormInput<DeliveryGuideValues> name="deliveryDate" label="Fecha de traslado" type="date" rules={{ required: "Ingrese la fecha." }} />
            <HookFormInput<DeliveryGuideValues> name="emissionTime" label="Hora de emisión" type="time" rules={{ required: "Ingrese la hora." }} />
            <HookFormSelect<DeliveryGuideValues> name="reason" label="Motivo de traslado" options={[{ value: "OTROS", label: "OTROS" }, { value: "VENTA", label: "VENTA" }, { value: "TRASLADO ENTRE ESTABLECIMIENTOS", label: "TRASLADO ENTRE ESTABLECIMIENTOS" }]} />
            <HookFormInput<DeliveryGuideValues> name="reasonDescription" label="Descripción del motivo" />
            <HookFormSelect<DeliveryGuideValues> name="transportMode" label="Modalidad de traslado" options={[{ value: "PÚBLICO", label: "PÚBLICO" }, { value: "PRIVADO", label: "PRIVADO" }]} />
            <HookFormSelect<DeliveryGuideValues> name="transshipment" label="Transbordo programado" options={[{ value: "NO", label: "NO" }, { value: "SÍ", label: "SÍ" }]} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Destinatario y traslado</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <HookFormInput<DeliveryGuideValues> name="recipient" label="Destinatario" rules={{ required: "Ingrese el destinatario." }} />
            <HookFormInput<DeliveryGuideValues> name="recipientDocument" label="RUC/DNI del destinatario" rules={{ required: "Ingrese el documento." }} inputMode="numeric" />
            <HookFormInput<DeliveryGuideValues> name="departure" label="Punto de partida" rules={{ required: "Ingrese el punto de partida." }} />
            <HookFormInput<DeliveryGuideValues> name="arrival" label="Punto de llegada" rules={{ required: "Ingrese el punto de llegada." }} />
            <HookFormInput<DeliveryGuideValues> name="grossWeight" label="Peso bruto total" type="number" min="0" step="0.001" />
            <HookFormSelect<DeliveryGuideValues> name="weightUnit" label="Unidad de peso" options={[{ value: "KGM", label: "KGM" }]} />
            <HookFormSelect<DeliveryGuideValues> name="m1Vehicle" label="Vehículo categoría M1 o L" options={[{ value: "NO", label: "NO" }, { value: "SÍ", label: "SÍ" }]} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-base font-semibold text-slate-900">Bienes por transportar</h2><p className="mt-1 text-sm text-slate-600">Incluye los códigos disponibles y la cantidad a trasladar.</p></div>
            <button type="button" onClick={() => append(newItem())} className="inline-flex items-center gap-2 rounded-lg border border-[#96312a] px-3 py-2 text-sm font-semibold text-[#96312a] transition-colors hover:bg-[#96312a]/5"><Plus className="h-4 w-4" />Agregar bien</button>
          </div>
          <div className="mt-4 space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2 xl:grid-cols-[1.5fr_repeat(5,minmax(0,1fr))_auto]">
                <HookFormInput<DeliveryGuideValues> name={`items.${index}.description`} label="Descripción" rules={{ required: "Ingrese la descripción." }} />
                <HookFormInput<DeliveryGuideValues> name={`items.${index}.code`} label="Código bien" />
                <HookFormInput<DeliveryGuideValues> name={`items.${index}.sunatCode`} label="Código SUNAT" />
                <HookFormInput<DeliveryGuideValues> name={`items.${index}.gtin`} label="Código GTIN" />
                <HookFormInput<DeliveryGuideValues> name={`items.${index}.unit`} label="Unidad" />
                <HookFormInput<DeliveryGuideValues> name={`items.${index}.quantity`} label="Cantidad" type="number" min="0.001" step="0.001" rules={{ required: "Ingrese la cantidad." }} />
                <button type="button" aria-label={`Quitar bien ${index + 1}`} disabled={fields.length === 1} onClick={() => remove(index)} className="self-end justify-self-end rounded-md p-2 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </section>
      </HookForm>

      <p className="flex items-center gap-2 px-1 text-xs text-slate-500"><FilePlus2 className="h-4 w-4" />La guía se genera localmente como PDF; no registra ni envía un comprobante electrónico.</p>
    </div>
  );
}
