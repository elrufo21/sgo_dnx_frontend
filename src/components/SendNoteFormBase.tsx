import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import { Save, Plus, Trash2, Search, Lock, Pencil } from "lucide-react";
import { focusFirstInput } from "@/shared/helpers/focusFirstInput";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { HookFormAutocomplete } from "@/components/forms/HookFormAutocomplete";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import AutocompleteTableCell from "@/components/forms/table/AutoCompleteTable";
import EditableTextCell from "@/components/forms/table/EditableTextCell";
import EditableDataTable from "@/components/forms/table/FormTable";
import SendNoteTotalsPanel from "@/components/sendNote/SendNoteTotalsPanel";
import CustomerFormBase from "@/components/CustomerFormBase";
import { GenericList } from "@/shared/listing/GenericList";
import { MemoryRouter } from "react-router";
import type { SendNote, SendNoteItem } from "@/types/sendNote";
import type { Product } from "@/types/product";
import { useProductsStore } from "@/store/products/products.store";
import { useClientsStore } from "@/store/customers/customers.store";
import type { Client } from "@/types/customer";
import { useDialogStore } from "@/store/app/dialog.store";
import { useAuthStore } from "@/store/auth/auth.store";
import { toast } from "@/shared/ui/toast";
import { getLocalDateISO } from "@/shared/helpers/localDate";

const entidadOptions = [
  { value: "Banco 1", label: "Banco 1" },
  { value: "Banco 2", label: "Banco 2" },
];

const conceptoOptions = [
  { value: "mercaderia", label: "Mercaderia" },
  { value: "servicio", label: "Servicio" },
];

const tipoDocumentoOptions = [
  { value: "101", label: "Proforma V" },
  { value: "03", label: "Boleta" },
  { value: "01", label: "Factura" },
];

type SendNoteFormValues = Omit<SendNote, "id">;

interface SendNoteFormBaseProps {
  initialData?: Partial<SendNote>;
  mode: "create" | "edit";
  onSave: (data: Omit<SendNote, "id">) => void;
  onNew?: () => void;
  onDelete?: () => void;
  readOnly?: boolean;
}

export default function SendNoteFormBase({
  initialData,
  mode,
  onSave,
  onNew,
  onDelete,
  readOnly = false,
}: SendNoteFormBaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { products, fetchProducts } = useProductsStore();
  const { clients, fetchClients, addClient } = useClientsStore();
  const [isEditable, setIsEditable] = useState(!readOnly);
  const openDialog = useDialogStore((s) => s.openDialog);
  const closeDialog = useDialogStore((s) => s.closeDialog);
  const authUser = useAuthStore((s) => s.user);

  const defaultRow: SendNoteItem = {
    productId: null,
    codigo: "",
    nombre: "",
    unidadMedida: "",
    cantidad: 0,
    preCosto: 0,
    descuento: 0,
    importe: 0,
  };

  const responsibleUser =
    initialData?.usuarioResponsable ??
    initialData?.atendidoPor ??
    authUser?.displayName ??
    authUser?.username ??
    "";
  const today = useMemo(() => getLocalDateISO(), []);

  const defaults = useMemo<SendNoteFormValues>(
    () => ({
      formaPago: initialData?.formaPago ?? "",
      entidad: initialData?.entidad ?? "",
      opr: initialData?.opr ?? "",
      cliente: initialData?.cliente ?? "",
      ruc: initialData?.ruc ?? "",
      dni: initialData?.dni ?? "",
      direccionFiscal: initialData?.direccionFiscal ?? "",
      direccionDespacho: initialData?.direccionDespacho ?? "",
      telefono: initialData?.telefono ?? "",
      concepto: initialData?.concepto ?? "",
      tipoDocumento: initialData?.tipoDocumento ?? "",
      buscarCodigo: initialData?.buscarCodigo ?? "",
      radioOpcion: initialData?.radioOpcion ?? "opcion1",
      items:
        initialData?.items && initialData.items.length > 0
          ? initialData.items
          : [defaultRow],
      usuarioResponsable: responsibleUser,
      atendidoPor: responsibleUser,
      fechaPago: initialData?.fechaPago?.slice?.(0, 10) ?? today,
    }),
    [initialData, responsibleUser, today]
  );

  const formMethods = useForm<SendNoteFormValues>({
    defaultValues: defaults,
  });

  const {
    reset,
    handleSubmit,
    setValue,
    getValues,
    watch,
    formState: { isSubmitting },
  } = formMethods;

  const [tableData, setTableData] = useState<SendNoteItem[]>(defaults.items);
  const [movilidad, setMovilidad] = useState<number>(0);
  const [descuentoTotal, setDescuentoTotal] = useState<number>(0);
  const [adicional, setAdicional] = useState<number>(0);
  const [efectivo, setEfectivo] = useState<number>(0);
  const [deposito, setDeposito] = useState<number>(0);

  useEffect(() => {
    if (!clients.length) {
      fetchClients();
    }
  }, [clients.length, fetchClients]);

  useEffect(() => {
    reset(defaults);
    setTableData(defaults.items as SendNoteItem[]);
    setMovilidad(0);
    setDescuentoTotal(0);
    setAdicional(0);
    setEfectivo(0);
    setDeposito(0);
  }, [defaults, reset]);

  useEffect(() => {
    focusFirstInput(containerRef.current);
  }, [mode, initialData]);

  useEffect(() => {
    if (!products.length) fetchProducts();
  }, [products.length, fetchProducts]);

  const clientOptions = useMemo(
    () =>
      clients.map((client) => ({
        value: client.nombreRazon ?? "",
        label: client.nombreRazon ?? "",
        ruc: client.ruc ?? "",
        dni: client.dni ?? "",
        direccionFiscal: client.direccionFiscal ?? "",
        direccionDespacho: client.direccionDespacho ?? "",
        telefonoMovil: client.telefonoMovil ?? "",
      })),
    [clients]
  );

  const rucOptions = useMemo(
    () =>
      clients
        .filter((client) => client.ruc?.trim())
        .map((client) => ({
          value: client.ruc,
          label: client.ruc,
          nombreRazon: client.nombreRazon ?? "",
          dni: client.dni ?? "",
          direccionFiscal: client.direccionFiscal ?? "",
          direccionDespacho: client.direccionDespacho ?? "",
          telefonoMovil: client.telefonoMovil ?? "",
        })),
    [clients]
  );

  const dniOptions = useMemo(
    () =>
      clients
        .filter((client) => client.dni?.trim())
        .map((client) => ({
          value: client.dni,
          label: client.dni,
          nombreRazon: client.nombreRazon ?? "",
          ruc: client.ruc ?? "",
          direccionFiscal: client.direccionFiscal ?? "",
          direccionDespacho: client.direccionDespacho ?? "",
          telefonoMovil: client.telefonoMovil ?? "",
        })),
    [clients]
  );

  const fillClientFields = useCallback(
    (
      client: Client,
      options?: { updateRuc?: boolean; updateDni?: boolean }
    ) => {
      const { updateRuc = false, updateDni = false } = options ?? {};
      if (client.nombreRazon) {
        setValue("cliente", client.nombreRazon, { shouldDirty: true });
      }
      if (updateRuc && client.ruc) {
        setValue("ruc", client.ruc, { shouldDirty: true });
      }
      if (updateDni && client.dni) {
        setValue("dni", client.dni, { shouldDirty: true });
      }
      if (client.direccionFiscal) {
        setValue("direccionFiscal", client.direccionFiscal, {
          shouldDirty: true,
        });
      }
      if (client.direccionDespacho) {
        setValue("direccionDespacho", client.direccionDespacho, {
          shouldDirty: true,
        });
      }
      if (client.telefonoMovil) {
        setValue("telefono", client.telefonoMovil, { shouldDirty: true });
      }
    },
    [setValue]
  );

  const rucValue = watch("ruc");
  const dniValue = watch("dni");

  useEffect(() => {
    const trimmedRuc = (rucValue ?? "").trim();
    if (!trimmedRuc) return;
    const found = clients.find(
      (client) => (client.ruc ?? "").trim() === trimmedRuc
    );
    if (found) {
      fillClientFields(found, { updateDni: true });
    }
  }, [clients, fillClientFields, rucValue]);

  useEffect(() => {
    const trimmedDni = (dniValue ?? "").trim();
    if (!trimmedDni) return;
    const found = clients.find(
      (client) => (client.dni ?? "").trim() === trimmedDni
    );
    if (found) {
      fillClientFields(found, { updateRuc: true });
    }
  }, [clients, dniValue, fillClientFields]);

  const productOptions = useMemo(
    () =>
      products.map((p: Product) => ({
        value: p.id,
        label: p.nombre,
        codigo: p.codigo,
        data: p,
      })),
    [products]
  );

  const productCodeOptions = useMemo(
    () =>
      products.map((p: Product) => ({
        value: p.codigo,
        label: p.codigo,
        productId: p.id,
      })),
    [products]
  );

  const productMap = useMemo(
    () => new Map(productOptions.map((p) => [String(p.value), p.data])),
    [productOptions]
  );

  const openClientList = useCallback(() => {
    openDialog({
      title: "Lista de clientes",
      maxWidth: "lg",
      fullWidth: true,
      content: (
        <MemoryRouter>
          <GenericList moduleKey="customers" />
        </MemoryRouter>
      ),
    });
  }, [openDialog]);

  const openCreateClient = useCallback(() => {
    openDialog({
      title: "Registrar cliente",
      maxWidth: "lg",
      fullWidth: true,
      cancelText: "Cerrar",
      content: (
        <CustomerFormBase
          mode="create"
          variant="modal"
          onSave={async (data) => {
            const result = await addClient(data);
            if (!result.ok) {
              toast.error(result.error ?? "El DNI o RUC ya existe.");
              return false;
            }
            await fetchClients();
            if (data.nombreRazon) {
              setValue("cliente", data.nombreRazon, { shouldDirty: true });
            }
            if (data.ruc) setValue("ruc", data.ruc, { shouldDirty: true });
            if (data.dni) setValue("dni", data.dni, { shouldDirty: true });
            if (data.direccionFiscal)
              setValue("direccionFiscal", data.direccionFiscal, {
                shouldDirty: true,
              });
            if (data.direccionDespacho)
              setValue("direccionDespacho", data.direccionDespacho, {
                shouldDirty: true,
              });
            if (data.telefonoMovil)
              setValue("telefono", data.telefonoMovil, { shouldDirty: true });
            closeDialog();
            return true;
          }}
          onNew={() => {}}
        />
      ),
      onConfirm: async (data) => {
        const form = await data;
        console.log("Data", form);
      },
    });
  }, [addClient, fetchClients, setValue, openDialog, closeDialog]);

  const normalizeRows = (rows: SendNoteItem[]): SendNoteItem[] =>
    rows.map((row) => {
      const prod = productMap.get(String(row.productId ?? ""));
      const qty = Number(row.cantidad ?? 0) || 0;
      const costo =
        prod && qty > 0 && row.importe
          ? Number((Number(row.importe) / qty).toFixed(2))
          : Number(row.preCosto ?? prod?.preCosto ?? 0) || 0;
      const importeCalc = Number((qty * costo).toFixed(2));
      return {
        ...row,
        productId: prod?.id ?? row.productId ?? null,
        codigo: prod?.codigo ?? row.codigo ?? "",
        nombre: prod?.nombre ?? row.nombre ?? "",
        unidadMedida: prod?.unidadMedida ?? row.unidadMedida ?? "",
        cantidad: qty,
        preCosto: costo,
        importe: row.importe ?? importeCalc,
      };
    });

  const handleTableChange = (rows: any[]) => {
    const normalized = normalizeRows(rows);
    setTableData(normalized);
    setValue("items", normalized, { shouldDirty: true });
  };

  const addProductByCode = useCallback(
    (codeParam?: string) => {
      const code = (codeParam ?? getValues("buscarCodigo") ?? "")
        .trim()
        .toLowerCase();
      if (!code) return;
      const product = products.find(
        (p) => (p.codigo ?? "").trim().toLowerCase() === code
      );
      if (!product) {
        console.warn("Producto no encontrado para el codigo ingresado");
        return;
      }

      setTableData((prev) => {
        const existingIndex = prev.findIndex(
          (row) => String(row.productId) === String(product.id)
        );
        let nextRows: SendNoteItem[];

        if (existingIndex >= 0) {
          nextRows = prev.map((row, idx) => {
            if (idx !== existingIndex) return row;
            const qty = Number(row.cantidad ?? 0) + 1;
            const costo = Number(row.preCosto ?? product.preCosto ?? 0) || 0;
            const importe = Number((qty * costo).toFixed(2));
            return { ...row, cantidad: qty, preCosto: costo, importe };
          });
        } else {
          const costo = Number(product.preCosto ?? 0) || 0;
          nextRows = [
            ...prev,
            {
              productId: product.id,
              codigo: product.codigo ?? "",
              nombre: product.nombre ?? "",
              unidadMedida: product.unidadMedida ?? "",
              cantidad: 1,
              preCosto: costo,
              descuento: 0,
              importe: Number((costo * 1).toFixed(2)),
            },
          ];
        }

        const normalized = normalizeRows(nextRows);
        setValue("items", normalized, { shouldDirty: true });
        return normalized;
      });

      setValue("buscarCodigo", "");
    },
    [getValues, products, normalizeRows, setValue]
  );

  const focusQuantityInput = useCallback((rowIndex: number) => {
    const el = document.querySelector<HTMLInputElement>(
      `[data-quantity-row="${rowIndex}"]`
    );
    el?.focus();
    el?.select?.();
  }, []);

  const QuantityCell = ({ getValue, row, table }: any) => {
    const initialValue = Number(getValue() ?? 0) || 0;
    const [value, setValue] = useState<string>(initialValue.toString());
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
      if (isFocused) return;
      setValue(initialValue.toString());
    }, [initialValue, isFocused]);

    const applyChange = useCallback(
      (nextValue: string) => {
        const qty = Number(nextValue) || 0;
        const costo = Number(row.getValue("preCosto") ?? 0) || 0;
        const importe = Number((qty * costo).toFixed(2));

        table.options.meta?.updateRow(row.index, (r: any) => ({
          ...r,
          cantidad: qty,
          importe,
        }));
      },
      [row, table]
    );

    return (
      <input
        type="number"
        value={value}
        onFocus={() => setIsFocused(true)}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          applyChange(next);
        }}
        onBlur={() => {
          setIsFocused(false);
          applyChange(value);
        }}
        data-quantity-row={row.index}
        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
      />
    );
  };

  const ImportCell = ({ getValue, row, table }: any) => {
    const initialValue = Number(getValue() ?? 0) || 0;
    const [value, setValue] = useState<string>(initialValue.toString());
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
      if (isFocused) return;
      setValue(initialValue.toString());
    }, [initialValue, isFocused]);

    const applyChange = useCallback(
      (nextValue: string) => {
        const qty = Number(row.getValue("cantidad") ?? 0) || 0;
        const importeNum = Number(nextValue) || 0;
        const costo = qty > 0 ? Number((importeNum / qty).toFixed(2)) : 0;
        table.options.meta?.updateRow(row.index, (r: any) => ({
          ...r,
          importe: importeNum,
          preCosto: costo,
        }));
      },
      [row, table]
    );

    return (
      <input
        type="number"
        value={value}
        onFocus={() => setIsFocused(true)}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          applyChange(next);
        }}
        onBlur={() => {
          setIsFocused(false);
          applyChange(value);
        }}
        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
      />
    );
  };

  const CostCell = ({ getValue, row, table }: any) => {
    const initialValue = Number(getValue() ?? 0) || 0;
    const [value, setValue] = useState<string>(initialValue.toString());
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
      if (isFocused) return;
      setValue(initialValue.toString());
    }, [initialValue, isFocused]);

    const applyChange = useCallback(
      (nextValue: string) => {
        const costo = Number(nextValue) || 0;
        const qty = Number(row.getValue("cantidad") ?? 0) || 0;
        const importe = Number((qty * costo).toFixed(2));
        table.options.meta?.updateRow(row.index, (r: any) => ({
          ...r,
          preCosto: costo,
          importe,
        }));
      },
      [row, table]
    );

    return (
      <input
        type="number"
        value={value}
        onFocus={() => setIsFocused(true)}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          applyChange(next);
        }}
        onBlur={() => {
          setIsFocused(false);
          applyChange(value);
        }}
        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
      />
    );
  };

  const columns = useMemo(
    () => [
      {
        accessorKey: "productId",
        header: "Producto",
        cell: AutocompleteTableCell,
        meta: {
          defaultValue: null,
          options: productOptions,
          width: "400px",
          onProductSelected: focusQuantityInput,
        },
      },
      {
        accessorKey: "unidadMedida",
        header: "UM",
        cell: EditableTextCell,
        meta: { defaultValue: "", disabled: true },
      },
      {
        accessorKey: "cantidad",
        header: "Cantidad",
        cell: QuantityCell,
        meta: { defaultValue: 0 },
      },
      {
        accessorKey: "preCosto",
        header: "Costo",
        cell: CostCell,
        meta: { defaultValue: 0 },
      },
      {
        accessorKey: "importe",
        header: "Importe",
        cell: ImportCell,
        meta: { defaultValue: 0 },
      },
    ],
    [productOptions, focusQuantityInput]
  );

  const onSubmit = (values: SendNoteFormValues) => {
    const detail =
      tableData?.filter(
        (i) => i.productId !== null && i.productId !== undefined
      ) ?? [];
    onSave({
      ...values,
      cliente: values.cliente?.toUpperCase() ?? "",
      direccionFiscal: values.direccionFiscal?.toUpperCase() ?? "",
      direccionDespacho: values.direccionDespacho?.toUpperCase() ?? "",
      usuarioResponsable: responsibleUser,
      atendidoPor: responsibleUser,
      items: detail,
    });
    if (mode === "create") {
      reset({
        ...defaults,
        cliente: "",
        ruc: "",
        dni: "",
        direccionFiscal: "",
        direccionDespacho: "",
        telefono: "",
        concepto: "",
        tipoDocumento: "",
        buscarCodigo: "",
        radioOpcion: "opcion1",
        items: [defaultRow],
      });
      setTableData([defaultRow]);
      onNew?.();
      focusFirstInput(containerRef.current);
    }
  };

  const estadoLabel = initialData?.estado ?? "Emitido";
  const fechaEmitidoLabel = initialData?.fechaEmitido ?? "";
  const atendidoPorLabel = responsibleUser;

  return (
    <div ref={containerRef} className=" px-3 sm:px-4 lg:px-6 w-full">
      <div className="mx-auto bg-white rounded-2xl shadow-xl overflow-visible">
        <HookForm methods={formMethods} onSubmit={handleSubmit(onSubmit)}>
          <div className="sticky top-20 sm:top-2 z-30 bg-[#B23636] text-white px-4 py-3 rounded-t-2xl flex items-center justify-between shadow-lg shadow-black/10">
            <div className="flex items-center gap-3">
              <BackArrowButton />
              <h1 className="text-base font-semibold">
                {mode === "create"
                  ? "Nueva nota de pedido"
                  : isEditable
                    ? "Editar nota de pedido"
                    : "Ver nota de pedido"}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2">
                <HookFormSelect
                  name="concepto"
                  label=""
                  options={[
                    { value: "", label: "Concepto" },
                    ...conceptoOptions,
                  ]}
                  className="min-w-[150px] px-3 py-1.5 rounded-md bg-white text-slate-800 border border-white/30 shadow-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
                <HookFormSelect
                  name="tipoDocumento"
                  label=""
                  options={[
                    { value: "", label: "T. Doc" },
                    ...tipoDocumentoOptions,
                  ]}
                  className="min-w-[140px] px-3 py-1.5 rounded-md bg-white text-slate-800 border border-white/30 shadow-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setIsEditable((prev) => !prev)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/20 transition-colors"
                  title={
                    isEditable
                      ? "Cambiar a modo lectura"
                      : "Cambiar a modo edicion"
                  }
                  aria-pressed={isEditable}
                >
                  {isEditable ? (
                    <Pencil className="w-4 h-4" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                </button>
              )}
              {mode === "edit" && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/20 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              {mode === "create" && (
                <button
                  type="button"
                  onClick={onNew}
                  disabled={!isEditable}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/20 transition-colors"
                  title="Nuevo"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={readOnly || isSubmitting || !isEditable}
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 transition-colors"
                title="Guardar"
              >
                <Save className="w-4 h-4" />
              </button>
            </div>
          </div>

          <fieldset disabled={readOnly || !isEditable}>
            <div className="p-6 sm:p-7">
              <div className="grid grid-cols-1 xl:grid-cols-6 gap-4 lg:gap-6 ">
                <div className="space-y-4 xl:col-span-2 xl:max-h-[min(72vh,720px)] xl:overflow-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <HookFormSelect
                      name="formaPago"
                      label="Forma de pago"
                      options={[
                        { value: "", label: "Seleccionar..." },
                        { value: "efectivo", label: "Efectivo" },
                        { value: "deposito", label: "Deposito" },
                        { value: "transferencia", label: "Transferencia" },
                      ]}
                      rules={{ required: "La forma de pago es obligatoria" }}
                    />
                    <HookFormAutocomplete
                      name="entidad"
                      label="Entidad"
                      options={entidadOptions}
                      placeholder="Seleccione entidad"
                    />
                    <HookFormInput name="opr" label="OPR" placeholder="OPR" />
                    <HookFormInput
                      name="fechaPago"
                      label="F-Emision"
                      type="date"
                      rules={{ required: "La fecha es obligatoria" }}
                      disabled
                    />
                    <div className=" space-y-1 col-span-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-semibold text-gray-700">
                          Cliente
                        </label>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={openClientList}
                            className="text-slate-600 text-sm font-semibold hover:underline"
                          >
                            Ver lista
                          </button>
                          <button
                            type="button"
                            onClick={openCreateClient}
                            className="text-blue-600 text-sm font-semibold hover:underline"
                          >
                            Registrar
                          </button>
                        </div>
                      </div>
                      <HookFormAutocomplete
                        name="cliente"
                        label=""
                        options={clientOptions}
                        placeholder="Seleccionar cliente"
                        onOptionSelected={(opt: any) => {
                          if (opt) {
                            fillClientFields(opt as Client, {
                              updateRuc: true,
                              updateDni: true,
                            });
                          }
                        }}
                      />
                    </div>

                    <HookFormAutocomplete
                      name="ruc"
                      label="R.U.C"
                      options={rucOptions}
                      placeholder="RUC"
                      onOptionSelected={(opt: any) => {
                        if (opt) {
                          fillClientFields(opt as Client, {
                            updateRuc: true,
                            updateDni: true,
                          });
                        }
                      }}
                    />
                    <HookFormAutocomplete
                      name="dni"
                      label="D.N.I"
                      options={dniOptions}
                      placeholder="DNI"
                      onOptionSelected={(opt: any) => {
                        if (opt) {
                          fillClientFields(opt as Client, {
                            updateRuc: true,
                            updateDni: true,
                          });
                        }
                      }}
                    />
                    {/**  <HookFormInput
                      name="telefono"
                      label="Telefono"
                      type="tel"
                      placeholder="Telefono"
                      rules={{ required: "Requerido" }}
                    /> */}
                    <div className="col-span-2">
                      {" "}
                      <HookFormInput
                        name="direccionDespacho"
                        label="Direccion"
                        placeholder="Direccion de despacho"
                      />
                    </div>
                    <div className="col-span-2">
                      {" "}
                      <SendNoteTotalsPanel
                        tableData={tableData}
                        descuento={descuentoTotal}
                        adicional={adicional}
                        efectivo={efectivo}
                        deposito={deposito}
                        onChangeMovilidad={setMovilidad}
                        onChangeDescuento={setDescuentoTotal}
                        onChangeAdicional={setAdicional}
                        onChangeEfectivo={setEfectivo}
                        onChangeDeposito={setDeposito}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 xl:col-span-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <InfoBadge label="Estado" value={estadoLabel} />
                      <InfoBadge
                        label="Atendido por"
                        value={atendidoPorLabel}
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-700">
                        Buscar codigo
                      </label>
                      <div className="flex gap-2 items-start flex-wrap md:flex-nowrap">
                        <div className="flex-1 min-w-0 md:min-w-[220px]">
                          <div className="relative">
                            <Search
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                              size={16}
                              aria-hidden="true"
                            />
                            <input
                              type="text"
                              {...formMethods.register("buscarCodigo")}
                              disabled={!isEditable}
                              placeholder="Codigo"
                              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addProductByCode();
                                }
                              }}
                              onBlur={(e) => {
                                const codeValue = e.target.value?.trim();
                                if (codeValue) addProductByCode(codeValue);
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <EditableDataTable
                    data={tableData}
                    columns={columns}
                    onDataChange={handleTableChange}
                    enablePagination={false}
                    enableFiltering={false}
                    enableSorting={false}
                  />
                </div>
              </div>
            </div>
          </fieldset>
        </HookForm>
      </div>
    </div>
  );
}

function InfoBadge({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold text-slate-800">{label}:</span>
      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
        {value || "-"}
      </span>
    </div>
  );
}

