import { pdf } from "@react-pdf/renderer";
import JSZip from "jszip";
import { Archive, Download, FileCode2, FilePlus2, Plus, Trash2 } from "lucide-react";
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
import {
  crearXmlGreRemitente,
  greXmlFileName,
  greZipFileName,
} from "@/features/sales/components/greRemitenteXml";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import { toast } from "@/shared/ui/toast";
import { useAuthStore } from "@/store/auth/auth.store";

const newItem = (): DeliveryGuideItem => ({
  description: "",
  code: "",
  sunatCode: "",
  gtin: "",
  quantity: "1",
  unit: "NIU",
});

const currentTime = () =>
  new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export default function DeliveryGuidePage() {
  const user = useAuthStore((state) => state.user);
  const [generating, setGenerating] = useState(false);
  const methods = useForm<DeliveryGuideValues>({
    defaultValues: {
      serie: "T001",
      number: "00000001",
      deliveryDate: getLocalDateISO(),
      emissionTime: currentTime(),
      reason: "04",
      reasonDescription: "TRASLADO ENTRE ESTABLECIMIENTOS",
      recipient: user?.companyName || user?.companyCommercialName || "",
      recipientDocument: user?.companyRuc || "",
      departure: user?.companySunatAddress || "",
      departureUbigeo: "",
      arrival: "",
      arrivalUbigeo: "",
      transportMode: "02",
      transshipment: "NO",
      m1Vehicle: "NO",
      vehiclePlate: "",
      driverDocument: "",
      grossWeight: "",
      weightUnit: "KGM",
      items: [newItem()],
    },
  });
  const { fields, append, remove } = useFieldArray({
    control: methods.control,
    name: "items",
  });

  const validItems = (values: DeliveryGuideValues) =>
    values.items.filter(
      (item) => item.description.trim() && Number(item.quantity) > 0,
    );

  const prepararXml = (values: DeliveryGuideValues) => {
    if (!user?.companyRuc || !(user.companyName || user.companyCommercialName)) {
      toast.error("La sesión debe incluir el RUC y razón social de la empresa.");
      return null;
    }

    const items = validItems(values);
    if (!items.length) {
      toast.error("Agrega al menos un bien con descripción y cantidad.");
      return null;
    }

    return {
      xml: crearXmlGreRemitente({ ...values, items }, {
      nombre: user.companyName || user.companyCommercialName,
      ruc: user.companyRuc,
      }),
      fileName: greXmlFileName(user.companyRuc, values.serie, values.number),
    };
  };

  const descargar = (file: Blob, fileName: string) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const descargarXml = (values: DeliveryGuideValues) => {
    const archivo = prepararXml(values);
    if (!archivo) return;

    descargar(new Blob([archivo.xml], { type: "application/xml;charset=utf-8" }), archivo.fileName);
    toast.success("XML GRE generado. Valídalo con SFS antes de usarlo.");
  };

  const descargarZip = async (values: DeliveryGuideValues) => {
    const archivo = prepararXml(values);
    if (!archivo) return;

    setGenerating(true);
    try {
      const zip = new JSZip();
      zip.file(archivo.fileName, archivo.xml);
      descargar(
        await zip.generateAsync({ type: "blob", compression: "DEFLATE" }),
        greZipFileName(user?.companyRuc ?? "", values.serie, values.number),
      );
      toast.success("ZIP GRE generado. Contiene el XML local sin firma.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar el ZIP.");
    } finally {
      setGenerating(false);
    }
  };

  const generarPdf = async (values: DeliveryGuideValues) => {
    const items = validItems(values);
    if (!items.length) {
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
          values={{ ...values, items }}
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
          <p className="mt-1 text-sm text-slate-600">Genera un XML preliminar para validarlo antes de integrarlo con SUNAT.</p>
        </div>
        <button type="submit" form="delivery-guide-form" disabled={generating} className="inline-flex items-center gap-2 rounded-lg bg-[#96312a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#7d2924] disabled:cursor-not-allowed disabled:opacity-60">
          <FileCode2 className="h-4 w-4" />
          Generar XML
        </button>
        <button type="button" onClick={methods.handleSubmit(descargarZip)} disabled={generating} className="inline-flex items-center gap-2 rounded-lg border border-[#96312a] px-4 py-2.5 text-sm font-semibold text-[#96312a] transition-colors hover:bg-[#96312a]/5 disabled:cursor-not-allowed disabled:opacity-60">
          <Archive className="h-4 w-4" />
          Generar ZIP
        </button>
      </section>

      <HookForm methods={methods} onSubmit={descargarXml} formId="delivery-guide-form" preventSubmitOnEnter className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Datos de la guía</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HookFormInput<DeliveryGuideValues> name="serie" label="Serie" maxLength={4} rules={{ required: "Ingrese la serie.", pattern: { value: /^T\d{3}$/i, message: "Use una serie T seguida de 3 dígitos." } }} />
            <HookFormInput<DeliveryGuideValues> name="number" label="Número" maxLength={8} rules={{ required: "Ingrese el número.", pattern: { value: /^\d{1,8}$/, message: "Use hasta 8 dígitos." } }} inputMode="numeric" />
            <HookFormInput<DeliveryGuideValues> name="deliveryDate" label="Fecha de traslado" type="date" rules={{ required: "Ingrese la fecha." }} />
            <HookFormInput<DeliveryGuideValues> name="emissionTime" label="Hora de emisión" type="time" rules={{ required: "Ingrese la hora." }} />
            <HookFormSelect<DeliveryGuideValues> name="reason" label="Motivo de traslado" options={[{ value: "04", label: "04 - Traslado entre establecimientos" }]} rules={{ required: "Seleccione el motivo." }} />
            <HookFormInput<DeliveryGuideValues> name="reasonDescription" label="Descripción del motivo" />
            <HookFormSelect<DeliveryGuideValues> name="transportMode" label="Modalidad de traslado" options={[{ value: "02", label: "02 - Transporte privado" }]} rules={{ required: "Seleccione la modalidad." }} />
            <HookFormSelect<DeliveryGuideValues> name="transshipment" label="Transbordo programado" options={[{ value: "NO", label: "NO" }, { value: "SÍ", label: "SÍ" }]} />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Destinatario y traslado</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <HookFormInput<DeliveryGuideValues> name="recipient" label="Destinatario" rules={{ required: "Ingrese el destinatario." }} />
            <HookFormInput<DeliveryGuideValues> name="recipientDocument" label="RUC/DNI del destinatario" maxLength={11} rules={{ required: "Ingrese el documento.", pattern: { value: /^(\d{8}|\d{11})$/, message: "Ingrese un DNI de 8 o RUC de 11 dígitos." } }} inputMode="numeric" />
            <HookFormInput<DeliveryGuideValues> name="departure" label="Punto de partida" rules={{ required: "Ingrese el punto de partida." }} />
            <HookFormInput<DeliveryGuideValues> name="arrival" label="Punto de llegada" rules={{ required: "Ingrese el punto de llegada." }} />
            <HookFormInput<DeliveryGuideValues> name="departureUbigeo" label="Ubigeo de partida" inputMode="numeric" maxLength={6} rules={{ required: "Ingrese el ubigeo.", pattern: { value: /^\d{6}$/, message: "El ubigeo debe tener 6 dígitos." } }} />
            <HookFormInput<DeliveryGuideValues> name="arrivalUbigeo" label="Ubigeo de llegada" inputMode="numeric" maxLength={6} rules={{ required: "Ingrese el ubigeo.", pattern: { value: /^\d{6}$/, message: "El ubigeo debe tener 6 dígitos." } }} />
            <HookFormInput<DeliveryGuideValues> name="grossWeight" label="Peso bruto total" type="number" min="0.001" step="0.001" rules={{ required: "Ingrese el peso bruto.", min: { value: 0.001, message: "El peso debe ser mayor a cero." } }} />
            <HookFormSelect<DeliveryGuideValues> name="weightUnit" label="Unidad de peso" options={[{ value: "KGM", label: "KGM" }]} rules={{ required: "Seleccione la unidad." }} />
            <HookFormInput<DeliveryGuideValues> name="vehiclePlate" label="Placa del vehículo" rules={{ required: "Ingrese la placa." }} />
            <HookFormInput<DeliveryGuideValues> name="driverDocument" label="DNI del conductor" inputMode="numeric" maxLength={8} rules={{ required: "Ingrese el DNI.", pattern: { value: /^\d{8}$/, message: "El DNI debe tener 8 dígitos." } }} />
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
                <HookFormInput<DeliveryGuideValues> name={`items.${index}.unit`} label="Unidad SUNAT" rules={{ required: "Ingrese la unidad." }} />
                <HookFormInput<DeliveryGuideValues> name={`items.${index}.quantity`} label="Cantidad" type="number" min="0.001" step="0.001" rules={{ required: "Ingrese la cantidad." }} />
                <button type="button" aria-label={`Quitar bien ${index + 1}`} disabled={fields.length === 1} onClick={() => remove(index)} className="self-end justify-self-end rounded-md p-2 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </section>
      </HookForm>

      <button type="button" onClick={methods.handleSubmit(generarPdf)} disabled={generating} className="inline-flex items-center gap-2 rounded-lg border border-[#96312a] px-4 py-2.5 text-sm font-semibold text-[#96312a] transition-colors hover:bg-[#96312a]/5 disabled:cursor-not-allowed disabled:opacity-60">
        <Download className="h-4 w-4" />
        {generating ? "Generando..." : "Generar PDF"}
      </button>

      <p className="flex items-center gap-2 px-1 text-xs text-slate-500"><FilePlus2 className="h-4 w-4" />El XML, ZIP y PDF se generan localmente: no registran, firman ni envían una GRE a SUNAT.</p>
    </div>
  );
}
