import React, { useEffect, useMemo, useRef } from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import DataTable from "./DataTable";
import { createColumnHelper } from "@tanstack/react-table";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { focusFirstInput } from "@/shared/helpers/focusFirstInput";

interface CuentaBancaria {
  entidadBancaria: string;
  moneda: string;
  tipoCuenta: string;
  numeroCuenta: string;
}

type PurchaseFormValues = {
  nombreRazon: string;
  ruc: string;
  contacto: string;
  celular: string;
  email: string;
  direccion: string;
  estado: "ACTIVO" | "INACTIVO";
  cuentasBancarias: CuentaBancaria[];
  cuentaTemp: CuentaBancaria;
};

interface PurchaseFormBaseProps {
  initialData?: Partial<PurchaseFormValues>;
  mode: "create" | "edit";
  onSave: (data: PurchaseFormValues) => void | Promise<void>;
  onNew?: () => void;
  onDelete?: () => void;
}

const buildDefaults = (
  data?: Partial<PurchaseFormValues>,
): PurchaseFormValues => ({
  nombreRazon: data?.nombreRazon ?? "",
  ruc: data?.ruc ?? "",
  contacto: data?.contacto ?? "",
  celular: data?.celular ?? "",
  email: data?.email ?? "",
  direccion: data?.direccion ?? "",
  estado: (data?.estado as PurchaseFormValues["estado"]) ?? "ACTIVO",
  cuentasBancarias: data?.cuentasBancarias ?? [],
  cuentaTemp: {
    entidadBancaria: "",
    moneda: "",
    tipoCuenta: "",
    numeroCuenta: "",
  },
});

export default function PurchaseFormBase({
  initialData,
  mode,
  onSave,
  onNew,
  onDelete,
}: PurchaseFormBaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const defaults = useMemo(() => buildDefaults(initialData), [initialData]);

  const formMethods = useForm<PurchaseFormValues>({
    defaultValues: defaults,
  });

  const {
    control,
    reset,
    setValue,
    getValues,
    watch,
    trigger,
    formState: { isSubmitting },
  } = formMethods;

  const { fields, append, update } = useFieldArray({
    control,
    name: "cuentasBancarias",
  });

  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  useEffect(() => {
    focusFirstInput(containerRef.current);
  }, [mode, initialData]);

  const handleNew = () => {
    reset(buildDefaults());
    onNew?.();
    focusFirstInput(containerRef.current);
  };

  const handleAddCuenta = async () => {
    const temp = getValues("cuentaTemp");
    const valid = await trigger([
      "cuentaTemp.entidadBancaria",
      "cuentaTemp.moneda",
      "cuentaTemp.tipoCuenta",
      "cuentaTemp.numeroCuenta",
    ]);
    if (!valid) return;

    const existingIndex = fields.findIndex(
      (c) => c.numeroCuenta === temp.numeroCuenta,
    );
    if (existingIndex >= 0) {
      update(existingIndex, temp);
    } else {
      append(temp);
    }

    setValue("cuentaTemp", {
      entidadBancaria: "",
      moneda: "",
      tipoCuenta: "",
      numeroCuenta: "",
    });
  };

  const onSubmit = async (values: PurchaseFormValues) => {
    await onSave({
      ...values,
      nombreRazon: values.nombreRazon?.toUpperCase() ?? "",
      contacto: values.contacto?.toUpperCase() ?? "",
    });
    focusFirstInput(containerRef.current);
    if (mode === "create") {
      handleNew();
    }
  };

  const columnHelper = createColumnHelper<CuentaBancaria>();
  const columns = [
    columnHelper.accessor("entidadBancaria", {
      header: "Entidad bancaria",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("tipoCuenta", {
      header: "Tipo de cuenta",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("moneda", {
      header: "Moneda",
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("numeroCuenta", {
      header: "Numero de cuenta",
      cell: (info) => info.getValue(),
    }),
  ];

  const cuentasBancarias = watch("cuentasBancarias");

  return (
    <div
      ref={containerRef}
      className="h-auto px-3 py-5 sm:px-6 sm:py-7 lg:px-8"
    >
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-visible">
          <HookForm methods={formMethods} onSubmit={onSubmit}>
            <div className="sticky top-20 sm:top-2 z-30 bg-[#B23636] text-white px-4 py-3 rounded-t-2xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shadow-lg shadow-black/10">
              <div className="flex items-center gap-3 min-w-0">
                <BackArrowButton />
                <h1 className="text-base font-semibold truncate">
                  {mode === "create"
                    ? "Crear Proveedor / Cliente"
                    : "Editar Proveedor / Cliente"}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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

            <div className="p-4 sm:p-6 lg:p-8">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
                <div className="w-full space-y-4 xl:col-span-2">
                  <HookFormInput<PurchaseFormValues>
                    data-focus-first
                    name="nombreRazon"
                    label="Nombre / Razon Social"
                    placeholder="Ingrese nombre o razon social"
                    rules={{ required: "El nombre o razon es obligatorio" }}
                  />

                  <HookFormInput<PurchaseFormValues>
                    name="ruc"
                    type="number"
                    label="RUC"
                    placeholder="Ingrese RUC"
                    rules={{ required: "El RUC es obligatorio" }}
                  />

                  <HookFormInput<PurchaseFormValues>
                    name="contacto"
                    label="Contacto"
                    placeholder="Nombre del contacto"
                  />

                  <HookFormInput<PurchaseFormValues>
                    name="celular"
                    type="tel"
                    label="Celular"
                    placeholder="Ingrese numero de celular"
                  />

                  <HookFormInput<PurchaseFormValues>
                    name="email"
                    type="email"
                    label="Email"
                    placeholder="Ingrese correo electronico"
                  />

                  <HookFormInput<PurchaseFormValues>
                    name="direccion"
                    label="Direccion"
                    placeholder="Ingrese direccion"
                  />

                  <HookFormSelect<PurchaseFormValues>
                    name="estado"
                    label="Estado"
                    options={[
                      { value: "ACTIVO", label: "Activo" },
                      { value: "INACTIVO", label: "Inactivo" },
                    ]}
                  />
                </div>

                <div className="w-full xl:col-span-3">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
                    <HookFormSelect<PurchaseFormValues>
                      name="cuentaTemp.entidadBancaria"
                      label="Entidad Bancaria"
                      options={[
                        { value: "", label: "Seleccione banco" },
                        { value: "BCP", label: "BCP" },
                        { value: "Interbank", label: "Interbank" },
                        { value: "Scotiabank", label: "Scotiabank" },
                      ]}
                      rules={{ required: "Seleccione una entidad" }}
                    />

                    <HookFormSelect<PurchaseFormValues>
                      name="cuentaTemp.moneda"
                      label="Moneda"
                      options={[
                        { value: "", label: "Seleccione moneda" },
                        { value: "PEN", label: "Soles (PEN)" },
                        { value: "USD", label: "Dolares (USD)" },
                      ]}
                      rules={{ required: "Seleccione una moneda" }}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-4">
                    <HookFormSelect<PurchaseFormValues>
                      name="cuentaTemp.tipoCuenta"
                      label="Tipo de Cuenta"
                      options={[
                        { value: "", label: "Seleccione tipo" },
                        { value: "Ahorros", label: "Ahorros" },
                        { value: "Corriente", label: "Corriente" },
                      ]}
                      rules={{ required: "Seleccione un tipo de cuenta" }}
                    />

                    <HookFormInput<PurchaseFormValues>
                      name="cuentaTemp.numeroCuenta"
                      label="Numero de Cuenta"
                      placeholder="Ingrese numero de cuenta"
                      rules={{ required: "El numero de cuenta es obligatorio" }}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCuenta}
                    className="mb-4 w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                  >
                    Agregar / Actualizar Cuenta
                  </button>

                  <DataTable
                    columns={columns}
                    data={cuentasBancarias}
                    onRowClick={(row) => {
                      setValue("cuentaTemp", row);
                    }}
                  />
                </div>
              </div>
            </div>
          </HookForm>
        </div>
      </div>
    </div>
  );
}

