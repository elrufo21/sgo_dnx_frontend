import type { PreviewProduct } from "./inventoryPreviewExport";

export type InventoryProduct = { id: number | null; codigo: string; descripcion: string; stockActual: number | null; ultimoInv?: number | null };
export type InventoryProductRow = InventoryProduct & { preview: PreviewProduct | null };
export type InventoryProductGroup = InventoryProductRow & { members: InventoryProductRow[]; codigosBusqueda: string };

function baseCode(code: string): string {
  return /^(191|201|211|221|231|241|251).+/i.test(code) ? code.slice(3) : code;
}

export function readInventoryProducts(response: unknown): { products: InventoryProduct[]; hasInitialStock: boolean } | null {
  if (!Array.isArray(response) || !response.every((product) => product != null && typeof product === "object" && typeof product.codigo === "string")) return null;
  return {
    products: response as InventoryProduct[],
    hasInitialStock: response.every((product) => Object.prototype.hasOwnProperty.call(product, "ultimoInv")),
  };
}

export function mergeInventoryProducts(products: InventoryProduct[], previewProducts: PreviewProduct[]): InventoryProductRow[] {
  const variants = new Map<string, PreviewProduct | null>();
  const groups = new Map(previewProducts.map((product) => [product.codigo.trim().toUpperCase(), product]));
  for (const product of previewProducts) {
    for (const entry of product.codigos) {
      const code = entry.replace(/^(COMAS|ICA):\s*/i, "").trim().toUpperCase();
      if (!code) continue;
      const existing = variants.get(code);
      variants.set(code, existing && existing.codigo !== product.codigo ? null : existing === null ? null : product);
    }
  }
  const matched = new Set<string>();
  const rows = products.map((product) => {
    const code = product.codigo.trim();
    const key = code.toUpperCase();
    let preview = variants.get(key);
    if (preview === undefined && code) {
      const base = baseCode(code);
      const groupKey = base.toUpperCase();
      preview = groups.get(groupKey);
      if (!preview) {
        preview = { codigo: base, descripcion: product.descripcion, codigos: [`LOCAL: ${code}`] };
        groups.set(groupKey, preview);
      }
    }
    preview ??= null;
    if (preview) matched.add(preview.codigo);
    return { ...product, preview };
  });
  for (const preview of previewProducts) {
    if (!matched.has(preview.codigo))
      rows.push({ id: null, codigo: preview.codigo, descripcion: preview.descripcion, stockActual: null, preview });
  }
  return rows;
}

export function groupInventoryRows(rows: InventoryProductRow[]): InventoryProductGroup[] {
  const groups = new Map<string, InventoryProductGroup>();
  for (const [index, row] of rows.entries()) {
    const key = row.preview ? `group:${row.preview.codigo.toUpperCase()}` : `unmatched:${index}`;
    let group = groups.get(key);
    if (!group) {
      group = { ...row, codigo: row.preview?.codigo ?? row.codigo, descripcion: row.preview?.descripcion ?? row.descripcion, members: [], codigosBusqueda: "" };
      groups.set(key, group);
    }
    group.members.push(row);
  }
  return [...groups.values()].map((group) => {
    const local = group.members.filter((row) => row.id != null);
    const current = local.find((row) => row.codigo.trim().toUpperCase() === group.codigo.toUpperCase());
    const stockActual = current?.stockActual ?? null;
    return { ...group, descripcion: current?.descripcion ?? group.descripcion, stockActual, codigosBusqueda: [...group.members.map((row) => row.codigo), ...(group.preview?.codigos ?? [])].join(" ") };
  });
}
