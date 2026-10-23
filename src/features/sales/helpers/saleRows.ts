import type { Product } from "@/types/product";

export type SaleRow = {
  product: Product;
  code: string;
  description: string;
  quantity: number;
  price: number;
  cost: number;
  stock: number;
  pv: number;
  sv: number;
  matched: boolean;
  valueUm?: number;
};

export const productToRow = (
  product: Product,
  quantity: number,
  matched = true,
): SaleRow => ({
  product,
  code: product.codigo,
  description: product.nombre,
  quantity,
  price: Number(product.preVenta ?? product.preVentaB ?? 0),
  cost: Number(product.preCosto ?? 0),
  stock: Number(product.cantidad ?? 0),
  pv: Number(product.pv ?? 0),
  sv: Number(product.sv ?? 0),
  matched,
});

export function setSaleProductQuantity(
  rows: SaleRow[],
  product: Product,
  value: string | number,
): SaleRow[] {
  const quantity = value === "" ? 0 : Number(value);
  if (!Number.isFinite(quantity) || quantity < 0) return rows;
  const existing = rows.find((row) => row.code === product.codigo);
  if (quantity === 0) {
    return existing ? rows.filter((row) => row !== existing) : rows;
  }
  if (!existing) return [...rows, productToRow(product, quantity)];
  if (existing.quantity === quantity) return rows;
  return rows.map((row) => row === existing ? { ...row, quantity } : row);
}
