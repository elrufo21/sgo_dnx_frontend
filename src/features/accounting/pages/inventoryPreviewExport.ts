import { Workbook } from "exceljs";
import { addInventoryDesktopSheet } from "./inventoryDesktopFormat";

export type PreviewProduct = { codigo: string; descripcion: string; codigos: string[] };
export type PreviewMovement = {
  sede: string; anexo: string; origen: string; tipoCodigo: string; operacion: string;
  documentoId: number; detalleId: number; fecha: string; fechaHora: string; serie: string; numero: string;
  codigo: string; descripcion: string; cantidad: number | null; precio: number | null;
  estado: string; estadoSunat: string; incluidoScript: boolean; incluidoConsolidado: boolean;
};

function sourceCost(price: number): number {
  const scaled = Math.round(Math.abs(price) * 10000);
  if (!Number.isSafeInteger(scaled) || scaled > Number.MAX_SAFE_INTEGER - 59) throw new Error("El precio excede el rango admitido para calcular el Excel.");
  return Math.sign(price) * Math.floor((scaled + 59) / 118) / 100;
}

function lineTotal(quantity: number, cost: number): number {
  const quantityCents = Math.round(Math.abs(quantity) * 100);
  const costCents = Math.round(Math.abs(cost) * 100);
  const product = quantityCents * costCents;
  if (!Number.isSafeInteger(product) || product > Number.MAX_SAFE_INTEGER - 50) throw new Error("El importe excede el rango admitido para calcular el Excel.");
  return Math.sign(quantity) * Math.sign(cost) * Math.floor((product + 50) / 100) / 100;
}

export function createInventoryPreviewWorkbook(product: PreviewProduct, from: string, to: string, rows: PreviewMovement[], mode: "individual" | "lote") {
  if (rows.some((row) => typeof row.incluidoConsolidado !== "boolean"))
    throw new Error("Actualiza la API antes de generar el Excel.");
  const included = rows.filter((row) => row.incluidoConsolidado);
  if (included.some((row) => row.cantidad == null || row.precio == null || !Number.isFinite(row.cantidad) || !Number.isFinite(row.precio)))
    throw new Error("Hay movimientos sin cantidad o precio; revisa los datos antes de exportar.");
  const workbook = new Workbook();
  workbook.calcProperties.fullCalcOnLoad = true;
  const kardex = addInventoryDesktopSheet(workbook);
  kardex.getCell("A1").note = "Vista previa calculada según los scripts de escritorio. Saldo inicial y costos pendientes de validación contable.";
  let stockCents = 0;
  included.forEach((row, index) => {
    const quantity = row.cantidad!;
    const cost = sourceCost(row.precio!);
    const isEntry = row.origen === "COMPRA";
    const entrada = isEntry ? quantity : 0;
    const salida = isEntry ? 0 : quantity;
    const quantityCents = Math.round(quantity * 100);
    if (!Number.isSafeInteger(quantityCents)) throw new Error("La cantidad excede el rango admitido para calcular el Excel.");
    const rowNumber = index + 2;
    if (index > 0 || mode === "lote") stockCents += isEntry ? quantityCents : -quantityCents;
    if (!Number.isSafeInteger(stockCents)) throw new Error("El saldo excede el rango admitido para calcular el Excel.");
    const formattedDate = row.fecha.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
    const line = kardex.getRow(rowNumber);
    line.values = [row.anexo, 1, "01", 502017, "", formattedDate, row.tipoCodigo, row.serie, row.numero, isEntry ? "02" : "01", row.descripcion, "UNIDADES", 2, entrada, isEntry ? cost : 0, lineTotal(entrada, cost), salida, isEntry ? 0 : cost, lineTotal(salida, cost), 0, cost, 0];
    if (index === 0 && mode === "lote") line.getCell(24).value = 0;
    line.getCell(20).value = index === 0
      ? mode === "lote" ? { formula: "(X2+N2)-Q2", result: stockCents / 100 } : 0
      : { formula: `T${rowNumber - 1}+N${rowNumber}-Q${rowNumber}`, result: stockCents / 100 };
    line.getCell(22).value = { formula: `T${rowNumber}*U${rowNumber}`, result: (stockCents / 100) * cost };
    for (let col = 14; col <= 22; col++) line.getCell(col).numFmt = "#,##0.00";
  });
  if (included.length) {
    const total = kardex.getRow(included.length + 3);
    total.getCell(1).value = `Items: ${included.length}`;
    total.getCell(13).value = "TOTAL ING:";
    total.getCell(14).value = { formula: `SUBTOTAL(9,N2:N${included.length + 1})`, result: included.reduce((sum, row) => sum + (row.origen === "COMPRA" ? row.cantidad! : 0), 0) };
    total.getCell(16).value = "TOTAL SALIDA:";
    total.getCell(17).value = { formula: `SUBTOTAL(9,Q2:Q${included.length + 1})`, result: included.reduce((sum, row) => sum + (row.origen === "DOCUMENTO" ? row.cantidad! : 0), 0) };
    total.getCell(14).numFmt = total.getCell(17).numFmt = "#,##0.00";
  }
  const sheet = workbook.addWorksheet("Vista previa", { views: [{ state: "frozen", ySplit: 4 }] });
  sheet.addRow([`VISTA PREVIA — ${product.codigo} ${product.descripcion}`]);
  sheet.addRow([`Periodo: ${from} al ${to}. La hoja Kardex reproduce el cálculo del escritorio; requiere validación contable.`]);
  sheet.addRow([`Códigos agrupados: ${product.codigos.join(", ")}`]);
  sheet.addRow(["Sede", "Anexo", "Fecha", "Origen", "Operación", "Tipo", "Serie", "Número", "Código", "Producto", "Cantidad", "Precio de origen", "Estado", "Estado SUNAT", "Cumple filtro carga inicial", "ID documento", "ID detalle", "Incluido en Kardex"]);
  sheet.getRow(4).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(4).eachCell((cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF9C3030" } }; });
  rows.forEach((row) => {
    const line = sheet.addRow([row.sede, row.anexo, row.fecha, row.origen, row.operacion, row.tipoCodigo, row.serie, row.numero, row.codigo, row.descripcion, row.cantidad, row.precio, row.estado, row.estadoSunat, row.incluidoScript ? "Sí" : "No", row.documentoId, row.detalleId, row.incluidoConsolidado ? "Sí" : "No"]);
    line.getCell(11).numFmt = "#,##0.00";
    line.getCell(12).numFmt = "#,##0.00";
  });
  sheet.columns.forEach((column, index) => { column.width = index === 9 ? 45 : index === 14 ? 22 : 18; });
  sheet.autoFilter = { from: "A4", to: "R4" };
  return workbook;
}
