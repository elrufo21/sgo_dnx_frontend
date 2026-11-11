import JSZip from "jszip";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { createInventoryPreviewWorkbook, type PreviewMovement, type PreviewProduct } from "./inventoryPreviewExport";

export async function fetchPreviewMovements(codigo: string, fechaInicio: string, fechaFin: string): Promise<PreviewMovement[]> {
  const query = new URLSearchParams({ codigo, fechaInicio, fechaFin });
  const response = await apiRequest<unknown>({
    url: buildApiUrl(`/InventarioVistaPrevia?${query}`),
    config: { timeout: 120000 },
  });
  if (!Array.isArray(response)) throw new Error("No se pudieron consultar ambas sedes.");
  return response as PreviewMovement[];
}

export async function createPreviewZip(products: PreviewProduct[], fechaInicio: string, fechaFin: string, onProgress: (message: string) => void, initialStocks: Record<string, number> = {}): Promise<Blob> {
  const zip = new JSZip();
  onProgress("Consultando movimientos de ICA y COMAS...");
  const response = await apiRequest<unknown>({ url: buildApiUrl("/InventarioVistaPrevia/lote"), method: "POST", data: { codigos: products.map((product) => product.codigo), fechaInicio, fechaFin }, config: { timeout: 120000 } });
  if (!Array.isArray(response)) throw new Error("No se pudieron consultar ambas sedes. Verifique que la API esté actualizada.");
  const movements = new Map<string, PreviewMovement[]>();
  for (const row of response as PreviewMovement[]) {
    if (typeof row.codigo !== "string") throw new Error("La API devolvió movimientos sin código de producto.");
    const code = row.codigo.trim().toUpperCase().replace(/^(191|201|211|221|231|241|251)(?=.)/, "");
    const list = movements.get(code) ?? [];
    list.push(row);
    movements.set(code, list);
  }
  for (const [index, product] of products.entries()) {
    onProgress(`Preparando ${index + 1} de ${products.length}: ${product.codigo}`);
    const rows = movements.get(product.codigo.trim().toUpperCase()) ?? [];
    const initialStock = Object.prototype.hasOwnProperty.call(initialStocks, product.codigo) ? initialStocks[product.codigo] : 0;
    const buffer = await createInventoryPreviewWorkbook(product, fechaInicio, fechaFin, rows, "lote", initialStock).xlsx.writeBuffer();
    const filename = `${product.codigo}_${product.descripcion}`.replace(/[\\/:*?"<>|]/g, "").slice(0, 100) || "producto";
    zip.file(`${String(index + 1).padStart(4, "0")}_${filename}.xlsx`, buffer);
  }
  onProgress("Preparando archivo ZIP...");
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
