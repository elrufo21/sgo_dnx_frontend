import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";

import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { focusFirstInput } from "@/shared/helpers/focusFirstInput";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { useDialogStore } from "@/store/app/dialog.store";
import { useAuthStore } from "@/store/auth/auth.store";
import type { Client } from "@/types/customer";

type CustomerFormValues = Omit<Client, "id"> & {
  tipoDocumento: "ruc" | "dni";
  numeroDocumento?: string;
};

const buildRegistradoPorDefault = (preferredName?: string | null) => {
  if (preferredName) return preferredName;
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  return `user-${day}${month}${year}`;
};

interface ClientFormBaseProps {
  initialData?: Partial<Client>;
  mode: "create" | "edit";
  onSave: (data: Omit<Client, "id">) => Promise<boolean> | boolean;
  onNew?: () => void;
  onDelete?: () => void;
  variant?: "page" | "modal";
}

const buildDefaults = (
  data?: Partial<Client>,
  registradoPor?: string | null,
): CustomerFormValues => ({
  nombreRazon: data?.nombreRazon ?? "",
  ruc: data?.ruc ?? "",
  dni: data?.dni ?? "",
  direccionFiscal: data?.direccionFiscal ?? "",
  direccionDespacho: data?.direccionDespacho ?? "",
  telefonoMovil: data?.telefonoMovil ?? "",
  email: data?.email ?? "",
  registradoPor:
    data?.registradoPor ?? buildRegistradoPorDefault(registradoPor),
  estado: data?.estado ?? "ACTIVO",
  fecha: data?.fecha ?? null,
  tipoDocumento: data?.dni ? "dni" : "ruc",
  numeroDocumento: data?.dni ?? data?.ruc ?? "",
});

export default function CustomerFormBase({
  initialData,
  mode,
  onSave,
  onNew,
  onDelete,
  variant = "page",
}: ClientFormBaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousTipoDocumentoRef = useRef<"ruc" | "dni" | null>(null);
  const setDialogData = useDialogStore((s) => s.setData);
  const setMobileActions = useDialogStore((s) => s.setMobileActions);
  const authUser = useAuthStore((s) => s.user);
  const registradoPorUser = authUser?.displayName ?? authUser?.username ?? null;
  const isModal = variant === "modal";

  const defaults = useMemo(
    () =>
      mode === "edit"
        ? buildDefaults(initialData, registradoPorUser)
        : buildDefaults(
            {
              ...initialData,
              registradoPor: buildRegistradoPorDefault(registradoPorUser),
            },
            registradoPorUser,
          ),
    [initialData, mode, registradoPorUser],
  );

  const formMethods = useForm<CustomerFormValues>({
    defaultValues: defaults,
  });

  const {
    reset,
    getValues,
    setValue,
    setFocus,
    setError,
    clearErrors,
    watch,
    formState: { isSubmitting },
  } = formMethods;

  const selectedTipoDocumento = watch("tipoDocumento");
  const documentMaxLength = selectedTipoDocumento === "dni" ? 8 : 11;

  const focusNombreRazon = () => {
    window.requestAnimationFrame(() => {
      setFocus("nombreRazon");

      const nombreInput =
        containerRef.current?.querySelector<HTMLInputElement>(
          '[data-focus-first="true"]',
        );

      if (!nombreInput || nombreInput.disabled) {
        focusFirstInput(containerRef.current);
        return;
      }

      nombreInput.focus({ preventScroll: true });
      nombreInput.select?.();
    });
  };

  const handleTipoDocumentoChange = (tipo: "ruc" | "dni") => {
    setValue("tipoDocumento", tipo, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setValue("numeroDocumento", "", {
      shouldDirty: true,
      shouldValidate: false,
    });
    clearErrors("numeroDocumento");
    window.requestAnimationFrame(() => {
      setFocus("numeroDocumento");
    });
  };

  useEffect(() => {
    focusFirstInput(containerRef.current);
  }, [mode, initialData]);

  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  useEffect(() => {
    const current = String(getValues("numeroDocumento") ?? "")
      .replace(/\D/g, "")
      .trim();

    if (current.length > documentMaxLength) {
      setValue("numeroDocumento", current.slice(0, documentMaxLength), {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    clearErrors("numeroDocumento");
  }, [
    selectedTipoDocumento,
    documentMaxLength,
    getValues,
    setValue,
    clearErrors,
  ]);

  useEffect(() => {
    if (!selectedTipoDocumento) return;
    if (previousTipoDocumentoRef.current === null) {
      previousTipoDocumentoRef.current = selectedTipoDocumento;
      return;
    }
    if (previousTipoDocumentoRef.current !== selectedTipoDocumento) {
      clearErrors("numeroDocumento");
    }
    previousTipoDocumentoRef.current = selectedTipoDocumento;
  }, [selectedTipoDocumento, clearErrors]);

  useEffect(() => {
    if (variant !== "modal") return;
    const subscription = formMethods.watch((values) => {
      setDialogData({
        ...values,
        nombreRazon: values.nombreRazon?.toUpperCase() ?? "",
      });
    });
    return () => subscription.unsubscribe();
  }, [variant, formMethods, setDialogData]);

  const handleSave = async (values: CustomerFormValues) => {
    const nombreRazonUpper = values.nombreRazon?.toUpperCase() ?? "";
    const payload: Omit<Client, "id"> = {
      nombreRazon: nombreRazonUpper,
      ruc: values.ruc,
      dni: values.dni,
      direccionFiscal: values.direccionFiscal,
      direccionDespacho: values.direccionDespacho,
      telefonoMovil: values.telefonoMovil,
      email: values.email,
      registradoPor: values.registradoPor,
      estado: values.estado,
      fecha: values.fecha ?? null,
    };
    const saved = await onSave(payload);
    if (saved === false) return;
    setDialogData(payload);
    focusNombreRazon();
  };

  const handleNew = useCallback(() => {
    reset(buildDefaults());
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

  const handleConsultarDocumento = async () => {
    const tipoDocumento: "ruc" | "dni" =
      selectedTipoDocumento === "dni" ? "dni" : "ruc";
    const numeroDocumento = String(getValues("numeroDocumento") ?? "")
      .replace(/\D/g, "")
      .trim();

    if (!numeroDocumento) {
      setError("numeroDocumento", {
        type: "manual",
        message: "Ingrese un numero de documento",
      });
      return;
    }

    if (!/^\d+$/.test(numeroDocumento)) {
      setError("numeroDocumento", {
        type: "manual",
        message: "Solo se permiten numeros",
      });
      return;
    }

    const expectedLength = tipoDocumento === "dni" ? 8 : 11;
    if (numeroDocumento.length !== expectedLength) {
      setError("numeroDocumento", {
        type: "manual",
        message:
          tipoDocumento === "dni"
            ? "Ingrese correctamente los 8 numeros del DNI"
            : "Ingrese correctamente los 11 numeros del RUC",
      });
      return;
    }

    clearErrors("numeroDocumento");

    const token = String(import.meta.env.VITE_API_DOCUMENTO ?? "").trim();
    if (!token) {
      console.error("Falta VITE_API_DOCUMENTO en .env");
      toast.error("Falta configurar el token de consulta en .env");
      return;
    }

    const endpoint = tipoDocumento === "dni" ? "dni" : "ruc";
    const url = `https://dniruc.apisperu.com/api/v1/${endpoint}/${numeroDocumento}?token=${token}`;

    const response = await apiRequest<unknown>({
      url,
      method: "GET",
      fallback: null,
    });

    console.log(`[consulta ${endpoint}]`, response);

    if (!response || typeof response !== "object") {
      console.warn("Respuesta invalida del servicio de consulta");
      toast.error("No se pudo consultar el documento");
      return;
    }

    const responseRecord = response as Record<string, unknown>;
    const responseDataCandidate = responseRecord.response as
      | Record<string, unknown>
      | undefined;
    const nestedData = responseDataCandidate?.data;
    const data =
      nestedData && typeof nestedData === "object"
        ? (nestedData as Record<string, unknown>)
        : responseRecord;

    const asText = (value: unknown) => String(value ?? "").trim();
    const pickFirst = (...values: unknown[]) =>
      values.map(asText).find((v) => v.length > 0) ?? "";

    const apiMessage = pickFirst(
      data.message,
      data.error,
      (data as { errors?: unknown }).errors,
    );
    const successFlag = data.success;

    if (successFlag === false) {
      toast.error(apiMessage || "No se encontraron datos del documento");
      return;
    }

    if (tipoDocumento === "dni") {
      const nombreCompleto = [
        asText(data.nombres),
        asText(data.apellidoPaterno),
        asText(data.apellidoMaterno),
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      const dni = pickFirst(data.dni, numeroDocumento);

      if (!nombreCompleto && !dni) {
        toast.error(apiMessage || "No se encontraron datos para ese DNI");
        return;
      }

      if (nombreCompleto) {
        setValue("nombreRazon", nombreCompleto, { shouldDirty: true });
      }
      setValue("dni", dni, { shouldDirty: true });
      setValue("ruc", "", { shouldDirty: true });
      setValue("direccionFiscal", "-", { shouldDirty: true });
      setValue("direccionDespacho", "-", { shouldDirty: true });
      setValue("numeroDocumento", "", { shouldDirty: true });
      setFocus("nombreRazon");
      return;
    }

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

    if (!razonSocial && !ruc) {
      toast.error(apiMessage || "No se encontraron datos para ese RUC");
      return;
    }

    if (razonSocial) {
      setValue("nombreRazon", razonSocial, { shouldDirty: true });
    }
    setValue("ruc", ruc, { shouldDirty: true });
    setValue("dni", "", { shouldDirty: true });
    if (direccion) {
      setValue("direccionFiscal", direccion, { shouldDirty: true });
      setValue("direccionDespacho", direccion, { shouldDirty: true });
    }
    setValue("numeroDocumento", "", { shouldDirty: true });
    setFocus("nombreRazon");
  };

  return (
    <div
      ref={containerRef}
      className={`h-auto py-8 px-4 sm:px-6 lg:px-8 ${
        isModal ? "" : "from-blue-50 via-indigo-50 to-purple-50"
      }`}
    >
      <div className="max-w-5xl mx-auto">
        <div
          className={`bg-white ${
            isModal
              ? "overflow-hidden"
              : "overflow-visible rounded-2xl shadow-xl"
          }`}
        >
          <HookForm methods={formMethods} onSubmit={handleSave}>
            {!isModal && (
              <div className="sticky top-20 sm:top-2 z-30 bg-[#B23636] text-white px-4 py-3 rounded-t-2xl flex items-center justify-between shadow-lg shadow-black/10">
                <div className="flex items-center gap-3">
                  <BackArrowButton />
                  <h1 className="text-base font-semibold">
                    {mode === "create"
                      ? "Registrar Nuevo Cliente"
                      : "Editar Cliente"}
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
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 order-2 lg:order-1">
                  <div className="col-span-2">
                    <HookFormInput<CustomerFormValues>
                      data-focus-first="true"
                      name="nombreRazon"
                      label="Nombre o Razon Social"
                      placeholder="Ingrese nombre o razon social"
                      rules={{ required: "El nombre es obligatorio" }}
                    />
                  </div>

                  <HookFormInput<CustomerFormValues>
                    name="ruc"
                    label="RUC"
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

                  <HookFormInput<CustomerFormValues>
                    name="dni"
                    label="DNI"
                    type="text"
                    inputMode="numeric"
                    maxLength={8}
                    pattern="[0-9]*"
                    placeholder="Ingrese DNI"
                    rules={{
                      pattern: {
                        value: /^\d{8}$/,
                        message: "Debe tener 8 digitos numericos",
                      },
                      maxLength: {
                        value: 8,
                        message: "Debe tener 8 digitos",
                      },
                      minLength: {
                        value: 8,
                        message: "Debe tener 8 digitos",
                      },
                    }}
                  />

                  <HookFormInput<CustomerFormValues>
                    name="direccionFiscal"
                    label="Direccion Fiscal"
                    placeholder="Ingrese direccion fiscal"
                  />

                  <HookFormInput<CustomerFormValues>
                    name="direccionDespacho"
                    label="Direccion de Despacho"
                    placeholder="Ingrese direccion de despacho"
                  />

                  <HookFormInput<CustomerFormValues>
                    name="telefonoMovil"
                    label="Telefono Movil"
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="Ingrese telefono movil"
                    rules={{
                      pattern: {
                        value: /^\d+$/,
                        message: "Solo numeros",
                      },
                    }}
                  />

                  <HookFormInput<CustomerFormValues>
                    name="email"
                    label="Correo / Email"
                    type="email"
                    placeholder="Ingrese correo electronico"
                    rules={{
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.com$/i,
                        message: "Debe incluir @ y terminar en .com",
                      },
                    }}
                  />

                  <HookFormInput<CustomerFormValues>
                    name="registradoPor"
                    label="Registrado por"
                    placeholder="Nombre del usuario"
                    disabled
                  />

                  <HookFormSelect<CustomerFormValues>
                    name="estado"
                    label="Estado"
                    options={[
                      { value: "ACTIVO", label: "Activo" },
                      { value: "INACTIVO", label: "Inactivo" },
                    ]}
                    disabled={mode === "create"}
                  />
                </div>

                <div className="border-t-2 border-gray-100 pt-4 order-1 lg:order-2">
                  <div className="space-y-4">
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="ruc"
                          {...formMethods.register("tipoDocumento")}
                          checked={selectedTipoDocumento === "ruc"}
                          onChange={() => handleTipoDocumentoChange("ruc")}
                          className="w-5 h-5 text-slate-600 focus:ring-2 focus:ring-slate-500"
                        />
                        <span className="text-gray-700 font-medium">RUC</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          value="dni"
                          {...formMethods.register("tipoDocumento")}
                          checked={selectedTipoDocumento === "dni"}
                          onChange={() => handleTipoDocumentoChange("dni")}
                          className="w-5 h-5 text-slate-600 focus:ring-2 focus:ring-slate-500"
                        />
                        <span className="text-gray-700 font-medium">DNI</span>
                      </label>
                    </div>

                    <div className="flex flex-col gap-2">
                      <HookFormInput<CustomerFormValues>
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={documentMaxLength}
                        onInput={(event) => {
                          const input = event.currentTarget;
                          input.value = input.value
                            .replace(/\D/g, "")
                            .slice(0, documentMaxLength);
                        }}
                        name="numeroDocumento"
                        label="Numero de documento"
                        placeholder={
                          selectedTipoDocumento === "dni"
                            ? "Ingrese DNI (8 digitos)"
                            : "Ingrese RUC (11 digitos)"
                        }
                      />
                      <button
                        type="button"
                        className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors cursor-pointer"
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
    </div>
  );
}

