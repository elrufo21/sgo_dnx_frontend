import { useEffect, useState, useCallback, useMemo } from "react";
import { CrudList } from "@/components/ListView";
import { useProductsStore } from "@/store/products/products.store";
import type { Product } from "@/types/product";
import type { ProductUnitOption } from "@/types/product";

const ProductList = () => {
  const { products, fetchProducts, deleteProduct } = useProductsStore();
  const [estadoFilter, setEstadoFilter] = useState<"ACTIVO" | "INACTIVO">(
    "ACTIVO",
  );
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);

  const fetchFiltered = useCallback(
    () => fetchProducts(estadoFilter),
    [fetchProducts, estadoFilter],
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
    String(value ?? "").trim().toUpperCase();
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

  const productColumns = [
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
      basePath="/products"
      createLabel="Añadir producto"
      deleteMessage="¿Estás seguro de eliminar este producto?"
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
