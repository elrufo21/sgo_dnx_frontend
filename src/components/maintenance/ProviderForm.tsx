import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import type { Provider, ProviderBankAccount } from "@/types/maintenance";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { focusFirstInput } from "@/shared/helpers/focusFirstInput";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { useDialogStore } from "@/store/app/dialog.store";
import { useMaintenanceStore } from "@/store/maintenance/maintenance.store";

interface ProviderFormProps {
  initialData?: Partial<Provider>;
  initialAccounts?: ProviderBankAccount[];
  mode: "create" | "edit";
  onSave: (
    data: Provider & { cuentasBancarias?: ProviderBankAccount[] },
  ) => void | Promise<void>;
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
  initialAccounts,
  variant = "page",
}: ProviderFormProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setDialogData = useDialogStore((s) => s.setData);
  const setMobileActions = useDialogStore((s) => s.setMobileActions);
  const bankEntities = useMaintenanceStore((s) => s.bankEntities);
  const fetchBankEntities = useMaintenanceStore((s) => s.fetchBankEntities);
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

  const [cuentasBancarias, setCuentasBancarias] = useState<
    ProviderBankAccount[]
  >(
    (
      initialAccounts ??
      (initialData as any)?.cuentasBancarias ??
      (initialData as any)?.cuentas ??
      []
    )?.map((c: ProviderBankAccount) => ({ ...c, action: undefined })) ?? [],
  );

  useEffect(() => {
    reset(defaults);
    setCuentasBancarias(
      (
        initialAccounts ??
        (initialData as any)?.cuentasBancarias ??
        (initialData as any)?.cuentas ??
        []
      ).map((c: ProviderBankAccount) => ({ ...c, action: undefined })),
    );
  }, [defaults, reset, initialData, initialAccounts]);

  useEffect(() => {
    focusFirstInput(containerRef.current);
  }, [mode, initialData]);

  useEffect(() => {
    if (!bankEntities.length) {
      fetchBankEntities();
    }
  }, [bankEntities.length, fetchBankEntities]);

  useEffect(() => {
    if (!isModal) return;
    setDialogData({
      ...defaults,
      cuentasBancarias,
    });
    const subscription = formMethods.watch((values) => {
      setDialogData({
        ...values,
        cuentasBancarias,
        razon: values.razon?.toUpperCase() ?? "",
        contacto: values.contacto?.toUpperCase() ?? "",
        direccion: values.direccion?.toUpperCase() ?? "",
        estado: values.estado?.toUpperCase() ?? "",
      });
    });
    return () => subscription.unsubscribe();
  }, [isModal, formMethods, setDialogData, cuentasBancarias]);

  useEffect(() => {
    if (!isModal) return;
    const values = formMethods.getValues();
    setDialogData({
      ...values,
      cuentasBancarias,
      razon: values.razon?.toUpperCase() ?? "",
      contacto: values.contacto?.toUpperCase() ?? "",
      direccion: values.direccion?.toUpperCase() ?? "",
      estado: values.estado?.toUpperCase() ?? "",
    });
  }, [cuentasBancarias, formMethods, isModal, setDialogData]);

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
    setCuentasBancarias([]);
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
    await onSave({ ...payload, cuentasBancarias });
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

  const bancoOptions =
    bankEntities.length > 0
      ? bankEntities
      : [
          { id: 1, nombre: "BCP" },
          { id: 2, nombre: "Interbank" },
          { id: 3, nombre: "Scotiabank" },
        ];

  const updateCuentaField = (
    index: number,
    field: keyof ProviderBankAccount,
    value: string,
  ) => {
    setCuentasBancarias((prev) => {
      if (!prev[index] || prev[index].action === "d") return prev;
      const updated = { ...prev[index], [field]: value };
      const nextAction =
        updated.action === "i" || !updated.cuentaId ? "i" : "u";
      updated.action = nextAction;
      const copy = [...prev];
      copy[index] = updated;
      return copy;
    });
  };

  const findCuentaIndex = (
    list: ProviderBankAccount[],
    account: ProviderBankAccount,
  ) => {
    if (account.cuentaId) {
      return list.findIndex(
        (c) => c.cuentaId && Number(c.cuentaId) === Number(account.cuentaId),
      );
    }
    return list.findIndex(
      (c) => !c.cuentaId && c.nroCuenta === account.nroCuenta,
    );
  };

  const agregarCuenta = () => {
    setCuentasBancarias((prev) => [
      ...prev,
      {
        cuentaId: undefined,
        proveedorId: initialData?.id,
        entidad: "",
        moneda: "",
        tipoCuenta: "",
        nroCuenta: "",
        action: "i",
      },
    ]);
  };

  const eliminarCuenta = (cuenta: ProviderBankAccount) => {
    setCuentasBancarias((prev) => {
      const idx = findCuentaIndex(prev, cuenta);
      if (idx === -1) return prev;
      const target = prev[idx];

      // Si ya estaba marcado para eliminar, revertimos a estado sin cambios
      if (target.action === "d") {
        const copy = [...prev];
        copy[idx] = { ...target, action: undefined };
        return copy;
      }

      if (target.action === "i" && !target.cuentaId) {
        const copy = [...prev];
        copy.splice(idx, 1);
        return copy;
      }
      const copy = [...prev];
      copy[idx] = { ...target, action: "d" };
      return copy;
    });
  };

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
                {mode !== "create" && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden mt-3">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-gray-700">
                        <tr>
                          <th className="py-2 px-3 text-left">
                            Entidad bancaria
                          </th>
                          <th className="py-2 px-3 text-left">
                            Tipo de cuenta
                          </th>
                          <th className="py-2 px-3 text-left">Moneda</th>
                          <th className="py-2 px-3 text-left">
                            Numero de cuenta
                          </th>
                          <th className="py-2 px-3 text-right w-32">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {cuentasBancarias.map((cuenta, idx) => {
                          const isDeleted = cuenta.action === "d";
                          return (
                            <tr
                              key={`${cuenta.cuentaId ?? "new"}-${idx}`}
                              className={`border-t border-gray-100 ${
                                isDeleted ? "text-gray-400 line-through" : ""
                              }`}
                            >
                              <td className="py-2 px-3">
                                <select
                                  value={cuenta.entidad}
                                  onChange={(e) =>
                                    updateCuentaField(
                                      idx,
                                      "entidad",
                                      e.target.value,
                                    )
                                  }
                                  disabled={isDeleted}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                                >
                                  <option value="">Seleccione banco</option>
                                  {bancoOptions.map((banco) => (
                                    <option key={banco.id} value={banco.nombre}>
                                      {banco.nombre}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2 px-3">
                                <select
                                  value={cuenta.tipoCuenta}
                                  onChange={(e) =>
                                    updateCuentaField(
                                      idx,
                                      "tipoCuenta",
                                      e.target.value,
                                    )
                                  }
                                  disabled={isDeleted}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                                >
                                  <option value="">Seleccione tipo</option>
                                  <option value="Ahorros">Ahorros</option>
                                  <option value="Corriente">Corriente</option>
                                </select>
                              </td>
                              <td className="py-2 px-3">
                                <select
                                  value={cuenta.moneda}
                                  onChange={(e) =>
                                    updateCuentaField(
                                      idx,
                                      "moneda",
                                      e.target.value,
                                    )
                                  }
                                  disabled={isDeleted}
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                                >
                                  <option value="">Seleccione moneda</option>
                                  <option value="PEN">Soles (PEN)</option>
                                  <option value="USD">Dolares (USD)</option>
                                </select>
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={cuenta.nroCuenta}
                                  onChange={(e) =>
                                    updateCuentaField(
                                      idx,
                                      "nroCuenta",
                                      e.target.value,
                                    )
                                  }
                                  disabled={isDeleted}
                                  placeholder="Ingrese numero de cuenta"
                                  className="w-full px-2 py-1.5 border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => eliminarCuenta(cuenta)}
                                    className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 transition-colors ${
                                      isDeleted
                                        ? "text-slate-600 hover:bg-slate-100"
                                        : "text-red-600 hover:bg-red-50"
                                    }`}
                                    title={isDeleted ? "Revertir" : "Eliminar"}
                                  >
                                    {isDeleted ? (
                                      <span className="text-xs font-medium">
                                        Revertir
                                      </span>
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="border-t bg-gray-50">
                          <td colSpan={5} className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={agregarCuenta}
                              className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                            >
                              Agregar fila
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </HookForm>
      </div>
    </div>
  );
}

