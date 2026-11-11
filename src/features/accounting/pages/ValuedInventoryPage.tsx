import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import type { ColumnDef } from "@tanstack/react-table";
import Checkbox from "@mui/material/Checkbox";
import DataTable from "@/components/DataTable";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { HookFormInput } from "@/components/forms/HookFormInput";
import NavigableNumberInput from "@/components/inputs/NavigableNumberInput";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { downloadBrowserFile } from "@/shared/helpers/downloadBrowserFile";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import { toast } from "@/shared/ui/toast";
import type { PreviewProduct } from "./inventoryPreviewExport";
import { createKardexZip } from "./inventoryKardexExport";
import { fetchInitialStocks, saveInitialStock as persistInitialStock } from "./inventoryInitialStock";
import { groupInventoryRows, mergeInventoryProducts, readInventoryProducts, type InventoryProduct, type InventoryProductGroup } from "./inventoryProductMapping";

type Filters = { fechaInicio: string; fechaFin: string };

function InitialStockCell({ codigo, initial, disabled, onSave }: { codigo: string; initial?: number; disabled: boolean; onSave: (codigo: string, value: number) => Promise<boolean> }) {
  const [value, setValue] = useState(initial == null ? "" : String(initial));
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (value.trim() === "" && initial == null) return;
    const number = value.trim() === "" ? 0 : Number(value);
    if (!Number.isFinite(number) || !Number.isSafeInteger(Math.round(number * 100)) || Math.abs(number * 100 - Math.round(number * 100)) > 0.000001) {
      toast.error("Ingrese una cantidad válida con hasta dos decimales.");
      setValue(initial == null ? "" : String(initial));
      return;
    }
    if (number === initial) return;
    setSaving(true);
    const saved = await onSave(codigo, number);
    if (!saved) setValue(initial == null ? "" : String(initial));
    setSaving(false);
  };
  return <NavigableNumberInput value={value} onChange={setValue} onBlur={(event) => {
    if (event.currentTarget.validity.badInput) {
      toast.error("Ingrese una cantidad válida con hasta dos decimales.");
      setValue(initial == null ? "" : String(initial));
      return;
    }
    void save();
  }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} disabled={disabled || saving} navGroup="inventario-ultimo-inv" step="0.01" placeholder="Ingresar" title="Se guarda al salir del campo o presionar Enter" aria-label={`Último INV de ${codigo}`} className="w-28 rounded border border-slate-300 bg-white px-2 py-1 text-right text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100" />;
}

export default function ValuedInventoryPage() {
  const today = getLocalDateISO();
  const form = useForm<Filters>({ defaultValues: { fechaInicio: `${today.slice(0, 7)}-01`, fechaFin: today } });
  const fechaInicio = useWatch({ control: form.control, name: "fechaInicio" });
  const periodKey = fechaInicio || "";
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [previewProducts, setPreviewProducts] = useState<PreviewProduct[]>([]);
  const [previewAvailable, setPreviewAvailable] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsAvailable, setProductsAvailable] = useState(false);
  const [balances, setBalances] = useState<{ key: string; values: Record<string, number>; error: string }>({ key: "", values: {}, error: "" });
  const [productLoadError, setProductLoadError] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<string[]>([]);
  const [productFilter, setProductFilter] = useState("");
  const [progress, setProgress] = useState("");
  const [exportNotice, setExportNotice] = useState("");
  const pendingSaves = useRef(0);
  const saveInitialStock = useCallback(async (codigo: string, value: number) => {
    pendingSaves.current++;
    try {
      const result = await persistInitialStock(codigo, fechaInicio, value);
      if (result?.codigo !== codigo.toUpperCase() || result.cantidad !== value) { toast.error("No se guardó la cantidad inicial. Verifique sus permisos y la conexión."); return false; }
      setBalances((current) => current.key === periodKey ? { ...current, values: { ...current.values, [codigo.toUpperCase()]: value } } : current);
      return true;
    } finally { pendingSaves.current--; }
  }, [fechaInicio, periodKey]);

  useEffect(() => {
    let active = true;
    void apiRequest<unknown>({ url: buildApiUrl("/InventarioValorizado/productos") }).then((result) => {
      if (!active) return;
      const response = readInventoryProducts(result);
      if (response) {
        setProducts(response.products);
        setProductsAvailable(true);
      } else setProductLoadError("No se pudo cargar el stock de la base principal. Verifique la API y la conexión.");
      setLoadingProducts(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!fechaInicio) return;
    void fetchInitialStocks(fechaInicio).then((result) => {
      if (!active) return;
      if (!Array.isArray(result) || !result.every((row) => typeof row?.codigo === "string" && typeof row?.cantidad === "number" && Number.isFinite(row.cantidad))) {
        setBalances({ key: periodKey, values: {}, error: "No se pudieron cargar los saldos iniciales del período. Verifique la API y la tabla de saldos." });
        return;
      }
      setBalances({ key: periodKey, values: Object.fromEntries(result.map((row) => [row.codigo.toUpperCase(), row.cantidad])), error: "" });
    });
    return () => { active = false; };
  }, [fechaInicio, periodKey]);

  useEffect(() => {
    let active = true;
    void apiRequest<unknown>({ url: buildApiUrl("/InventarioVistaPrevia/productos") }).then((result) => {
      if (!active) return;
      if (Array.isArray(result)) {
        setPreviewProducts(result as PreviewProduct[]);
        setPreviewAvailable(true);
      } else toast.error("No se pudieron consultar los productos de ICA y COMAS.");
      setLoadingPreview(false);
    });
    return () => { active = false; };
  }, []);

  const productRows = useMemo(() => mergeInventoryProducts(products, previewProducts), [products, previewProducts]);
  const displayRows = useMemo(() => groupInventoryRows(productRows), [productRows]);
  const selectedCodes = useMemo(() => new Set(selection), [selection]);
  const selectableCodes = useMemo(() => [...new Set(displayRows.flatMap((row) => row.preview ? [row.preview.codigo] : []))], [displayRows]);
  const selectedCount = selectableCodes.filter((code) => selectedCodes.has(code)).length;

  const productColumns = useMemo<ColumnDef<InventoryProductGroup, unknown>[]>(() => [
    { accessorKey: "codigo", header: "Código" },
    { accessorKey: "descripcion", header: "Descripción" },
    { accessorKey: "stockActual", header: "Stock vigente", cell: ({ row }) => row.original.stockActual == null ? "-" : Number(row.original.stockActual).toLocaleString("es-PE", { maximumFractionDigits: 4 }), meta: { align: "right" } },
    { id: "ultimoInv", header: "Último INV", cell: ({ row }) => {
      if (!row.original.preview) return "-";
      const codigo = row.original.preview.codigo;
      const key = codigo.toUpperCase();
      const initial = balances.key === periodKey && Object.prototype.hasOwnProperty.call(balances.values, key) ? balances.values[key] : undefined;
      return <InitialStockCell key={`${periodKey}:${codigo}:${initial ?? ""}`} codigo={codigo} initial={initial} disabled={loading || !productsAvailable || !periodKey || balances.key !== periodKey || !!balances.error} onSave={saveInitialStock} />;
    }, meta: { align: "right" } },
    {
      id: "exportar", header: () => <Checkbox size="small" checked={selectableCodes.length > 0 && selectedCount === selectableCodes.length} indeterminate={selectedCount > 0 && selectedCount < selectableCodes.length} disabled={loading || selectableCodes.length === 0} onChange={(_, checked) => setSelection(checked ? selectableCodes : [])} inputProps={{ "aria-label": "Seleccionar todos los productos para exportar" }} sx={{ color: "#B23636", "&.Mui-checked, &.MuiCheckbox-indeterminate": { color: "#B23636" } }} />, meta: { align: "center" },
      cell: ({ row }) => <span title={row.original.preview ? `Códigos agrupados: ${row.original.preview.codigos.join(", ")}` : "Código vacío o con correspondencia ambigua"}><Checkbox size="small" checked={!!row.original.preview && selectedCodes.has(row.original.preview.codigo)} disabled={loading || !row.original.preview} onChange={(_, checked) => {
        const code = row.original.preview?.codigo;
        if (code) setSelection((current) => checked ? [...new Set([...current, code])] : current.filter((item) => item !== code));
      }} inputProps={{ "aria-label": `Seleccionar ${row.original.codigo} para exportar` }} sx={{ color: "#B23636", "&.Mui-checked": { color: "#B23636" } }} /></span>,
    },
  ], [loading, productsAvailable, selectedCodes, selectableCodes, selectedCount, balances, periodKey, saveInitialStock]);

  const exportBatch = async () => {
    if (pendingSaves.current) { toast.error("Espere a que se guarde la cantidad inicial antes de exportar."); return; }
    const { fechaInicio, fechaFin } = form.getValues();
    if (!fechaInicio || !fechaFin || fechaInicio > fechaFin || !selection.length) {
      toast.error("Seleccione productos y un rango válido."); return;
    }
    const selected = [...new Map(productRows.flatMap((row) => row.preview && selectedCodes.has(row.preview.codigo) ? [[row.preview.codigo, row.preview] as const] : [])).values()];
    if (selected.length !== selectedCodes.size) {
      toast.error("No se pudieron identificar todos los productos seleccionados."); return;
    }
    if (balances.key !== periodKey || balances.error) { toast.error("Espere a que se carguen los saldos del período."); return; }
    setLoading(true);
    setExportNotice("");
    try {
      const initialStocks = Object.fromEntries(selected.map((product) => {
        const key = product.codigo.toUpperCase();
        return [product.codigo, Object.prototype.hasOwnProperty.call(balances.values, key) ? balances.values[key] : 0];
      }));
      const { zip, notice } = await createKardexZip(selected, fechaInicio, fechaFin, setProgress, initialStocks);
      await downloadBrowserFile(zip, `kardex_${fechaInicio}_${fechaFin}.zip`);
      setExportNotice(notice);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se completó el lote; revise la conexión de ambas sedes.");
    } finally {
      setProgress("");
      setLoading(false);
    }
  };

  return <div className="space-y-4 p-3 sm:p-4">
    <FormProvider {...form}>
      {progress && <p role="status" className="pb-3 text-sm text-slate-600">{progress}</p>}
      {exportNotice && <p role="status" className="pb-3 text-sm text-amber-800">{exportNotice}</p>}
      {productLoadError && <p role="alert" className="pb-3 text-sm text-red-700">{productLoadError}</p>}
      {balances.key === periodKey && balances.error && <p role="alert" className="pb-3 text-sm text-red-700">{balances.error}</p>}
      <DataTable data={displayRows} columns={productColumns} isLoading={loadingProducts || loadingPreview || loading} searchPlaceholder="Buscar por código o descripción..." filterKeys={["codigo", "descripcion", "codigosBusqueda"]} globalFilterValue={productFilter} onGlobalFilterValueChange={setProductFilter} isolatedSearch emptyMessage="No se encontraron productos." initialPageSize={50} tableMaxHeight="65vh"
        toolbarLayout="filters-inline"
        toolbarLeading={<BackArrowButton fallbackTo="/accounting" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-black hover:bg-slate-100" />}
        toolbarAction={<button type="button" onClick={() => void exportBatch()} disabled={loading || !productsAvailable || !previewAvailable || !periodKey || balances.key !== periodKey || !!balances.error || !selection.length} className="h-10 whitespace-nowrap rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:opacity-60">Exportar seleccionados</button>}
        renderFilters={<div className="flex items-center gap-2"><HookFormInput<Filters> name="fechaInicio" label="F. inicio" type="date" disabled={loading} /><HookFormInput<Filters> name="fechaFin" label="F. fin" type="date" disabled={loading} /></div>}
        footerContent={<span>Seleccionados: <b>{selection.length}</b>{previewAvailable && productRows.some((product) => !product.preview) && " · Algunos productos tienen código vacío o correspondencia ambigua."}</span>} />
    </FormProvider>
  </div>;
}
