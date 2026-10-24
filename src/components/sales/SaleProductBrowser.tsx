import { useEffect, useState, type ReactNode, type RefObject } from "react";
import SearchInput from "@/components/inputs/SearchInput";
import { SaleProductCatalog } from "@/components/sales/SaleProductCatalog";
import type { SaleRow } from "@/features/sales/helpers/saleRows";
import type { Product } from "@/types/product";

type SaleProductBrowserProps = {
  products: Product[];
  rows: SaleRow[];
  loading: boolean;
  disabled: boolean;
  autoFocus: boolean;
  visible: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  searchAside?: ReactNode;
  onShowProducts: () => void;
  onQuantityChange: (product: Product, value: string) => void;
};

export function SaleProductBrowser({
  visible,
  searchRef,
  searchAside,
  onShowProducts,
  autoFocus,
  ...catalogProps
}: SaleProductBrowserProps) {
  // Keep typing local so each keystroke does not rerender the sale/payment form.
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!visible) setSearch("");
  }, [visible]);

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0 flex-1">
          <SearchInput
            ref={searchRef}
            autoFocus={autoFocus}
            aria-label="Buscar producto por código o nombre"
            placeholder="Buscar producto por código o nombre"
            value={search}
            disabled={catalogProps.disabled}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setSearch(value);
              if (value.trim() && !visible) onShowProducts();
            }}
            onClear={() => {
              setSearch("");
              searchRef.current?.focus();
            }}
          />
        </div>
        {searchAside ? <div className="shrink-0 desktop:hidden">{searchAside}</div> : null}
      </div>
      <div
        id="sale-catalog-panel"
        role="region"
        aria-label="Productos"
        hidden={!visible}
      >
        <SaleProductCatalog {...catalogProps} search={search} />
      </div>
    </>
  );
}
