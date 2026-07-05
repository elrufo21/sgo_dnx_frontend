import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Save, Plus, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { HookFormAutocomplete } from "@/components/forms/HookFormAutocomplete";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import ProviderForm from "@/components/maintenance/ProviderForm";
import { focusFirstInput } from "@/shared/helpers/focusFirstInput";
import {
  addDaysToLocalDateISO,
  diffDaysBetweenLocalDates,
  getLocalDateISO,
} from "@/shared/helpers/localDate";
import type { ShoppingFormData, ShoppingItem } from "@/types/shopping";
import { useProductsStore } from "@/store/products/products.store";
import type { Product } from "@/types/product";
import EditableDataTable from "@/components/forms/table/FormTable";
import AutocompleteTableCell from "@/components/forms/table/AutoCompleteTable";
import EditableTextCell from "@/components/forms/table/EditableTextCell";
import EditableNumberCell from "@/components/forms/table/EditableNumberCell";
import { useProvidersQuery } from "@/features/maintenance/providers/useProvidersQuery";
import TotalsPanel from "./shopping/TotalsPanel";
import { fetchProvidersApi } from "@/features/maintenance/providers/providers.api";
import { useMaintenanceStore } from "@/store/maintenance/maintenance.store";
import { useShoppingStore } from "@/store/shopping/shopping.store";
import { useDialogStore } from "@/store/app/dialog.store";
import type { Provider } from "@/types/maintenance";
import { GenericList } from "@/shared/listing/GenericList";
import { MemoryRouter } from "react-router";

interface ShoppingFormBaseProps {
  initialData?: Partial<ShoppingFormData>;
  mode: "create" | "edit";
  onSave: (data: ShoppingFormData) => void;
  onNew?: () => void;
  onDelete?: () => void;
}

const conceptOptions = [
  { value: "mercaderia", label: "Mercaderia" },
  { value: "servicio", label: "Servicios" },
];

const documentoOptions = [
  { value: "01", label: "Factura" },
  { value: "03", label: "Boleta" },
  { value: "00", label: "Nota de venta" },
];

const condicionOptions = [
  { value: "Contado", label: "Contado" },
  { value: "Credito", label: "Credito" },
];

const monedaOptions = [
  { value: "PEN", label: "Soles (PEN)" },
  { value: "USD", label: "Dolares (USD)" },
];

const tipoIgvOptions = [
  { value: 1, label: "Incluido" },
  { value: 2, label: "Disgregado" },
  { value: 3, label: "Sin IGV" },
];

export default function ShoppingFormBase({
  initialData,
  mode,
  onSave,
  onNew,
  onDelete,
}: ShoppingFormBaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { products, fetchProducts } = useProductsStore();
  const { data: providers = [], refetch: refetchProviders } =
    useProvidersQuery();

  const defaults = useMemo<ShoppingFormData>(
    () => ({
      providerId:
        (initialData as any)?.providerId ??
        (initialData as any)?.proveedorId ??
        null,
      concepto: initialData?.concepto ?? "",
      proveedor: initialData?.proveedor ?? "",
      descripcion: initialData?.descripcion ?? "",
      ruc: initialData?.ruc ?? "",
      fechaEmision:
        initialData?.fechaEmision ?? getLocalDateISO(),
      documento: initialData?.documento ?? "",
      serie: initialData?.serie ?? "",
      numero: initialData?.numero ?? "",
      condicion: initialData?.condicion ?? "",
      moneda: initialData?.moneda ?? "",
      diasPlazo:
        initialData?.diasPlazo === 0 || initialData?.diasPlazo === null
          ? ""
          : initialData?.diasPlazo ?? (mode === "create" ? "" : 0),
      fechaPago: initialData?.fechaPago ?? "",
      tipoIgv: initialData?.tipoIgv ?? "",
      tipoCambio: initialData?.tipoCambio ?? 0,
      items:
        initialData?.items && initialData.items.length > 0
          ? initialData.items
          : [
              {
                productId: null,
                codigo: "",
                nombre: "",
                unidadMedida: "",
                stock: 0,
                preCosto: 0,
                preVenta: 0,
                cantidad: null,
                descuento: 0,
                importe: 0,
              },
            ],
    }),
    [initialData, mode]
  );

  const formMethods = useForm<ShoppingFormData>({
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
  const setProviders = useMaintenanceStore((s) => s.setProviders);
  const addProvider = useMaintenanceStore((s) => s.addProvider);
  const draftItems = useShoppingStore((s) => s.draftItems);
  const setDraftItems = useShoppingStore((s) => s.setDraftItems);
  const clearDraftItems = useShoppingStore((s) => s.clearDraftItems);
  const [tableData, setTableData] = useState<ShoppingItem[]>(defaults.items);
  const [descuento, setDescuento] = useState<number>(0);
  const [percepcion, setPercepcion] = useState<number>(0);
  const quantityInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const openDialog = useDialogStore((s) => s.openDialog);

  const focusQuantityInput = useCallback((rowIndex: number) => {
    const attemptFocus = () => {
      const el = quantityInputRefs.current[rowIndex];
      if (el) {
        el.focus();
        if (typeof el.select === "function") el.select();
      }
    };
    attemptFocus();
    setTimeout(attemptFocus, 0);
  }, []);

  const openProviderList = useCallback(() => {
    openDialog({
      title: "Lista de proveedores",
      maxWidth: "md",
      fullWidth: true,
      content: (
        <MemoryRouter>
          <GenericList moduleKey="providers" />
        </MemoryRouter>
      ),
    });
  }, [openDialog]);

  const productOptions = useMemo(
    () =>
      products.map((p: Product) => ({
        value: p.id,
        label: p.nombre,
        codigo: p.codigo,
        search: `${p.nombre ?? ""} ${p.codigo ?? ""}`.toLowerCase(),
        data: p,
      })),
    [products]
  );

  const providerOptions = useMemo(
    () =>
      providers.map((prov) => ({
        value: prov.razon ?? "",
        label: prov.razon ?? "",
        ruc: prov.ruc ?? "",
        id: prov.id,
      })),
    [providers]
  );

  const rucOptions = useMemo(
    () =>
      providers
        .filter((prov) => prov.ruc)
        .map((prov) => ({
          value: prov.ruc ?? "",
          label: prov.ruc ?? "",
          razon: prov.razon ?? "",
          id: prov.id,
        })),
    [providers]
  );

  useEffect(() => {
    reset(defaults);
    const normalized = normalizeRows(defaults.items);
    setTableData(normalized);
    setValue("items", normalized);

    if (
      mode === "create" &&
      (!initialData?.items || initialData.items.length === 0) &&
      draftItems.length > 0
    ) {
      const hydrated = normalizeRows(draftItems);
      setTableData(hydrated);
      setValue("items", hydrated);
    }
  }, [defaults, reset]);

  useEffect(() => {
    focusFirstInput(containerRef.current);
  }, [mode, initialData]);

  useEffect(() => {
    if (!products.length) {
      fetchProducts();
    }
  }, [products.length, fetchProducts]);

  const condicion = watch("condicion");
  const diasPlazo = watch("diasPlazo");
  const fechaEmision = watch("fechaEmision");
  const fechaPago = watch("fechaPago");
  const numeroSerie = watch("numero");
  const rucValue = watch("ruc");
  const documento = watch("documento");
  const isBoleta = (documento ?? "").trim() === "03";
  const isFactura = (documento ?? "").trim() === "01";
  const requireNumeroSerie = isBoleta || isFactura;
  const isCredito = (condicion ?? "").toLowerCase() === "credito";
  const lastChangedRef = useRef<
    "diasPlazo" | "fechaPago" | "fechaEmision" | null
  >(null);
  const prevValuesRef = useRef({
    diasPlazo,
    fechaPago,
    fechaEmision,
  });

  useEffect(() => {
    if (!isCredito) {
      const today = getLocalDateISO();
      setValue("diasPlazo", "", { shouldDirty: true });
      setValue("fechaPago", today, { shouldDirty: true });
    }
  }, [isCredito, setValue]);

  useEffect(() => {
    const prev = prevValuesRef.current;
    if (diasPlazo !== prev.diasPlazo) {
      lastChangedRef.current = "diasPlazo";
    } else if (fechaPago !== prev.fechaPago) {
      lastChangedRef.current = "fechaPago";
    } else if (fechaEmision !== prev.fechaEmision) {
      lastChangedRef.current = "fechaEmision";
    }
    prevValuesRef.current = { diasPlazo, fechaPago, fechaEmision };
  }, [diasPlazo, fechaPago, fechaEmision]);

  const isSyncingRef = useRef(false);
  const lastRucLookupRef = useRef<string>("");

  const lookupProviderByRuc = useCallback(
    async (ruc: string) => {
      const trimmed = ruc.trim();
      if (!trimmed) return;
      try {
        const providersList = await fetchProvidersApi();
        setProviders(providersList ?? []);
        const found = providersList?.find(
          (p) => (p.ruc ?? "").trim() === trimmed
        );
        if (found) {
          setValue("proveedor", found.razon ?? "", { shouldDirty: true });
          setValue("ruc", found.ruc ?? trimmed, { shouldDirty: true });
        }
      } catch (error) {
        console.error("No se pudo consultar proveedor por RUC", error);
      }
    },
    [setProviders, setValue]
  );

  useEffect(() => {
    if (!isCredito) return;
    if (!fechaEmision) return;
    if (isSyncingRef.current) {
      isSyncingRef.current = false;
      return;
    }
    const days = Number(diasPlazo ?? 0);
    const formatted =
      addDaysToLocalDateISO(fechaEmision, Number.isFinite(days) ? days : 0) ??
      "";
    if (!formatted) return;
    const lastChanged = lastChangedRef.current;
    const shouldSync =
      lastChanged === "diasPlazo" ||
      (lastChanged === "fechaEmision" && !fechaPago);
    if (shouldSync && formatted !== fechaPago) {
      isSyncingRef.current = true;
      setValue("fechaPago", formatted, { shouldDirty: true });
    }
  }, [diasPlazo, fechaEmision, isCredito, fechaPago, setValue]);

  useEffect(() => {
    if (!isCredito) return;
    if (!fechaEmision || !fechaPago) return;
    if (isSyncingRef.current) {
      isSyncingRef.current = false;
      return;
    }
    const days = diffDaysBetweenLocalDates(fechaEmision, fechaPago);
    if (days === null || days < 0) return;
    const lastChanged = lastChangedRef.current;
    if (
      lastChanged === "fechaPago" &&
      Number.isFinite(days) &&
      days !== (Number(diasPlazo) || 0)
    ) {
      isSyncingRef.current = true;
      setValue("diasPlazo", days, { shouldDirty: true });
    }
  }, [fechaPago, fechaEmision, isCredito, diasPlazo, setValue]);

  useEffect(() => {
    const trimmed = (rucValue ?? "").trim();
    if (!trimmed || trimmed.length < 8) return;
    if (lastRucLookupRef.current === trimmed) return;
    lastRucLookupRef.current = trimmed;
    lookupProviderByRuc(trimmed);
  }, [lookupProviderByRuc, rucValue]);

  useEffect(() => {
    const raw = numeroSerie ?? "";
    if (!raw) return;

    const cleaned = raw.replace(/[^a-zA-Z0-9-]/g, "");
    const [serieRaw = "", correlativoRaw = ""] = cleaned.split("-", 2);

    const serie = serieRaw
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 4)
      .toUpperCase();

    const overflow =
      !cleaned.includes("-") && serieRaw.length > 4
        ? serieRaw.slice(4).replace(/\D/g, "")
        : "";

    const correlativo = (overflow + correlativoRaw.replace(/\D/g, "")).slice(
      0,
      8
    );

    let formatted = serie;
    if (correlativo) {
      formatted = `${serie}-${correlativo}`;
    } else if (cleaned.includes("-") && serie) {
      formatted = `${serie}-`;
    }

    if (formatted !== raw) setValue("numero", formatted, { shouldDirty: true });
  }, [numeroSerie, setValue]);

  const normalizeRows = (rows: ShoppingItem[]): ShoppingItem[] =>
    rows.map((row) => {
      const prod = productMap.get(
        String(row.productId ?? row["productId"] ?? "")
      );
      const rawQty = (row as any).cantidad;
      const cantidadNum =
        rawQty === null || rawQty === undefined || rawQty === ""
          ? 0
          : Number(rawQty) || 0;
      const importeInput = Number(row.importe ?? (row as any)["importe"]);
      const hasImporte = Number.isFinite(importeInput);
      const costoFromProd = prod ? Number(prod.preCosto ?? 0) : null;
      const costoBase = Number(row.preCosto ?? 0) || 0;
      const costoNum =
        hasImporte && cantidadNum > 0
          ? Number((importeInput / cantidadNum).toFixed(2))
          : Number.isFinite(costoFromProd ?? NaN)
          ? (costoFromProd as number)
          : costoBase;
      const descuentoNum = Number(row.descuento ?? 0) || 0;
      const importeNum = hasImporte
        ? Number(importeInput.toFixed(2))
        : Number((costoNum * cantidadNum).toFixed(2));
      return {
        ...row,
        productId: prod?.id ?? row.productId ?? null,
        codigo: prod?.codigo ?? row.codigo ?? "",
        nombre: prod?.nombre ?? row.nombre ?? "",
        unidadMedida: prod?.unidadMedida ?? row.unidadMedida ?? "",
        stock: prod ? Number(prod.cantidad ?? 0) : Number(row.stock ?? 0) || 0,
        preCosto: costoNum,
        preVenta: prod
          ? Number(prod.preVenta ?? 0)
          : Number(row.preVenta ?? 0) || 0,
        cantidad: cantidadNum,
        descuento: descuentoNum,
        importe: importeNum,
      };
    });

  const handleTableChange = (rows: any[]) => {
    const normalized = normalizeRows(rows);
    setTableData(normalized);
    setValue("items", normalized, { shouldDirty: true });
    if (mode === "create") {
      setDraftItems(normalized);
    }
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
        const cantidad = Number(row.getValue("cantidad") ?? 1) || 1;
        const importeNum = Number(nextValue) || 0;
        const newCosto =
          cantidad > 0 ? Number((importeNum / cantidad).toFixed(2)) : 0;

        table.options.meta?.updateRow(row.index, (r: any) => ({
          ...r,
          importe: importeNum,
          preCosto: newCosto,
        }));
      },
      [row, table]
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setValue(next);
      applyChange(next);
    };

    const handleBlur = () => {
      setIsFocused(false);
      applyChange(value);
    };

    return (
      <input
        type="number"
        value={value}
        onFocus={() => setIsFocused(true)}
        onChange={handleChange}
        onBlur={handleBlur}
        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
      />
    );
  };

  const productMap = useMemo(
    () => new Map(productOptions.map((p) => [String(p.value), p.data])),
    [productOptions]
  );

  const QuantityCell = ({ getValue, row, table }: any) => {
    const raw = getValue();
    const initialValue = Number(raw ?? 0) || 0;
    const [value, setValue] = useState<string>(
      initialValue ? initialValue.toString() : ""
    );
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
      if (isFocused) return;
      setValue(initialValue ? initialValue.toString() : "");
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setValue(next);
      applyChange(next);
    };

    const handleBlur = () => {
      setIsFocused(false);
      applyChange(value);
    };

    return (
      <input
        type="number"
        value={value}
        onFocus={() => setIsFocused(true)}
        onChange={handleChange}
        onBlur={handleBlur}
        ref={(node) => {
          quantityInputRefs.current[row.index] = node;
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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setValue(next);
      applyChange(next);
    };

    const handleBlur = () => {
      setIsFocused(false);
      applyChange(value);
    };

    return (
      <input
        type="number"
        value={value}
        onFocus={() => setIsFocused(true)}
        onChange={handleChange}
        onBlur={handleBlur}
        className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-right"
      />
    );
  };

  const columns = useMemo(() => {
    return [
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
        accessorKey: "descuento",
        header: "Descuento",
        cell: EditableNumberCell,
        meta: { defaultValue: 0 },
      },
      {
        accessorKey: "importe",
        header: "Importe",
        cell: ImportCell,
        meta: { defaultValue: 0 },
      },
    ];
  }, [productOptions, focusQuantityInput]);

  const onSubmit = (values: ShoppingFormData) => {
    const detail =
      tableData?.filter(
        (i) => i.productId !== null && i.productId !== undefined
      ) ?? [];
    onSave({
      ...values,
      providerId:
        values.providerId ??
        (values as any).proveedorId ??
        (Number((values as any).ruc ?? 0) || null),
      proveedor: values.proveedor?.toUpperCase() ?? "",
      descripcion: values.descripcion?.toUpperCase() ?? "",
      concepto: values.concepto ?? "",
      items: detail,
    });
    if (mode === "create") {
      clearDraftItems();
      const emptyRow = {
        productId: null,
        codigo: "",
        nombre: "",
        unidadMedida: "",
        stock: 0,
        preCosto: 0,
        preVenta: 0,
        cantidad: null,
        descuento: 0,
        importe: 0,
      };
      reset({
        providerId: null,
        concepto: "",
        proveedor: "",
        descripcion: "",
        ruc: "",
        fechaEmision: getLocalDateISO(),
        documento: "",
        serie: "",
        numero: "",
        condicion: "",
        moneda: "",
        diasPlazo: 0,
        fechaPago: "",
        tipoIgv: "",
        tipoCambio: 0,
        items: [emptyRow],
      });
      setTableData([emptyRow]);
      setValue("items", [emptyRow]);
      onNew?.();
    }
  };

  const handleNew = () => {
    clearDraftItems();
    const emptyRow = {
      productId: null,
      codigo: "",
      nombre: "",
      unidadMedida: "",
      stock: 0,
      preCosto: 0,
      preVenta: 0,
      cantidad: null,
      descuento: 0,
      importe: 0,
    };
    reset({
      providerId: null,
      concepto: "",
      proveedor: "",
      descripcion: "",
      ruc: "",
      fechaEmision: getLocalDateISO(),
      documento: "",
      serie: "",
      numero: "",
      condicion: "",
      moneda: "",
      diasPlazo: 0,
      fechaPago: "",
      tipoIgv: "",
      tipoCambio: 0,
      items: [emptyRow],
    });
    setTableData([emptyRow]);
    setValue("items", [emptyRow]);
    onNew?.();
    focusFirstInput(containerRef.current);
  };

  return (
    <div ref={containerRef} className="py-6 px-3 sm:px-4 lg:px-6 w-full">
      <div className="mx-auto bg-white rounded-2xl shadow-xl overflow-visible">
        <HookForm methods={formMethods} onSubmit={handleSubmit(onSubmit)}>
          <div className="sticky top-20 sm:top-2 z-30 bg-[#B23636] text-white px-4 py-3 rounded-t-2xl flex items-center justify-between shadow-lg shadow-black/10">
            <div className="flex items-center gap-3">
              <BackArrowButton />
              <h1 className="text-base font-semibold">
                {mode === "create" ? "Nueva Compra" : "Editar Compra"}
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
                </button>
              )}
              {mode === "create" && (
                <button
                  type="button"
                  onClick={handleNew}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/20 transition-colors"
                  title="Nuevo"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 disabled:opacity-70 transition-colors"
                title="Guardar"
              >
                <Save className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-6 sm:p-7">
            <div className="grid grid-cols-1 xl:grid-cols-6 gap-4 lg:gap-6 ">
              <div className="space-y-4 col-span-2  overflow-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="col-span-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-semibold text-gray-700">
                        Proveedor
                      </label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={openProviderList}
                          className="text-slate-600 text-sm font-semibold hover:underline"
                        >
                          Ver lista
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            openDialog({
                              title: "Registrar proveedor",
                              content: (
                                <ProviderForm
                                  variant="modal"
                                  mode="create"
                                  onSave={() => {}}
                                />
                              ),
                              onConfirm: async (data) => {
                                if (!data || typeof data !== "object") return;
                                await addProvider(data as Provider);
                                await refetchProviders();
                                const prov = data as Provider;
                                if (prov.razon) {
                                  setValue("proveedor", prov.razon, {
                                    shouldDirty: true,
                                  });
                                }
                                if (prov.ruc) {
                                  setValue("ruc", prov.ruc, {
                                    shouldDirty: true,
                                  });
                                }
                                if (prov.id) {
                                  setValue("providerId", prov.id, {
                                    shouldDirty: true,
                                  });
                                }
                              },
                              maxWidth: "md",
                              fullWidth: true,
                            })
                          }
                          className="text-blue-600 text-sm font-semibold hover:underline"
                        >
                          Registrar
                        </button>
                      </div>
                    </div>
                    <HookFormAutocomplete<ShoppingFormData>
                      name="proveedor"
                      label=""
                      options={providerOptions}
                      placeholder="Seleccionar proveedor"
                      rules={{
                        validate: (value) =>
                          isBoleta ||
                          (value?.trim()
                            ? true
                            : "El proveedor es obligatorio"),
                      }}
                      onOptionSelected={(option) => {
                        if (option?.id) {
                          setValue("providerId", option.id, {
                            shouldDirty: true,
                          });
                        }
                        if (option?.ruc) {
                          setValue("ruc", option.ruc, { shouldDirty: true });
                        }
                      }}
                    />
                  </div>
                  <HookFormAutocomplete<ShoppingFormData>
                    name="ruc"
                    label="RUC"
                    options={rucOptions}
                    placeholder="RUC"
                    rules={{
                      validate: (value) => {
                        if (isBoleta) return true;
                        if (!value?.trim()) return "El RUC es obligatorio";
                        return (
                          /^\d{8,11}$/.test(value.trim()) ||
                          "Ingrese un RUC valido"
                        );
                      },
                    }}
                    onOptionSelected={(option) => {
                      if (option?.razon) {
                        setValue("proveedor", option.razon, {
                          shouldDirty: true,
                        });
                      }
                      if (option?.id) {
                        setValue("providerId", option.id, {
                          shouldDirty: true,
                        });
                      }
                    }}
                  />

                  <HookFormInput<ShoppingFormData>
                    name="fechaEmision"
                    label="Fecha de emision"
                    type="date"
                    rules={{ required: "La fecha de emision es obligatoria" }}
                  />
                  <HookFormSelect<ShoppingFormData>
                    name="documento"
                    label="Documento"
                    options={[
                      { value: "", label: "Seleccionar..." },
                      ...documentoOptions,
                    ]}
                    rules={{ required: "El documento es obligatorio" }}
                  />

                  <HookFormInput<ShoppingFormData>
                    name="numero"
                    label="Numero de serie"
                    placeholder="Numero"
                    rules={{
                      required: requireNumeroSerie
                        ? "El numero es obligatorio"
                        : false,
                      validate: (value) => {
                        if (!requireNumeroSerie && !value?.trim()) return true;
                        return (
                          /^[A-Za-z0-9]{4}-\d{1,8}$/.test(value ?? "") ||
                          "Formato invalido. Use 4 caracteres y hasta 8 digitos despues del guion"
                        );
                      },
                    }}
                  />

                  <HookFormSelect<ShoppingFormData>
                    name="condicion"
                    label="Condicion"
                    options={[
                      { value: "", label: "Seleccionar..." },
                      ...condicionOptions,
                    ]}
                    rules={{ required: "La condicion es obligatoria" }}
                  />
                  <HookFormSelect<ShoppingFormData>
                    name="tipoIgv"
                    label="Tipo IGV"
                    options={[
                      { value: "", label: "Seleccionar..." },
                      ...tipoIgvOptions,
                    ]}
                    rules={{ required: "El tipo de IGV es obligatorio" }}
                  />
                  <HookFormInput<ShoppingFormData>
                    name="diasPlazo"
                    label="Dias de plazo"
                    type="number"
                    disabled={!isCredito}
                    rules={{
                      valueAsNumber: true,
                      min: { value: 0, message: "Debe ser 0 o mayor" },
                    }}
                  />

                  <HookFormInput<ShoppingFormData>
                    name="fechaPago"
                    label="Fecha de pago"
                    type="date"
                    disabled={!isCredito}
                    rules={{
                      validate: (value) =>
                        !isCredito ||
                        !!value ||
                        "La fecha de pago es obligatoria",
                    }}
                  />
                </div>
                <TotalsPanel
                  tableData={tableData}
                  descuento={descuento}
                  percepcion={percepcion}
                  onChangeDescuento={setDescuento}
                  onChangePercepcion={setPercepcion}
                />
              </div>

              <div className="space-y-3 col-span-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <HookFormAutocomplete<ShoppingFormData>
                    name="concepto"
                    label="Concepto"
                    options={conceptOptions}
                    placeholder="Seleccionar concepto"
                    rules={{ required: "El concepto es obligatorio" }}
                  />
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
        </HookForm>
      </div>
    </div>
  );
}

