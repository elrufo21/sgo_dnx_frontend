const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const esbuild = require("esbuild");
const ExcelJS = require("exceljs");
const JSZip = require("jszip");

async function main() {
  const filename = path.resolve("src/features/accounting/pages/inventoryKardexExport.ts");
  const modules = ["@/config", "@/shared/helpers/apiRequest"];
  const result = await esbuild.build({
    entryPoints: [filename], bundle: true, platform: "node", format: "cjs", packages: "external",
    external: modules, write: false,
  });
  const movement = {
    codigoBase: "FB007", codigo: "191FB007", anexo: "0000", fecha: "2026-11-01", tipo: "01",
    serie: "F001", numero: "000001", operacion: "02", descripcion: "MORINZHI",
    entrada: 2, costoEntrada: 10.01, totalEntrada: 20.01,
    salida: 0, costoSalida: 0, totalSalida: 0, costoSaldo: 10.01,
  };
  const rows = process.argv[2]
    ? JSON.parse(fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, ""))
    : [movement, { ...movement, codigo: "251FB007", anexo: "0001", operacion: "01",
        entrada: 0, costoEntrada: 0, totalEntrada: 0, salida: 1, costoSalida: 87, totalSalida: 87, costoSaldo: 87 }];
  let request;
  const originalLoad = Module._load;
  Module._load = function (name, ...args) {
    if (name === modules[0]) return { buildApiUrl: (url) => url };
    if (name === modules[1]) return {
      apiRequest: async (args) => {
        request = args;
        return {
          movimientos: rows,
          origen: "reprocesado",
          cobertura: [
            { sede: "COMAS", desde: "2025-08-05", hasta: "2026-11-06" },
            { sede: "ICA", desde: "2025-09-01", hasta: "2026-11-05" },
          ],
        };
      },
    };
    return originalLoad.call(this, name, ...args);
  };
  let createKardexZip;
  try {
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    loaded._compile(result.outputFiles[0].text, filename);
    createKardexZip = loaded.exports.createKardexZip;
  } finally { Module._load = originalLoad; }
  const products = [...new Set(rows.map((row) => row.codigoBase)), "SIN-MOVIMIENTOS"]
    .map((codigo) => ({ codigo, descripcion: codigo, codigos: [] }));
  const balances = Object.fromEntries(products.map(({ codigo }) => [codigo, 0]));
  const { zip, notice } = await createKardexZip(products, "2026-11-01", "2026-11-06", () => {}, balances);
  assert.equal(request.url, "/InventarioVistaPrevia/reprocesar-reporte");
  assert.deepEqual(request.data.codigos, products.map(({ codigo }) => codigo));
  assert.match(notice, /ICA: .*2026-11-05/);
  assert.match(notice, /1 producto\(s\) sin movimientos/);
  const archive = await JSZip.loadAsync(await zip.arrayBuffer());
  assert.equal(Object.keys(archive.files).length, products.length - 1);
  for (const [index, file] of Object.values(archive.files).entries()) {
    const code = products[index].codigo;
    const expected = rows.filter((row) => row.codigoBase === code);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.async("nodebuffer"));
    const sheet = workbook.getWorksheet("Kardex");
    assert.equal(sheet.getRow(1).cellCount, 22);
    assert.equal(sheet.getCell("X2").value, 0);
    let balance = 0;
    for (const [i, row] of expected.entries()) {
      const n = i + 2;
      balance += row.entrada - row.salida;
      assert.equal(sheet.getCell(`A${n}`).value, row.anexo);
      assert.equal(sheet.getCell(`O${n}`).value, row.costoEntrada);
      assert.equal(sheet.getCell(`P${n}`).value, row.totalEntrada);
      assert.equal(sheet.getCell(`S${n}`).value, row.totalSalida);
      assert.equal(sheet.getCell(`T${n}`).value.result, balance);
      assert.equal(sheet.getCell(`U${n}`).value, row.costoSaldo);
      assert.equal(sheet.getCell(`V${n}`).value.result, balance * row.costoSaldo);
    }
    console.log(`${code}: ${expected.length} movimientos verificados, saldo final ${balance}.`);
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
