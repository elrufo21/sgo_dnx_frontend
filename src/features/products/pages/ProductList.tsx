import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { CrudList, type ColumnConfig } from "@/components/ListView";
import { useProductsStore } from "@/store/products/products.store";
import type { Product } from "@/types/product";
import type { ProductUnitOption } from "@/types/product";
import { FileUp } from "lucide-react";
import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { useDialogStore } from "@/store/app/dialog.store";
import { toast } from "@/shared/ui/toast";

type ProductoPdf = {
  pagina: number;
  categoria: string;
  codigo: string;
  nombre: string;
  unidadMedida: string;
  contenido: string;
  precioDistribuidor: number | null;
  precioMenudeo: number | null;
  sv: number | null;
  pv: number | null;
};

type ListaPreciosPdf = {
  vigenteDesde: string | null;
  productos: ProductoPdf[];
};

type GuardarListaPreciosPdfRespuesta = {
  registrados: number;
  actualizados: number;
  errores: string[];
};

const formatoMoneda = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

function VistaPreviaListaPrecios({ lista }: { lista: ListaPreciosPdf }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Vigencia: <strong>{lista.vigenteDesde ?? "No indicada"}</strong>. Se encontraron{" "}
        <strong>{lista.productos.length}</strong> productos.
      </p>
      <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              {[
                "Código",
                "Categoría",
                "Producto",
                "Unidad / contenido",
                "Distribuidor",
                "Menudeo",
                "SV",
                "PV",
              ].map((titulo) => (
                <th key={titulo} className="whitespace-nowrap px-3 py-2 font-semibold">
                  {titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {lista.productos.map((producto) => (
              <tr key={producto.codigo}>
                <td className="whitespace-nowrap px-3 py-2 font-medium">{producto.codigo}</td>
                <td className="px-3 py-2">{producto.categoria}</td>
                <td className="min-w-56 px-3 py-2">{producto.nombre}</td>
                <td className="min-w-52 px-3 py-2">
                  <div>{producto.unidadMedida}</div>
                  <div className="text-xs text-slate-500">{producto.contenido}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{formatoMoneda.format(producto.precioDistribuidor ?? 0)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{producto.precioMenudeo == null ? "-" : formatoMoneda.format(producto.precioMenudeo)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{producto.sv ?? "-"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{producto.pv ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ProductList = () => {
  const { products, fetchProducts, deleteProduct } = useProductsStore();
  const openDialog = useDialogStore((state) => state.openDialog);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [estadoFilter, setEstadoFilter] = useState<"ACTIVO" | "INACTIVO">(
    "ACTIVO",
  );
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  const fetchFiltered = useCallback(
    () => fetchProducts(estadoFilter),
    [fetchProducts, estadoFilter],
  );

  const cargarListaPrecios = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const archivo = event.target.files?.[0];
      event.target.value = "";
      if (!archivo) return;
      if (!archivo.name.toLowerCase().endsWith(".pdf")) {
        toast.error("Selecciona un archivo PDF.");
        return;
      }

      const data = new FormData();
      data.append("archivo", archivo);
      const lista = await apiRequest<ListaPreciosPdf, FormData, null>({
        url: `${API_BASE_URL}/Productos/lista-precios-pdf`,
        method: "POST",
        data,
        fallback: null,
      });

      if (!lista || !Array.isArray(lista.productos)) {
        toast.error("No se pudo leer la lista de precios.");
        return;
      }

      openDialog({
        title: "Productos encontrados en el PDF",
        content: <VistaPreviaListaPrecios lista={lista} />,
        maxWidth: "xl",
        fullWidth: true,
        hideCancelButton: true,
        cancelText: "Cerrar",
        confirmText: "Guardar en BD",
        onConfirm: async () => {
          const resultado = await apiRequest<
            GuardarListaPreciosPdfRespuesta,
            ListaPreciosPdf,
            null
          >({
            url: `${API_BASE_URL}/Productos/lista-precios-pdf/guardar`,
            method: "POST",
            data: lista,
            fallback: null,
          });

          if (!resultado) {
            toast.error("No se pudieron guardar los productos.");
            return false;
          }

          await fetchFiltered();
          const mensaje = `${resultado.registrados} producto(s) nuevo(s)${
            resultado.actualizados > 0
              ? `; ${resultado.actualizados} actualizado(s)`
              : ""
          }.`;

          if (resultado.errores.length > 0) {
            toast.error(`${mensaje} No se pudo guardar: ${resultado.errores.join(", ")}.`);
          } else if (resultado.registrados > 0) {
            toast.success(mensaje);
          } else {
            toast.success(mensaje);
          }
        },
      });
    },
    [fetchFiltered, openDialog],
  );

  useEffect(() => {
    fetchFiltered();
  }, [fetchFiltered]);

  useEffect(() => {
    setFilteredProducts(products);
  }, [products]);

  const amountFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const formatAmount = (value: number) =>
    amountFormatter.format(Number.isFinite(value) ? value : 0);
  const formatCurrency = (value: number | string) =>
    ` ${formatAmount(Number(value) || 0)}`;
  const stockFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6,
      }),
    [],
  );
  const formatStock = (value: number) =>
    stockFormatter.format(Number.isFinite(value) ? value : 0);

  const normalizeUnitLabel = (value: unknown) =>
    String(value ?? "")
      .trim()
      .toUpperCase();
  const getReductionValue = (_row: Product, um: ProductUnitOption) => {
    const rawFactor = Number(um.valorUM ?? um.factor ?? 0);
    if (Number.isFinite(rawFactor) && rawFactor > 0) {
      return rawFactor;
    }
    return NaN;
  };
  const getAltStockForDisplay = (row: Product, um: ProductUnitOption) => {
    const baseStock = Number(row.cantidad ?? 0);
    const safeBaseStock =
      Number.isFinite(baseStock) && baseStock >= 0 ? baseStock : 0;
    const rawAltStock = Number(um.cantidad ?? 0);
    const safeAltStock =
      Number.isFinite(rawAltStock) && rawAltStock >= 0 ? rawAltStock : 0;

    const principalUnit = normalizeUnitLabel(row.unidadMedida);
    const altUnit = normalizeUnitLabel(um.unidadMedida);
    const hasDifferentUnit =
      principalUnit !== "" && altUnit !== "" && principalUnit !== altUnit;
    const looksUnconverted =
      hasDifferentUnit &&
      Math.abs(safeAltStock - safeBaseStock) < 0.000001 &&
      safeBaseStock > 0;

    if (!looksUnconverted && safeAltStock > 0) {
      return safeAltStock;
    }

    const reductionValue = getReductionValue(row, um);
    if (Number.isFinite(reductionValue) && reductionValue > 0) {
      return safeBaseStock / reductionValue;
    }

    return safeAltStock;
  };

  const isBienProduct = useCallback((product: Product) => {
    const type = String(product.aplicaINV ?? "")
      .trim()
      .toLowerCase();
    return type === "s" || type === "bien";
  }, []);

  const getRowProfitValues = useCallback(
    (product: Product) => {
      if (!isBienProduct(product)) {
        return { inversion: 0, ventaNeta: 0, ganancia: 0 };
      }

      const costo = Number(product.preCosto ?? 0);
      const ventaA = Number(product.preVenta ?? 0);
      const cantidad = Number(product.cantidad ?? 0);

      if (
        !Number.isFinite(costo) ||
        !Number.isFinite(ventaA) ||
        !Number.isFinite(cantidad)
      ) {
        return { inversion: 0, ventaNeta: 0, ganancia: 0 };
      }

      const inversion = costo * cantidad;
      const ventaNeta = ventaA * cantidad;
      const ganancia = ventaNeta - inversion;
      return { inversion, ventaNeta, ganancia };
    },
    [isBienProduct],
  );

  const profitTotals = useMemo(() => {
    return filteredProducts.reduce(
      (acc, product) => {
        const values = getRowProfitValues(product);
        acc.inversion += values.inversion;
        acc.ventaNeta += values.ventaNeta;
        acc.ganancia += values.ganancia;
        return acc;
      },
      { inversion: 0, ventaNeta: 0, ganancia: 0 },
    );
  }, [filteredProducts, getRowProfitValues]);
  const filterKeys = useMemo<(keyof Product & string)[]>(
    () => ["codigo", "nombre", "cantidad", "preVenta"],
    [],
  );

  const productColumns: ColumnConfig<Product>[] = [
    { key: "codigo", header: "Código" },
    { key: "nombre", header: "Nombre" },
    {
      key: "cantidad",
      header: "Stock",

      render: (row: Product) => {
        const stock = Number(row.cantidad ?? 0);
        const critico = Number(row.valorCritico ?? 0);
        const color =
          stock <= 0
            ? "text-red-600 font-bold"
            : stock <= critico
              ? "text-blue-600 font-bold"
              : "";
        return <span className={`${color} text-right w-full`}>{stock}</span>;
      },
      tdClassName: "text-right",
    },
    {
      key: "unidadMedida",
      header: "Unidad. M",
      render: (row: Product) => (
        <div className="space-y-1">
          <div className="font-medium text-slate-800">
            {row.unidadMedida}{" "}
            <span className="text-xs text-slate-500">(Principal)</span>
          </div>
          {Array.isArray(row.unidadesAlternas) &&
          row.unidadesAlternas.length > 0 ? (
            <div className="space-y-0.5 text-xs text-slate-600">
              {row.unidadesAlternas.map((um) => (
                <div key={`${row.id}-${um.unidadMedida}`}>
                  {um.unidadMedida}: Stock{" "}
                  {formatStock(getAltStockForDisplay(row, um))} | Venta{" "}
                  {formatCurrency(um.preVenta)}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "preVenta",
      header: "Precio",
      render: (row: Product) => ` ${Number(row.preVenta).toFixed(2)}`,
      tdClassName: "text-right",
    },
    {
      key: "preCosto",
      header: "Costo",
      render: (row: Product) => ` ${Number(row.preCosto).toFixed(2)}`,
      tdClassName: "text-right",
    },
    {
      id: "inversion",
      header: "Inversión",
      render: (row: Product) =>
        ` ${formatAmount(getRowProfitValues(row).inversion)}`,
      tdClassName: "text-right",
    },
    {
      id: "ventaNeta",
      header: "V. Neta",
      render: (row: Product) =>
        ` ${formatAmount(getRowProfitValues(row).ventaNeta)}`,
      tdClassName: "text-right",
    },
    {
      id: "ganancia",
      header: "Ganancia",
      render: (row: Product) =>
        ` ${formatAmount(getRowProfitValues(row).ganancia)}`,
      tdClassName: "text-right",
    },
  ];
  return (
    <CrudList
      data={products}
      fetchData={fetchFiltered}
      deleteItem={deleteProduct}
      columns={productColumns}
      filterKeys={filterKeys}
      basePath="/maintenance/products"
      createLabel="Añadir producto"
      deleteMessage="¿Estás seguro de eliminar este producto?"
      showBackButton={false}
      toolbarActions={
        <>
          <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={cargarListaPrecios} />
          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#B23636] bg-white px-3 text-sm font-semibold text-[#B23636] transition-colors hover:bg-red-50"
          >
            <FileUp className="h-4 w-4" />
            Cargar PDF
          </button>
        </>
      }
      onFilteredDataChange={setFilteredProducts}
      renderFilters={
        <div className="flex items-center gap-2">
          <select
            value={estadoFilter}
            onChange={(e) =>
              setEstadoFilter(e.target.value as "ACTIVO" | "INACTIVO")
            }
            className="h-11 min-w-[9.5rem] rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-[#B23636] focus:ring-2 focus:ring-[#B23636]/20"
          >
            <option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Inactivos</option>
          </select>
        </div>
      }
      footerContent={
        <div className="flex justify-end">
          <div className="grid w-full max-w-3xl grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-3">
            <div className="border-b border-slate-200 px-4 py-3 text-right sm:border-b-0 sm:border-r">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                INVERSION (BIENES)
              </p>
              <p className="text-xl font-semibold text-slate-800">
                {formatAmount(profitTotals.inversion)}
              </p>
            </div>

            <div className="border-b border-slate-200 px-4 py-3 text-right sm:border-b-0 sm:border-r">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                VENTA NETA (A)
              </p>
              <p className="text-xl font-semibold text-slate-800">
                {formatAmount(profitTotals.ventaNeta)}
              </p>
            </div>

            <div className="px-4 py-3 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                GANANCIA
              </p>
              <p className="text-xl font-semibold text-slate-900">
                {formatAmount(profitTotals.ganancia)}
              </p>
            </div>
          </div>
        </div>
      }
    />
  );
};

export default ProductList;
