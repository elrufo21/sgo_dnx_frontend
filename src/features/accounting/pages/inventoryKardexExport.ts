import { Workbook } from "exceljs";
import JSZip from "jszip";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { addInventoryDesktopSheet } from "./inventoryDesktopFormat";
import type { PreviewProduct } from "./inventoryPreviewExport";

export type KardexMovement = {
  codigoBase: string;
  codigo: string;
  anexo: string;
  fecha: string;
  tipo: string;
  serie: string;
  numero: string;
  operacion: string;
  descripcion: string;
  entrada: number;
  costoEntrada: number;
  totalEntrada: number;
  salida: number;
  costoSalida: number;
  totalSalida: number;
  costoSaldo: number;
};

type Coverage = { sede: string; desde: string | null; hasta: string | null };
type KardexBatch = { movimientos: KardexMovement[]; cobertura: Coverage[]; origen: string };

export function createKardexWorkbook(rows: KardexMovement[], initialStock: number, note: string) {
  const workbook = new Workbook();
  workbook.calcProperties.fullCalcOnLoad = true;
  const sheet = addInventoryDesktopSheet(workbook);
  sheet.getCell("A1").note = note;
  sheet.getCell("X2").value = initialStock;
  let stockCents = Math.round(initialStock * 100);
  let entriesCents = 0;
  let exitsCents = 0;
  rows.forEach((row, index) => {
    if (![row.entrada, row.costoEntrada, row.totalEntrada, row.salida, row.costoSalida, row.totalSalida, row.costoSaldo].every(Number.isFinite))
      throw new Error("Kardex devolvió un movimiento sin cantidades o costos válidos.");
    const entryCents = Math.round(row.entrada * 100);
    const exitCents = Math.round(row.salida * 100);
    entriesCents += entryCents;
    exitsCents += exitCents;
    stockCents += entryCents - exitCents;
    if (![stockCents, entriesCents, exitsCents].every(Number.isSafeInteger))
      throw new Error("Las cantidades de Kardex exceden el rango admitido por el Excel.");
    const lineNumber = index + 2;
    const line = sheet.getRow(lineNumber);
    const date = row.fecha.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
    const number = /^\d{1,15}$/.test(row.numero) ? Number(row.numero) : row.numero;
    for (const [i, value] of [
      row.anexo, 1, "01", 502017, "", date, row.tipo, row.serie, number, row.operacion,
      row.descripcion, "UNIDADES", 2, row.entrada, row.costoEntrada, row.totalEntrada,
      row.salida, row.costoSalida, row.totalSalida, 0, row.costoSaldo, 0,
    ].entries()) line.getCell(i + 1).value = value;
    line.getCell(20).value = {
      formula: index === 0 ? "(X2+N2)-Q2" : `T${lineNumber - 1}+N${lineNumber}-Q${lineNumber}`,
      result: stockCents / 100,
    };
    line.getCell(22).value = { formula: `T${lineNumber}*U${lineNumber}`, result: (stockCents / 100) * row.costoSaldo };
    for (let col = 14; col <= 22; col++) line.getCell(col).numFmt = "#,##0.00";
  });
  if (rows.length) {
    const total = sheet.getRow(rows.length + 3);
    total.getCell(14).value = { formula: `SUBTOTAL(9,N2:N${rows.length + 1})`, result: entriesCents / 100 };
    total.getCell(17).value = { formula: `SUBTOTAL(9,Q2:Q${rows.length + 1})`, result: exitsCents / 100 };
    total.getCell(14).numFmt = total.getCell(17).numFmt = "#,##0.00";
  }
  return workbook;
}

export async function createKardexZip(
  products: PreviewProduct[], fechaInicio: string, fechaFin: string,
  onProgress: (message: string) => void, initialStocks: Record<string, number>,
) {
  onProgress("Reprocesando Kardex del reporte de ICA y COMAS...");
  const response = await apiRequest<KardexBatch>({
    url: buildApiUrl("/InventarioVistaPrevia/reprocesar-reporte"), method: "POST",
    data: { codigos: products.map((product) => product.codigo), fechaInicio, fechaFin },
    config: { timeout: 120000 },
  });
  if (!Array.isArray(response?.movimientos) || !Array.isArray(response?.cobertura) || response.origen !== "reprocesado")
    throw new Error("No se pudo reprocesar el reporte en ambas sedes. Verifique la API y la conexión.");

  const coverage = response.cobertura.map(({ sede, desde, hasta }) =>
    desde && hasta ? `${sede}: ${desde} a ${hasta}` : `${sede}: sin registros`);
  const outside = response.cobertura.some(({ desde, hasta }) => !desde || !hasta || fechaInicio < desde || fechaFin > hasta);
  const warning = outside ? `El rango excede las fechas de los documentos disponibles. ${coverage.join(" · ")}` : "";
  const byProduct = new Map<string, KardexMovement[]>();
  for (const row of response.movimientos) {
    const code = row.codigoBase.toUpperCase();
    const list = byProduct.get(code) ?? [];
    list.push(row);
    byProduct.set(code, list);
  }
  const zip = new JSZip();
  let skipped = 0;
  for (const [index, product] of products.entries()) {
    const rows = byProduct.get(product.codigo.toUpperCase());
    if (!rows?.length) { skipped++; continue; }
    const saldo = initialStocks[product.codigo];
    if (!Number.isFinite(saldo) || !Number.isSafeInteger(Math.round(saldo * 100)))
      throw new Error(`Ingrese un saldo inicial válido para ${product.codigo}.`);
    onProgress(`Preparando ${index + 1} de ${products.length}: ${product.codigo}`);
    const note = [
      `Producto ${product.codigo}. Período ${fechaInicio} a ${fechaFin}. Saldo inicial: ${saldo}.`,
      `Códigos en los movimientos: ${[...new Set(rows.map((row) => row.codigo))].join(", ")}.`,
      "Kardex del reporte reconstruido desde ventas y compras según IngresarKardex.sql y KardexUnion.sql.",
      `Fechas de documentos disponibles: ${coverage.join(" · ")}.`, warning,
    ].filter(Boolean).join("\n");
    const buffer = await createKardexWorkbook(rows, saldo, note).xlsx.writeBuffer();
    const filename = `${product.codigo}_${product.descripcion}`.replace(/[\\/:*?"<>|]/g, "").slice(0, 100) || "producto";
    zip.file(`${String(index + 1).padStart(4, "0")}_${filename}.xlsx`, buffer);
  }
  if (skipped === products.length)
    throw new Error(["No hay movimientos de Kardex para los productos y fechas seleccionados.", warning].filter(Boolean).join(" "));
  onProgress("Preparando archivo ZIP...");
  const notice = [warning, skipped ? `${skipped} producto(s) sin movimientos quedaron fuera del ZIP.` : ""].filter(Boolean).join(" ");
  return { zip: await zip.generateAsync({ type: "blob", compression: "DEFLATE" }), notice };
}
