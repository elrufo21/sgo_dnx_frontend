import { useCallback, useEffect, useMemo, useRef } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import type { Provider } from "@/types/maintenance";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { focusFirstInput } from "@/shared/helpers/focusFirstInput";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { useDialogStore } from "@/store/app/dialog.store";

interface ProviderFormProps {
  initialData?: Partial<Provider>;
  mode: "create" | "edit";
  onSave: (data: Provider) => void | Promise<void>;
  onNew?: () => void;
  onDelete?: () => void;
  variant?: "page" | "modal";
}

type ProviderFormValues = Provider & {
  numeroDocumentoConsulta?: string;
};

export default function ProviderForm({
  initialData,
  mode,
  onSave,
  onNew,
  onDelete,
  variant = "page",
}: ProviderFormProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setDialogData = useDialogStore((s) => s.setData);
  const setMobileActions = useDialogStore((s) => s.setMobileActions);
  const isModal = variant === "modal";

  const defaults = useMemo<ProviderFormValues>(
    () => ({
      id: initialData?.id ?? 0,
      razon: initialData?.razon ?? "",
      ruc: initialData?.ruc ?? "",
      contacto: initialData?.contacto ?? "",
      celular: initialData?.celular ?? "",
      telefono: initialData?.telefono ?? "",
      correo: initialData?.correo ?? "",
      direccion: initialData?.direccion ?? "",
      estado: initialData?.estado ?? "ACTIVO",
      numeroDocumento: initialData?.ruc ?? "",
    }),
    [initialData],
  );

  const formMethods = useForm<ProviderFormValues>({
    defaultValues: defaults,
  });

  const {
    reset,
    getValues,
    setValue,
    setFocus,
    setError,
    clearErrors,
    formState: { isSubmitting },
  } = formMethods;

  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  useEffect(() => {
    focusFirstInput(containerRef.current);
  }, [mode, initialData]);

  useEffect(() => {
    if (!isModal) return;
    setDialogData({
      ...defaults,
    });
    const subscription = formMethods.watch((values) => {
      setDialogData({
        ...values,
        razon: values.razon?.toUpperCase() ?? "",
        contacto: values.contacto?.toUpperCase() ?? "",
        direccion: values.direccion?.toUpperCase() ?? "",
        estado: values.estado?.toUpperCase() ?? "",
      });
    });
    return () => subscription.unsubscribe();
  }, [isModal, formMethods, setDialogData]);

  const handleNew = useCallback(() => {
    reset({
      id: 0,
      razon: "",
      ruc: "",
      contacto: "",
      celular: "",
      telefono: "",
      correo: "",
      direccion: "",
      estado: "ACTIVO",
      numeroDocumento: "",
    });
    onNew?.();
    focusFirstInput(containerRef.current);
  }, [onNew, reset]);

  useEffect(() => {
    if (!isModal) return;

    const previousConfirmText = useDialogStore.getState().confirmText;
    useDialogStore.setState({ confirmText: "Guardar" });

    if (mode !== "edit") {
      setMobileActions(
        <button
          type="button"
          onClick={handleNew}
          aria-label="Nuevo"
          title="Nuevo"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
        </button>,
      );
    } else {
      setMobileActions(<></>);
    }

    return () => {
      setMobileActions(null);
      useDialogStore.setState({ confirmText: previousConfirmText });
    };
  }, [handleNew, isModal, mode, setMobileActions]);

  const onSubmit = async (values: ProviderFormValues) => {
    const { numeroDocumento: _numeroDocumento, ...providerValues } = values;
    const payload: Provider = {
      ...providerValues,
      razon: providerValues.razon?.toUpperCase() ?? "",
      contacto: providerValues.contacto?.toUpperCase() ?? "",
      direccion: providerValues.direccion?.toUpperCase() ?? "",
      estado: providerValues.estado?.toUpperCase() ?? "",
    };
    await onSave(payload);
    if (mode === "create") {
      handleNew();
    }
  };

  const handleConsultarDocumento = async () => {
    const numeroDocumento = String(
      getValues("numeroDocumentoConsulta") ?? "",
    ).trim();

    if (!numeroDocumento) {
      setError("numeroDocumentoConsulta", {
        type: "manual",
        message: "Ingrese un numero de documento",
      });
      return;
    }

    if (!/^\d+$/.test(numeroDocumento)) {
      setError("numeroDocumentoConsulta", {
        type: "manual",
        message: "Solo se permiten numeros",
      });
      return;
    }

    if (numeroDocumento.length !== 11) {
      setError("numeroDocumentoConsulta", {
        type: "manual",
        message: "Ingrese correctamente los 11 numeros del RUC",
      });
      return;
    }

    clearErrors("numeroDocumentoConsulta");

    const token = import.meta.env.VITE_API_DOCUMENTO;
    if (!token) {
      console.error("Falta VITE_API_DOCUMENTO en .env");
      return;
    }

    const url = `https://dniruc.apisperu.com/api/v1/ruc/${numeroDocumento}?token=${token}`;
    const response = await apiRequest({
      url,
      method: "GET",
      fallback: null,
    });

    if (!response || typeof response !== "object") {
      console.warn("Respuesta invalida del servicio de consulta");
      return;
    }

    const data = response as Record<string, unknown>;
    const asText = (value: unknown) => String(value ?? "").trim();
    const pickFirst = (...values: unknown[]) =>
      values.map(asText).find((value) => value.length > 0) ?? "";

    const razonSocial = pickFirst(
      data.razonSocial,
      data.nombreORazonSocial,
      data.nombre_o_razon_social,
      data.nombre,
      data.nombreRazon,
    );
    const direccion = pickFirst(
      data.direccion,
      data.direccionCompleta,
      data.domicilioFiscal,
    );
    const ruc = pickFirst(data.ruc, numeroDocumento);

    if (razonSocial) {
      setValue("razon", razonSocial, { shouldDirty: true });
    }
    setValue("ruc", ruc, { shouldDirty: true });
    if (direccion) {
      setValue("direccion", direccion, { shouldDirty: true });
    }
    setValue("numeroDocumentoConsulta", "", { shouldDirty: true });
    setFocus("razon");
  };

  const estadoOptions = [
    { value: "", label: "Seleccionar..." },
    { value: "ACTIVO", label: "Activo" },
    { value: "INACTIVO", label: "Inactivo" },
  ];

  return (
    <div
      ref={containerRef}
      className={isModal ? "h-auto" : "h-auto py-8 px-4 sm:px-6 lg:px-8"}
    >
      <div
        className={`w-full mx-auto bg-white ${
          isModal
            ? "max-h-[1050px] overflow-x-hidden overflow-y-auto"
            : "overflow-visible rounded-2xl shadow-xl"
        }`}
      >
        <HookForm methods={formMethods} onSubmit={onSubmit}>
          {!isModal && (
            <div className="sticky top-20 sm:top-2 z-30 bg-[#B23636] text-white px-4 py-3 rounded-t-2xl flex items-center justify-between shadow-lg shadow-black/10">
              <div className="flex items-center gap-3">
                <BackArrowButton />
                <h1 className="text-base font-semibold">
                  {mode === "create" ? "Crear proveedor" : "Editar proveedor"}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                {mode === "edit" && onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/20 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Eliminar</span>
                  </button>
                )}
                {mode !== "edit" && (
                  <button
                    type="button"
                    onClick={handleNew}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/20 transition-colors"
                    title="Nuevo"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Nuevo</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 disabled:opacity-70 transition-colors"
                  title="Guardar"
                >
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">Guardar</span>
                </button>
              </div>
            </div>
          )}

          <div className="p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="order-2 lg:order-1 w-full lg:w-[35%] space-y-4">
                <HookFormInput<ProviderFormValues>
                  name="razon"
                  label="Nombre / Razon Social"
                  placeholder="Ingrese nombre o razon social"
                  rules={{ required: "La razon social es obligatoria" }}
                  data-focus-first
                />
                <HookFormInput<ProviderFormValues>
                  name="ruc"
                  label="RUC"
                  placeholder="Ingrese RUC"
                  inputMode="numeric"
                  rules={{
                    validate: (value) => {
                      const normalized = String(value ?? "").trim();
                      return (
                        !normalized ||
                        /^\d{8,20}$/.test(normalized) ||
                        "Ingrese un RUC valido"
                      );
                    },
                  }}
                />
                <HookFormInput<ProviderFormValues>
                  name="contacto"
                  label="Contacto"
                  placeholder="Nombre del contacto"
                />
                <HookFormInput<ProviderFormValues>
                  name="celular"
                  label="Celular"
                  placeholder="Ingrese numero de celular"
                  inputMode="tel"
                />
                <HookFormInput<ProviderFormValues>
                  name="correo"
                  label="Email"
                  placeholder="Ingrese correo electronico"
                  type="email"
                />
                <HookFormInput<ProviderFormValues>
                  name="direccion"
                  label="Direccion"
                  placeholder="Ingrese direccion"
                />
                <HookFormSelect<ProviderFormValues>
                  name="estado"
                  label="Estado"
                  options={estadoOptions}
                  rules={{ required: "El estado es obligatorio" }}
                  disabled={mode !== "edit"}
                />
              </div>

              <div className="order-1 lg:order-2 w-full lg:w-[65%]">
                <div className="space-y-4 w-full lg:w-[70%]">
                  <div className="flex flex-row items-end gap-2 w-full">
                    <div className="flex-1">
                      <HookFormInput<ProviderFormValues>
                        name="numeroDocumentoConsulta"
                        label="Numero de documento"
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="Ingrese RUC"
                        rules={{
                          pattern: {
                            value: /^\d{11}$/,
                            message: "Debe tener 11 digitos",
                          },
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
                      onClick={handleConsultarDocumento}
                    >
                      Consultar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </HookForm>
      </div>
    </div>
  );
}
