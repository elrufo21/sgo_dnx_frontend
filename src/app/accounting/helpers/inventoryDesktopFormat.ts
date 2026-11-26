import type { Workbook, Worksheet } from "exceljs";

export const INVENTORY_DESKTOP_HEADERS = [
  "ANEXO", "CodigoUtili", "TipoExistencia", "CodigoExistencia", "CodigoOSCE",
  "FechaEmision", "Tipo", "Serie", "Numero", "TipoOPR", "Descripcion", "UM",
  "Metodo", "CantidadING", "CostoUnitario", "CostoTotal", "CantidadSAL",
  "CostoUnita", "CostoTotalS", "Stock", "CostoUni", "CostoTotalF",
];

export function addInventoryDesktopSheet(workbook: Workbook): Worksheet {
  const sheet = workbook.addWorksheet("Kardex");
  sheet.addRow(INVENTORY_DESKTOP_HEADERS);
  const widths = [12, 14.3, 16.7, 20, 20, 17, 10, 10.5, 14.5, 14, 45, 16, 12.5, 16, 16, 16, 16, 16, 16, 16, 16, 16];
  sheet.columns.forEach((column, index) => { column.width = widths[index]; });
  sheet.getRow(1).font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).eachCell((cell, index) => {
    const color = index <= 13 ? "FF3377FF" : index <= 16 ? "FFFF6B6B" : index <= 19 ? "FF008000" : "FF000000";
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  });
  return sheet;
}
