import { createContext, memo, useContext, useDeferredValue, useMemo, useState } from "react";
import type { CellContext, ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/DataTable";
import NavigableNumberInput from "@/components/inputs/NavigableNumberInput";
import type { SaleRow } from "@/features/sales/helpers/saleRows";
import { indexProductCatalog, searchProductCatalog } from "@/features/sales/helpers/productCatalogSearch";
import type { Product } from "@/types/product";

type CatalogProps = {
  products: Product[];
  rows: SaleRow[];
  loading: boolean;
  disabled: boolean;
  search: string;
  onQuantityChange: (product: Product, value: string) => void;
};

type QuantityContextValue = Pick<CatalogProps, "disabled" | "onQuantityChange"> & {
  quantities: Map<string, number>;
};

const QuantityContext = createContext<QuantityContextValue | null>(null);
const money = (value: unknown) => Number(value ?? 0).toFixed(2);

function QuantityCell({ row }: CellContext<Product, unknown>) {
  const context = useContext(QuantityContext);
  const [draft, setDraft] = useState<string | null>(null);
  if (!context) throw new Error("Falta el contexto del catálogo de productos.");
  const product = row.original;
  const quantity = context.quantities.get(product.codigo) ?? 0;

  return (
    <NavigableNumberInput
      aria-label={`Cantidad de ${product.codigo}`}
      min={0}
      step="any"
      navGroup="sale-product-catalog"
      value={draft ?? (Number.isFinite(quantity) && quantity > 0 ? quantity : "")}
      onFocus={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => setDraft(null)}
      onChange={(value) => {
        setDraft(value);
        context.onQuantityChange(product, value);
      }}
      disabled={context.disabled}
      className="ml-auto h-8 w-24 rounded-md border border-slate-300 bg-white px-2 text-right text-sm text-slate-800 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-100 disabled:bg-slate-50"
    />
  );
}

// Stable renderers preserve input focus while quantities update in the shared detail.
const columns: ColumnDef<Product, unknown>[] = [
  { accessorKey: "codigo", header: "Código" },
  {
    accessorKey: "nombre",
    header: "Descripción",
    meta: { tdClassName: "min-w-48 whitespace-normal" },
  },
  { id: "cantidadVenta", header: "Cantidad", cell: QuantityCell, meta: { align: "right" } },
  {
    accessorKey: "preVenta",
    header: "Precio",
    cell: ({ row }) => money(row.original.preVenta ?? row.original.preVentaB),
    meta: { align: "right" },
  },
  {
    accessorKey: "cantidad",
    header: "Stock",
    cell: ({ getValue }) => (
      <span className={Number(getValue()) <= 0 ? "rounded bg-red-100 px-2 py-1 font-semibold text-red-700" : ""}>
        {money(getValue())}
      </span>
    ),
    meta: { align: "right" },
  },
  { accessorKey: "pv", header: "PV", cell: ({ getValue }) => money(getValue()), meta: { align: "right" } },
];

const CatalogResults = memo(function CatalogResults({ index, search, loading }: {
  index: ReturnType<typeof indexProductCatalog>;
  search: string;
  loading: boolean;
}) {
  const filteredProducts = useMemo(() => searchProductCatalog(index, search), [index, search]);
  return (
      <DataTable
        columns={columns}
        data={filteredProducts}
        manualFiltering
        isLoading={loading}
        initialPageSize={100}
        persistPageSize={false}
        tableMaxHeight="46vh"
        showSearch={false}
        globalFilterValue={search}
        emptyMessage={search.trim() ? "No hay productos que coincidan con la búsqueda." : "No hay productos disponibles."}
      />
  );
});

export function SaleProductCatalog({ products, rows, loading, disabled, search, onQuantityChange }: CatalogProps) {
  const index = useMemo(() => indexProductCatalog(products), [products]);
  const deferredSearch = useDeferredValue(search);
  const quantities = useMemo(() => new Map(rows.map((row) => [row.code, row.quantity])), [rows]);
  const context = useMemo(() => ({ quantities, disabled, onQuantityChange }), [quantities, disabled, onQuantityChange]);

  return (
    <QuantityContext.Provider value={context}>
      <CatalogResults index={index} search={deferredSearch} loading={loading} />
    </QuantityContext.Provider>
  );
}
