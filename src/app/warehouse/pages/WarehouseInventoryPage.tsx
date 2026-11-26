import { createContext, useContext, useDeferredValue, useEffect, useMemo, useState } from "react";
import type { CellContext, ColumnDef } from "@tanstack/react-table";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import DataTable from "@/components/DataTable";
import NavigableNumberInput from "@/components/inputs/NavigableNumberInput";
import { indexProductCatalog, searchProductCatalog } from "@/app/sales/helpers/productCatalogSearch";
import { calculateWarehouseCount, type WarehouseCount } from "@/app/warehouse/helpers/warehouseCount";
import { buildApiUrl } from "@/shared/config/api";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { useProductsStore } from "@/app/products/store/products.store";
import { useDialogStore } from "@/app/store/dialog.store";
import { toast } from "@/shared/ui/toast";
import type { Product } from "@/app/products/types/product";

type CountField = keyof WarehouseCount;
type BoxRow = { productId: number; unitsPerBox: number | null };
type Opening = { id: number; fecha: string | null; usuario: string };
type CountContextValue = { counts: Record<number, WarehouseCount>; boxes: Map<number, number | null>; setCount: (id: number, field: CountField, value: string) => void };
const CountContext = createContext<CountContextValue | null>(null);
const emptyCount: WarehouseCount = { wholesale: "", dispatch: "", display: "" };
const formatCount = (value: number) => value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function CountInput({ row, field, label }: CellContext<Product, unknown> & { field: CountField; label: string }) {
  const context = useContext(CountContext)!;
  const product = row.original;
  const boxSize = context.boxes.get(product.id);
  return <NavigableNumberInput
    aria-label={`${label} de ${product.codigo} (${product.id})`}
    navGroup={`warehouse-${field}`}
    min={0}
    step="any"
    value={context.counts[product.id]?.[field] ?? ""}
    disabled={field === "wholesale" && !(boxSize != null && boxSize > 0)}
    onChange={(value) => { if (value === "" || (/^\d+(?:\.\d*)?$/.test(value) && Number.isFinite(Number(value)))) context.setCount(product.id, field, value); }}
    className={`ml-auto h-8 w-24 rounded-md border border-slate-300 px-2 text-right text-sm text-slate-800 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100 disabled:bg-slate-100 ${field === "display" ? "bg-yellow-100" : "bg-white"}`}
  />;
}
function UnitsCell({ row }: CellContext<Product, unknown>) {
  const units = useContext(CountContext)!.boxes.get(row.original.id);
  return units != null && units > 0 ? formatCount(units) : "—";
}
function TotalCell({ row, wholesaleOnly }: CellContext<Product, unknown> & { wholesaleOnly?: boolean }) {
  const context = useContext(CountContext)!;
  const count = context.counts[row.original.id] ?? emptyCount;
  const totals = calculateWarehouseCount(count, context.boxes.get(row.original.id) ?? null);
  if (wholesaleOnly ? count.wholesale === "" : !totals.hasValues) return "—";
  return formatCount(wholesaleOnly ? totals.wholesaleTotal : totals.total);
}

const columns: ColumnDef<Product, unknown>[] = [
  { accessorKey: "codigo", header: "Código" },
  { accessorKey: "nombre", header: "Descripción", meta: { tdClassName: "min-w-48 whitespace-normal" } },
  { id: "wholesale", header: "xMayor", cell: (props) => <CountInput {...props} field="wholesale" label="Por mayor" />, meta: { align: "right" } },
  { id: "box", header: "UNIxCaja", cell: UnitsCell, meta: { align: "right" } },
  { id: "wholesaleTotal", header: "Total x Mayor", cell: (props) => <TotalCell {...props} wholesaleOnly />, meta: { align: "right" } },
  { accessorKey: "unidadMedida", header: "UM" },
  { id: "dispatch", header: "Despacho", cell: (props) => <CountInput {...props} field="dispatch" label="Despacho" />, meta: { align: "right" } },
  { id: "display", header: "Vitrina", cell: (props) => <CountInput {...props} field="display" label="Vitrina" />, meta: { align: "right" } },
  { id: "total", header: "Almacén total", cell: TotalCell, meta: { align: "right", tdClassName: "bg-cyan-50 font-semibold" } },
  { id: "validation", header: "Validación", cell: () => "" },
];

export default function WarehouseInventoryPage() {
  const products = useProductsStore((state) => state.products);
  const loading = useProductsStore((state) => state.loading);
  const fetchProducts = useProductsStore((state) => state.fetchProducts);
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Record<number, WarehouseCount>>({});
  const [boxRows, setBoxRows] = useState<BoxRow[]>([]);
  const [boxError, setBoxError] = useState(false);
  const [opening, setOpening] = useState<Opening | null>(null);
  const [openingReady, setOpeningReady] = useState(false);
  const openDialog = useDialogStore((state) => state.openDialog);
  const deferredSearch = useDeferredValue(search);
  const index = useMemo(() => indexProductCatalog(products), [products]);
  const filtered = useMemo(() => searchProductCatalog(index, deferredSearch), [index, deferredSearch]);
  const boxes = useMemo(() => new Map(boxRows.map((item) => [item.productId, item.unitsPerBox])), [boxRows]);
  const context = useMemo<CountContextValue>(() => ({ counts, boxes, setCount: (id, field, value) => setCounts((current) => ({ ...current, [id]: { ...(current[id] ?? emptyCount), [field]: value } })) }), [counts, boxes]);

  const loadOpening = async () => {
    setOpeningReady(false);
    const response = await apiRequest<{ opening: Opening | null }>({ url: buildApiUrl("/warehouse/opening") });
    if (response && typeof response === "object" && "opening" in response) {
      const value = response.opening as Opening | null;
      if (value === null || (typeof value === "object" && Number.isFinite(value.id) && value.id > 0)) {
        setOpening(value);
        setOpeningReady(true);
        return;
      }
    }
    toast.error("No se pudo consultar el estado del almacén.");
  };

  useEffect(() => {
    let active = true;
    void fetchProducts("");
    void loadOpening();
    void apiRequest<BoxRow[]>({ url: buildApiUrl("/warehouse/units-per-box") }).then((result) => {
      if (!active) return;
      if (Array.isArray(result) && result.every((item) => item && Number.isFinite(item.productId) && (item.unitsPerBox === null || Number.isFinite(item.unitsPerBox)))) setBoxRows(result);
      else setBoxError(true);
    });
    return () => { active = false; };
  }, [fetchProducts]);

  const confirmSave = () => {
    const entries = Object.entries(counts).filter(([, count]) => Object.values(count).some((value) => value !== ""));
    if (!entries.length) return toast.error("Ingrese cantidades para al menos un producto.");
    if (entries.some(([, count]) => Object.values(count).some((value) => value !== "" && (!/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) > 99999999))))
      return toast.error("Las cantidades deben tener hasta dos decimales.");
    const items = entries.map(([id, count]) => ({ productId: Number(id), wholesale: Number(count.wholesale || 0), dispatch: Number(count.dispatch || 0), display: Number(count.display || 0) }));
    const action = opening ? "cerrar" : "abrir";
    openDialog({
      title: opening ? "Cerrar almacén" : "Abrir almacén",
      content: <p>Se registrarán {items.length} productos con cantidades ingresadas. ¿Desea {action} el almacén?</p>,
      confirmText: opening ? "Cerrar almacén" : "Abrir almacén",
      onConfirm: async () => {
        const url = opening ? `/warehouse/opening/${opening.id}/close` : "/warehouse/opening";
        const result = await apiRequest<{ ok: boolean }>({ url: buildApiUrl(url), method: "POST", data: { items } });
        if (!result || typeof result !== "object" || !("ok" in result) || result.ok !== true) {
          const error = result as { response?: { data?: { mensaje?: string } } };
          toast.error(error?.response?.data?.mensaje || "No se pudo registrar la operación.");
          return false;
        }
        setCounts({});
        toast.success(opening ? "Cierre registrado." : "Apertura registrada.");
        await loadOpening();
        return true;
      },
    });
  };

  return (
    <div className="space-y-4 p-2 sm:p-4">
      {boxError && <Alert severity="error">No se pudieron cargar las unidades por caja. El conteo por mayor no está disponible.</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-slate-600">{openingReady ? opening ? `Almacén abierto por ${opening.usuario}` : "Almacén sin apertura pendiente" : "Consultando estado del almacén..."}</span>
        <Button variant="contained" color="primary" disabled={!openingReady || boxError || loading} onClick={confirmSave}>{opening ? "Cerrar almacén" : "Abrir almacén"}</Button>
      </div>
      <CountContext.Provider value={context}>
        <DataTable columns={columns} data={filtered} manualFiltering isLoading={loading} initialPageSize={100} persistPageSize={false} tableMaxHeight="60vh" stickyHeader searchPlaceholder="Buscar producto por código o nombre" globalFilterValue={search} onGlobalFilterValueChange={setSearch} emptyMessage={deferredSearch.trim() ? "No hay productos que coincidan con la búsqueda." : "No hay productos disponibles."} footerContent={<span className="text-sm font-semibold text-slate-700">Productos: {filtered.length}</span>} />
      </CountContext.Provider>
    </div>
  );
}
