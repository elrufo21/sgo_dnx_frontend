const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const esbuild = require("esbuild");
const JSZip = require("jszip");
const ExcelJS = require("exceljs");

async function main() {
  const filename = path.resolve("src/features/accounting/pages/inventoryPreviewData.ts");
  const result = await esbuild.build({
    entryPoints: [filename], bundle: true, platform: "node", format: "cjs", packages: "external",
    external: ["@/config", "@/shared/helpers/apiRequest"], write: false,
  });
  let failCode = "";
  const requested = [];
  const originalLoad = Module._load;
  Module._load = function (name, ...args) {
    if (name === "@/config") return { buildApiUrl: (url) => url };
    if (name === "@/shared/helpers/apiRequest") return {
      apiRequest: async ({ url, method, data }) => {
        assert.equal(url, "/InventarioVistaPrevia/lote");
        assert.equal(method, "POST");
        requested.push(data.codigos);
        if (data.codigos.includes(failCode)) return { error: true };
        const rows = data.codigos.map((code) => ({ sede: "COMAS", anexo: "0000", origen: "COMPRA", tipoCodigo: "01", operacion: "Compra", documentoId: 1, detalleId: 1, fecha: "2026-01-02", fechaHora: "2026-01-02T00:00:00", serie: "F001", numero: "001", codigo: code === "FB124" ? "191FB124" : code, descripcion: code, cantidad: 2, precio: 118, estado: "EMITIDO", estadoSunat: "", incluidoScript: true, incluidoConsolidado: true }));
        if (data.codigos.includes("FB124")) rows.push({ ...rows[0], sede: "ICA", origen: "DOCUMENTO", codigo: "251FB124", cantidad: 1, detalleId: 2 });
        return rows;
      },
    };
    return originalLoad.call(this, name, ...args);
  };
  let createPreviewZip;
  try {
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    loaded._compile(result.outputFiles[0].text, filename);
    createPreviewZip = loaded.exports.createPreviewZip;
  } finally { Module._load = originalLoad; }

  const products = [
    { codigo: "FB124", descripcion: "COCOZHI", codigos: ["COMAS: FB124", "ICA: 251FB124"] },
    { codigo: "FB098", descripcion: "WHITE COFFE", codigos: ["ICA: 251FB098"] },
    { codigo: "001", descripcion: "ALOE", codigos: ["LOCAL: 001"] },
  ];
  const progress = [];
  const blob = await createPreviewZip(products, "2026-01-01", "2026-01-31", (message) => progress.push(message), { FB124: 7.5, FB098: 3, "001": 1 });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  assert.equal(Object.keys(zip.files).length, 3);
  const first = new ExcelJS.Workbook();
  await first.xlsx.load(await zip.file(Object.keys(zip.files)[0]).async("nodebuffer"));
  assert.equal(first.getWorksheet("Kardex").getCell("T2").value.result, 9.5);
  assert.equal(first.getWorksheet("Kardex").getCell("T3").value.result, 8.5);
  const local = new ExcelJS.Workbook();
  await local.xlsx.load(await zip.file(Object.keys(zip.files)[2]).async("nodebuffer"));
  assert.equal(local.getWorksheet("Kardex").getCell("T2").value.result, 3);
  assert.deepEqual(requested, [["FB124", "FB098", "001"]]);
  assert.equal(progress.at(-1), "Preparando archivo ZIP...");

  failCode = "FB098";
  await assert.rejects(createPreviewZip(products, "2026-01-01", "2026-01-31", () => {}), /No se pudieron consultar ambas sedes/);
  console.log("Lote de inventario: archivos por producto y fallo sin ZIP parcial verificados.");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
