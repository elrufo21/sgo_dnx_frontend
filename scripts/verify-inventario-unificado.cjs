const assert = require("node:assert/strict");
const esbuild = require("esbuild");
const vm = require("node:vm");

const result = esbuild.buildSync({
  entryPoints: ["src/features/accounting/pages/inventoryProductMapping.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
});
const moduleObject = { exports: {} };
vm.runInNewContext(result.outputFiles[0].text, { module: moduleObject, exports: moduleObject.exports });
const { firstMissingInitialStock, mergeInventoryProducts, groupInventoryRows, readInventoryProducts } = moduleObject.exports;

const previousApi = [{ id: 1, codigo: "FB124", descripcion: "COCOZHI", stockActual: 8 }];
assert.equal(readInventoryProducts(previousApi).products[0].stockActual, 8);
assert.equal(readInventoryProducts(previousApi).hasInitialStock, false);
assert.equal(readInventoryProducts([{ ...previousApi[0], ultimoInv: null }]).hasInitialStock, true);
assert.equal(readInventoryProducts({ error: true }), null);
assert.equal(readInventoryProducts([null]), null);

const preview = [
  { codigo: "FB124", descripcion: "COCOZHI", codigos: ["COMAS: FB124", "ICA: 251FB124"] },
  { codigo: "FB098", descripcion: "WHITE COFFE", codigos: ["ICA: 251FB098"] },
];
assert.equal(firstMissingInitialStock(preview, { FB124: 0 }).codigo, "FB098");
assert.equal(firstMissingInitialStock(preview, { FB124: 0, FB098: 3 }), undefined);
assert.equal(firstMissingInitialStock([{ codigo: "constructor" }], {}).codigo, "constructor");
const rows = mergeInventoryProducts([
  { id: 1, codigo: "FB124", descripcion: "COCOZHI", stockActual: 8, ultimoInv: 2.15 },
  { id: 2, codigo: "251FB124", descripcion: "COCOZHI", stockActual: 3, ultimoInv: 3.25 },
  { id: 3, codigo: "FB999", descripcion: "OTRO", stockActual: 1 },
], preview);
assert.equal(rows.length, 4);
assert.equal(rows[0].preview.codigo, "FB124");
assert.equal(rows[1].preview.codigo, "FB124");
assert.equal(rows[2].preview.codigo, "FB999");
assert.equal(rows[2].preview.codigos[0], "LOCAL: FB999");
assert.equal(rows[3].preview.codigo, "FB098");
assert.equal(rows[3].id, null);
const special = { codigo: "constructor", descripcion: "", codigos: ["COMAS: constructor"] };
const specialRows = mergeInventoryProducts([{ id: 9, codigo: "constructor", descripcion: "", stockActual: 0, ultimoInv: -1.25 }], [special]);
assert.equal(groupInventoryRows(specialRows)[0].members[0].ultimoInv, -1.25);

const ambiguous = mergeInventoryProducts([{ id: 1, codigo: "ABC", descripcion: "", stockActual: 0 }], [
  { codigo: "A", descripcion: "A", codigos: ["COMAS: ABC"] },
  { codigo: "B", descripcion: "B", codigos: ["ICA: ABC"] },
]);
assert.equal(ambiguous[0].preview, null);
const local = mergeInventoryProducts([
  { id: 10, codigo: "001", descripcion: "ALOE", stockActual: 53, ultimoInv: 1 },
  { id: 11, codigo: "001", descripcion: "ALOE", stockActual: 2, ultimoInv: 2 },
  { id: 12, codigo: "", descripcion: "SIN CODIGO", stockActual: 0 },
], []);
assert.equal(local[0].preview.codigo, "001");
assert.equal(local[1].preview.codigo, "001");
assert.equal(local[2].preview, null);
const variants = mergeInventoryProducts([
  { id: 20, codigo: "191FB007", descripcion: "MORINZHI", stockActual: 12, ultimoInv: 1 },
  { id: 21, codigo: "201FB007", descripcion: "MORINZHI", stockActual: -7, ultimoInv: 2 },
  { id: 22, codigo: "181FB007", descripcion: "MORINZHI", stockActual: 10, ultimoInv: 4 },
], []);
const grouped = groupInventoryRows(variants);
assert.equal(grouped.length, 2);
assert.equal(grouped[0].codigo, "FB007");
assert.equal(grouped[0].stockActual, null);
assert.equal(grouped[0].members.length, 2);
assert.equal(grouped[0].codigosBusqueda.includes("201FB007"), true);
assert.equal(grouped[1].codigo, "181FB007");
const current = groupInventoryRows(mergeInventoryProducts([
  { id: 30, codigo: "191FB007", descripcion: "NOMBRE HISTORICO", stockActual: 1 },
  { id: 31, codigo: "FB007", descripcion: "NOMBRE VIGENTE", stockActual: 2 },
], []));
assert.equal(current.length, 1);
assert.equal(current[0].codigo, "FB007");
assert.equal(current[0].descripcion, "NOMBRE VIGENTE");
assert.equal(current[0].stockActual, 2);
console.log("Inventario unificado: equivalencias, sedes y códigos ambiguos verificados.");
