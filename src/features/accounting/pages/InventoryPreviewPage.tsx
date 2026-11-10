import { useCallback, useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import type { ColumnDef } from "@tanstack/react-table";
import Checkbox from "@mui/material/Checkbox";
import JSZip from "jszip";
import { ArrowLeft, Download } from "lucide-react";
import DataTable from "@/components/DataTable";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { downloadBrowserFile } from "@/shared/helpers/downloadBrowserFile";
import { formatDate } from "@/shared/helpers/formatDate";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import { toast } from "@/shared/ui/toast";
import {
  createInventoryPreviewWorkbook,
  type PreviewMovement,
  type PreviewProduct,
} from "./inventoryPreviewExport";

type Filters = { codigo: string; fechaInicio: string; fechaFin: string };
const productSearchKeys: (keyof PreviewProduct & string)[] = [
  "codigo",
  "descripcion",
  "codigos",
];
const movementSearchKeys: (keyof PreviewMovement & string)[] = [
  "sede",
  "fecha",
  "operacion",
  "tipoCodigo",
  "serie",
  "numero",
  "codigo",
  "descripcion",
  "estado",
  "estadoSunat",
];
const number = (value: number | null) =>
  value == null
    ? "-"
    : value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

async function fetchMovements(
  codigo: string,
  fechaInicio: string,
  fechaFin: string,
): Promise<PreviewMovement[]> {
  const query = new URLSearchParams({ codigo, fechaInicio, fechaFin });
  const response = await apiRequest<unknown>({
    url: buildApiUrl(`/InventarioVistaPrevia?${query}`),
    config: { timeout: 120000 },
  });
  if (!Array.isArray(response))
    throw new Error("No se pudieron consultar ambas sedes.");
  return response as PreviewMovement[];
}

export default function InventoryPreviewPage() {
  const today = getLocalDateISO();
  const form = useForm<Filters>({
    defaultValues: {
      codigo: "",
      fechaInicio: `${today.slice(0, 7)}-01`,
      fechaFin: today,
    },
  });
  const [products, setProducts] = useState<PreviewProduct[]>([]);
  const [selection, setSelection] = useState<string[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<PreviewProduct[]>(
    [],
  );
  const [productFilter, setProductFilter] = useState("");
  const [movementFilter, setMovementFilter] = useState("");
  const [view, setView] = useState<"productos" | "movimientos">("productos");
  const [rows, setRows] = useState<PreviewMovement[]>([]);
  const [loadedProduct, setLoadedProduct] = useState<PreviewProduct | null>(
    null,
  );
  const [loadedRange, setLoadedRange] = useState<{
    fechaInicio: string;
    fechaFin: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const currentStart = form.watch("fechaInicio");
  const currentEnd = form.watch("fechaFin");
  const rangeChanged = loadedRange !== null &&
    (currentStart !== loadedRange.fechaInicio || currentEnd !== loadedRange.fechaFin);

  useEffect(() => {
    let active = true;
    void apiRequest<unknown>({
      url: buildApiUrl("/InventarioVistaPrevia/productos"),
    }).then((response) => {
      if (!active) return;
      if (Array.isArray(response)) setProducts(response as PreviewProduct[]);
      else
        toast.error(
          "No se pudieron cargar los productos de ambas sedes. Verifique la configuración y conexión.",
        );
    });
    return () => {
      active = false;
    };
  }, []);

  const validRange = (filters: Filters) =>
    Boolean(
      filters.fechaInicio &&
      filters.fechaFin &&
      filters.fechaInicio <= filters.fechaFin,
    );
  const search = useCallback(
    async (filters: Filters) => {
      const product = products.find((item) => item.codigo === filters.codigo);
      if (!product || !validRange(filters)) {
        toast.error("Seleccione un producto y un rango válido.");
        return;
      }
      setLoading(true);
      try {
        const data = await fetchMovements(
          product.codigo,
          filters.fechaInicio,
          filters.fechaFin,
        );
        setRows(data);
        setLoadedProduct(product);
        setLoadedRange({
          fechaInicio: filters.fechaInicio,
          fechaFin: filters.fechaFin,
        });
        setMovementFilter("");
        setView("movimientos");
      } catch {
        toast.error("No se pudieron consultar ambas sedes.");
      } finally {
        setLoading(false);
      }
    },
    [products],
  );

  const selectedCodes = useMemo(() => new Set(selection), [selection]);
  const allFilteredSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((product) => selectedCodes.has(product.codigo));
  const toggleFiltered = () => {
    const filteredCodes = new Set(
      filteredProducts.map((product) => product.codigo),
    );
    setSelection((current) =>
      allFilteredSelected
        ? current.filter((code) => !filteredCodes.has(code))
        : [...new Set([...current, ...filteredCodes])],
    );
  };

  const productColumns = useMemo<ColumnDef<PreviewProduct, unknown>[]>(
    () => [
      { accessorKey: "codigo", header: "Código" },
      { accessorKey: "descripcion", header: "Descripción" },
      {
        accessorKey: "codigos",
        header: "Códigos por sede",
        cell: ({ row }) => row.original.codigos.join(", "),
      },
      {
        id: "ver",
        header: "Detalle",
        cell: ({ row }) => (
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              form.setValue("codigo", row.original.codigo);
              void search({ ...form.getValues(), codigo: row.original.codigo });
            }}
            className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-50"
          >
            Ver movimientos
          </button>
        ),
      },
      {
        id: "exportar",
        header: "Exportar",
        cell: ({ row }) => (
          <Checkbox
            checked={selectedCodes.has(row.original.codigo)}
            disabled={loading}
            onChange={(_, checked) =>
              setSelection((current) =>
                checked
                  ? [...new Set([...current, row.original.codigo])]
                  : current.filter((code) => code !== row.original.codigo),
              )
            }
            size="small"
            inputProps={{
              "aria-label": `Seleccionar ${row.original.codigo} para exportar`,
            }}
            sx={{ color: "#B23636", "&.Mui-checked": { color: "#B23636" } }}
          />
        ),
        meta: { align: "center" },
      },
    ],
    [form, loading, search, selectedCodes],
  );

  const exportOne = async () => {
    if (!loadedProduct || !loadedRange) return;
    try {
      const buffer = await createInventoryPreviewWorkbook(
        loadedProduct,
        loadedRange.fechaInicio,
        loadedRange.fechaFin,
        rows,
        "individual",
      ).xlsx.writeBuffer();
      const filename =
        `${loadedProduct.codigo}_${loadedProduct.descripcion}`
          .replace(/[\\/:*?"<>|]/g, "")
          .slice(0, 110) || "producto";
      await downloadBrowserFile(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        `vista-previa_${filename}.xlsx`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo generar el Excel.");
    }
  };

  const exportBatch = async () => {
    const range = form.getValues();
    if (!validRange(range) || !selection.length) {
      toast.error("Seleccione productos y un rango válido.");
      return;
    }
    const selected = products.filter((p) => selection.includes(p.codigo));
    setLoading(true);
    try {
      const zip = new JSZip();
      for (const [index, product] of selected.entries()) {
        setProgress(
          `Preparando ${index + 1} de ${selected.length}: ${product.codigo}`,
        );
        const data = await fetchMovements(
          product.codigo,
          range.fechaInicio,
          range.fechaFin,
        );
        const buffer = await createInventoryPreviewWorkbook(
          product,
          range.fechaInicio,
          range.fechaFin,
          data,
          "lote",
        ).xlsx.writeBuffer();
        const filename =
          `${product.codigo}_${product.descripcion}`
            .replace(/[\\/:*?"<>|]/g, "")
            .slice(0, 100) || "producto";
        zip.file(
          `${String(index + 1).padStart(4, "0")}_${filename}.xlsx`,
          buffer,
        );
      }
      setProgress("Preparando archivo ZIP...");
      await downloadBrowserFile(
        await zip.generateAsync({ type: "blob", compression: "DEFLATE" }),
        `vista-previa-kardex_${range.fechaInicio}_${range.fechaFin}.zip`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se completó el lote; revise la conexión de ambas sedes.");
    } finally {
      setProgress("");
      setLoading(false);
    }
  };

  const columns = useMemo<ColumnDef<PreviewMovement, unknown>[]>(
    () => [
      { accessorKey: "sede", header: "Sede" },
      { accessorKey: "fecha", header: "Fecha", cell: ({ row }) => formatDate(row.original.fecha) || "-", meta: { tdClassName: "whitespace-nowrap" } },
      { accessorKey: "operacion", header: "Operación" },
      { accessorKey: "tipoCodigo", header: "Tipo" },
      { accessorKey: "serie", header: "Serie" },
      { accessorKey: "numero", header: "Número" },
      { accessorKey: "codigo", header: "Código" },
      { accessorKey: "descripcion", header: "Producto" },
      {
        accessorKey: "cantidad",
        header: "Cantidad",
        cell: ({ row }) => number(row.original.cantidad),
        meta: { align: "right" },
      },
      {
        accessorKey: "precio",
        header: "Precio de origen",
        cell: ({ row }) => number(row.original.precio),
        meta: { align: "right" },
      },
      { accessorKey: "estado", header: "Estado" },
      { accessorKey: "estadoSunat", header: "Estado SUNAT" },
      {
        accessorKey: "incluidoScript",
        header: "Cumple filtro carga inicial",
        cell: ({ row }) => (row.original.incluidoScript ? "Sí" : "No"),
      },
    ],
    [],
  );

  return (
    <div className="p-3 sm:p-4">
      <FormProvider {...form}>
        {progress && <p role="status" className="mb-2 text-sm text-slate-600">{progress}</p>}
        {view === "productos" ? (
          <DataTable
            data={products}
            columns={productColumns}
            isLoading={loading}
            searchPlaceholder="Buscar por código o descripción..."
            filterKeys={productSearchKeys}
            globalFilterValue={productFilter}
            onGlobalFilterValueChange={setProductFilter}
            onFilteredDataChange={setFilteredProducts}
            isolatedSearch
            emptyMessage="No se encontraron productos."
            initialPageSize={50}
            tableMaxHeight="65vh"
            toolbarLayout="filters-inline"
            toolbarLeading={<BackArrowButton fallbackTo="/accounting/inventario-valorizado" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-black hover:bg-slate-100" />}
            toolbarAction={<div className="flex items-center gap-2">
              <button type="button" onClick={toggleFiltered} disabled={loading || !filteredProducts.length} className="h-10 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">{allFilteredSelected ? "Desmarcar resultados" : "Marcar resultados"}</button>
              <button type="button" onClick={() => setSelection([])} disabled={loading || !selection.length} className="h-10 whitespace-nowrap rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60">Limpiar selección</button>
              <button type="button" onClick={() => void exportBatch()} disabled={loading || !selection.length} className="inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"><Download size={16} /> Exportar seleccionados</button>
            </div>}
            renderFilters={<div className="flex items-end gap-3"><div className="w-36"><HookFormInput<Filters> name="fechaInicio" label="F. inicio" type="date" disabled={loading} /></div><div className="w-36"><HookFormInput<Filters> name="fechaFin" label="F. fin" type="date" disabled={loading} /></div></div>}
            footerContent={<span>Seleccionados: <b>{selection.length}</b></span>}
          />
        ) : loadedProduct && loadedRange ? (
          <DataTable
            data={rows}
            columns={columns}
            isLoading={loading}
            searchPlaceholder="Buscar movimiento..."
            filterKeys={movementSearchKeys}
            globalFilterValue={movementFilter}
            onGlobalFilterValueChange={setMovementFilter}
            isolatedSearch
            emptyMessage="No hay movimientos para este producto en el rango consultado."
            initialPageSize={50}
            tableMaxHeight="65vh"
            toolbarLayout="filters-inline"
            toolbarLeading={<button type="button" onClick={() => setView("productos")} disabled={loading} aria-label="Volver a productos" title="Volver a productos" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-black hover:bg-slate-100 disabled:opacity-60"><ArrowLeft size={18} /></button>}
            toolbarAction={<button type="button" disabled={loading || rangeChanged} onClick={() => void exportOne()} aria-label="Descargar Excel del producto" title={rangeChanged ? "Actualiza la consulta para exportar" : "Descargar Excel del producto"} className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"><Download size={18} /></button>}
            renderFilters={<div className="flex items-end gap-3"><div className="w-36"><HookFormInput<Filters> name="fechaInicio" label="F. inicio" type="date" disabled={loading} /></div><div className="w-36"><HookFormInput<Filters> name="fechaFin" label="F. fin" type="date" disabled={loading} /></div><button type="button" onClick={() => void search({ ...form.getValues(), codigo: loadedProduct.codigo })} disabled={loading} className={`h-10 whitespace-nowrap rounded-md border px-3 text-sm font-semibold disabled:opacity-60 ${rangeChanged ? "border-[#B23636] bg-[#B23636] text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>Actualizar consulta</button></div>}
          />
        ) : null}
      </FormProvider>
    </div>
  );
}
