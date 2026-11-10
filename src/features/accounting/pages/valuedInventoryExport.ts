import { Workbook } from "exceljs";

export type InventoryMovement = { id: number; fecha: string; tipo: string; serie: string; numero: string; operacion: string; descripcion: string; entrada: number; costoEntrada: number; totalEntrada: number; salida: number; costoSalida: number; totalSalida: number; stock: number; costoSaldo: number; totalSaldo: number; concepto: string };

export function createInventoryWorkbook(rows: InventoryMovement[]) {
  const workbook = new Workbook();
  workbook.calcProperties.fullCalcOnLoad = true;
  const sheet = workbook.addWorksheet("Kardex");
  const headers = ["ANEXO", "CodigoUtili", "TipoExistencia", "CodigoExistencia", "CodigoOSCE", "FechaEmision", "Tipo", "Serie", "Numero", "TipoOPR", "Descripcion", "UM", "Metodo", "CantidadING", "CostoUnitario", "CostoTotal", "CantidadSAL", "CostoUnita", "CostoTotalS", "Stock", "CostoUni", "CostoTotalF"];
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).eachCell((cell, index) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index <= 13 ? "FF3377FF" : index <= 16 ? "FFFF6B6B" : index <= 19 ? "FF008000" : "FF000000" } }; });
  let calculatedStock = 0;
  rows.forEach((row, index) => {
    const excelRow = sheet.addRow(["0001", 1, "01", 502017, "", row.fecha, row.tipo, row.serie, row.numero, row.operacion, row.descripcion, "UNIDADES", 2, row.entrada, row.costoEntrada, row.totalEntrada, row.salida, row.costoSalida, row.totalSalida, 0, row.costoSaldo, 0]);
    const rowNumber = index + 2;
    calculatedStock = index === 0 ? row.stock : calculatedStock + row.entrada - row.salida;
    excelRow.getCell(20).value = index === 0 ? row.stock : { formula: `T${rowNumber - 1}+N${rowNumber}-Q${rowNumber}`, result: calculatedStock };
    excelRow.getCell(22).value = { formula: `T${rowNumber}*U${rowNumber}`, result: calculatedStock * row.costoSaldo };
    for (let col = 14; col <= 22; col++) excelRow.getCell(col).numFmt = "#,##0.00";
  });
  const totalRow = sheet.getRow(rows.length + 3);
  totalRow.getCell(1).value = `Items: ${rows.length}`;
  totalRow.getCell(13).value = "TOTAL ING:";
  totalRow.getCell(14).value = { formula: `SUBTOTAL(9,N2:N${rows.length + 1})`, result: rows.reduce((sum, row) => sum + row.entrada, 0) };
  totalRow.getCell(16).value = "TOTAL SALIDA:";
  totalRow.getCell(17).value = { formula: `SUBTOTAL(9,Q2:Q${rows.length + 1})`, result: rows.reduce((sum, row) => sum + row.salida, 0) };
  sheet.columns.forEach((column, index) => { column.width = index === 10 ? 45 : 18; });
  return workbook;
}
