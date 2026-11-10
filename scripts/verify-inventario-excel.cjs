const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const esbuild = require("esbuild");
const ExcelJS = require("exceljs");

async function main() {
  const filename = path.resolve("src/features/accounting/pages/inventoryPreviewExport.ts");
  const result = await esbuild.build({ entryPoints: [filename], bundle: true, platform: "node", format: "cjs", packages: "external", write: false });
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(result.outputFiles[0].text, filename);
  const { createInventoryPreviewWorkbook } = loaded.exports;

  const product = { codigo: "FB007", descripcion: "Ejemplo", codigos: ["COMAS: FB007", "ICA: FB007"] };
  const movement = { sede: "COMAS", anexo: "0000", origen: "COMPRA", tipoCodigo: "01", operacion: "Compra", documentoId: 1, detalleId: 1, fecha: "2026-01-01", fechaHora: "2026-01-01T00:00:00", serie: "F001", numero: "001", codigo: "FB007", descripcion: "Ejemplo", cantidad: 2, precio: 118.0059, estado: "EMITIDO", estadoSunat: "", incluidoScript: true, incluidoConsolidado: true };
  const sale = { ...movement, sede: "ICA", anexo: "0001", origen: "DOCUMENTO", operacion: "Venta", cantidad: 1, precio: 118, detalleId: 2 };
  const credit = { ...sale, tipoCodigo: "07", operacion: "Nota de crédito", detalleId: 3, incluidoConsolidado: false };
  const rows = [movement, sale, credit];
  const read = async (mode) => {
    const output = createInventoryPreviewWorkbook(product, "2026-01-01", "2026-01-31", rows, mode);
    const restored = new ExcelJS.Workbook();
    await restored.xlsx.load(await output.xlsx.writeBuffer());
    return restored;
  };

  const batch = await read("lote");
  const sheet = batch.getWorksheet("Kardex");
  assert.equal(sheet.getRow(1).cellCount, 22);
  assert.equal(sheet.getCell("A2").value, "0000");
  assert.equal(sheet.getCell("A3").value, "0001");
  assert.equal(sheet.getCell("O2").value, 100.01);
  assert.equal(sheet.getCell("P2").value, 200.02);
  assert.equal(sheet.getCell("R3").value, 100);
  assert.equal(sheet.getCell("X2").value, 0);
  assert.equal(sheet.getCell("T2").value.formula, "(X2+N2)-Q2");
  assert.equal(sheet.getCell("T2").value.result, 2);
  assert.equal(sheet.getCell("T3").value.result, 1);
  assert.equal(sheet.getCell("V3").value.result, 100);
  assert.equal(sheet.getCell("N5").value.result, 2);
  assert.equal(sheet.getCell("Q5").value.result, 1);
  assert.equal(batch.getWorksheet("Vista previa").getCell("R7").value, "No");

  const individual = (await read("individual")).getWorksheet("Kardex");
  assert.equal(individual.getCell("T2").value, 0);
  assert.equal(individual.getCell("T3").value.result, -1);
  assert.throws(() => createInventoryPreviewWorkbook(product, "2026-01-01", "2026-01-31", [{ ...movement, precio: null }], "lote"), /sin cantidad o precio/);
  assert.throws(() => createInventoryPreviewWorkbook(product, "2026-01-01", "2026-01-31", [{ ...movement, incluidoConsolidado: undefined }], "lote"), /Actualiza la API/);
  console.log("Excel de inventario: columnas, costos, saldos, filtros y errores verificados.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
