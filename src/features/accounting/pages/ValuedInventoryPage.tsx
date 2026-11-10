import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { FormProvider, useForm } from "react-hook-form";
import type { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/DataTable";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormAutocomplete } from "@/components/forms/HookFormAutocomplete";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { downloadBrowserFile } from "@/shared/helpers/downloadBrowserFile";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import { toast } from "@/shared/ui/toast";
import { createInventoryWorkbook, type InventoryMovement } from "./valuedInventoryExport";

type Product = { id: number; codigo: string; descripcion: string };
type Filters = { productoId: string; fechaInicio: string; fechaFin: string };
type Movement = InventoryMovement;
const money = (value: number) => Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ValuedInventoryPage() {
  const today = getLocalDateISO();
  const form = useForm<Filters>({ defaultValues: { productoId: "", fechaInicio: `${today.slice(0, 7)}-01`, fechaFin: today } });
  const [products, setProducts] = useState<Product[]>([]);
  const [rows, setRows] = useState<Movement[]>([]);
  const [loadedProduct, setLoadedProduct] = useState<Product | null>(null);
  const [loadedRange, setLoadedRange] = useState<Pick<Filters, "fechaInicio" | "fechaFin"> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void apiRequest<unknown>({ url: buildApiUrl("/InventarioValorizado/productos") }).then((result) => {
      if (!active) return;
      if (Array.isArray(result)) setProducts(result as Product[]);
      else toast.error("No se pudieron cargar los productos.");
    });
    return () => { active = false; };
  }, []);

  const search = useCallback(async (filters: Filters) => {
    const product = products.find((item) => String(item.id) === filters.productoId);
    if (!product || !filters.fechaInicio || !filters.fechaFin || filters.fechaInicio > filters.fechaFin) {
      toast.error("Seleccione un producto y un rango de fechas válido."); return;
    }
    setLoading(true);
    try {
      const query = new URLSearchParams(filters);
      const result = await apiRequest<unknown>({ url: buildApiUrl(`/InventarioValorizado?${query}`) });
      if (!Array.isArray(result)) throw new Error("Respuesta inválida");
      setRows(result as Movement[]);
      setLoadedProduct(product);
      setLoadedRange({ fechaInicio: filters.fechaInicio, fechaFin: filters.fechaFin });
    } catch { toast.error("No se pudieron consultar los movimientos."); }
    finally { setLoading(false); }
  }, [products]);

  const columns = useMemo<ColumnDef<Movement, unknown>[]>(() => [
    { accessorKey: "fecha", header: "Fecha" }, { accessorKey: "tipo", header: "Tipo" },
    { accessorKey: "serie", header: "Serie" }, { accessorKey: "numero", header: "Número" },
    { accessorKey: "operacion", header: "Operación" }, { accessorKey: "descripcion", header: "Descripción" },
    ...([
      ["entrada", "Entrada"], ["costoEntrada", "Costo unit. entrada"], ["totalEntrada", "Total entrada"],
      ["salida", "Salida"], ["costoSalida", "Costo unit. salida"], ["totalSalida", "Total salida"],
      ["stock", "Stock"], ["costoSaldo", "Costo unit. saldo"], ["totalSaldo", "Total saldo"],
    ] as [keyof Movement, string][]).map(([key, header]) => ({ accessorKey: key, header, cell: ({ row }: { row: { original: Movement } }) => money(Number(row.original[key]) || 0), meta: { align: "right" as const } })),
  ], []);

  const exportExcel = async () => {
    if (!rows.length || !loadedProduct) return;
    try {
      const buffer = await createInventoryWorkbook(rows).xlsx.writeBuffer();
      const filename = `${loadedProduct.codigo}_${loadedProduct.descripcion}`.replace(/[\\/:*?"<>|]/g, "").slice(0, 120);
      await downloadBrowserFile(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${filename}.xlsx`);
    } catch { toast.error("No se pudo exportar el inventario."); }
  };

  return <div className="space-y-4 p-3 sm:p-4">
    <h2 className="text-lg font-semibold text-slate-900">Inventario permanente valorizado</h2>
    <Link to="/accounting/inventario-valorizado/vista-previa" className="inline-flex rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">Vista previa ICA y COMAS</Link>
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(search)} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <BackArrowButton fallbackTo="/accounting" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-black hover:bg-slate-100" />
        <div className="w-full min-w-0 flex-1 sm:min-w-64 sm:max-w-md"><HookFormAutocomplete<Filters> name="productoId" label="Producto" placeholder="Buscar por código o descripción" disabled={loading} noOptionsText="No se encontraron productos" options={products.map((p) => ({ value: String(p.id), label: `${p.codigo} - ${p.descripcion}` }))} /></div>
        <HookFormInput<Filters> name="fechaInicio" label="F. inicio" type="date" />
        <HookFormInput<Filters> name="fechaFin" label="F. fin" type="date" />
        <button type="submit" disabled={loading} className="h-10 rounded-md bg-[#B23636] px-4 text-sm font-semibold text-white disabled:opacity-60">Buscar</button>
        <button type="button" disabled={loading || !rows.length} onClick={() => void exportExcel()} className="h-10 rounded-md border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700 disabled:opacity-60">Exportar Excel</button>
      </form>
    </FormProvider>
    <p className="text-sm text-slate-600">Muestra los movimientos ya registrados en Kardex; no reconstruye ventas ni compras.</p>
    {loadedProduct && loadedRange && <p className="text-sm font-semibold text-slate-800">{loadedProduct.codigo} - {loadedProduct.descripcion} · {loadedRange.fechaInicio} al {loadedRange.fechaFin}</p>}
    <DataTable data={rows} columns={columns} isLoading={loading} showSearch={false} emptyMessage="Seleccione un producto y consulte sus movimientos." initialPageSize={50} tableMaxHeight="65vh" />
  </div>;
}
