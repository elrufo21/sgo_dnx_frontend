const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const esbuild = require("esbuild");

async function main() {
  const filename = path.resolve("src/features/accounting/pages/inventoryInitialStock.ts");
  const result = await esbuild.build({ entryPoints: [filename], bundle: true, platform: "node", format: "cjs", external: ["@/config", "@/shared/helpers/apiRequest"], write: false });
  const calls = [];
  const originalLoad = Module._load;
  Module._load = function (name, ...args) {
    if (name === "@/config") return { buildApiUrl: (url) => url };
    if (name === "@/shared/helpers/apiRequest") return { apiRequest: async (request) => { calls.push(request); return []; } };
    return originalLoad.call(this, name, ...args);
  };
  let functions;
  try {
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    loaded._compile(result.outputFiles[0].text, filename);
    functions = loaded.exports;
  } finally { Module._load = originalLoad; }
  await functions.fetchInitialStocks("2026-11-01");
  await functions.saveInitialStock("FB007", "2026-11-01", 100);
  assert.equal(calls[0].url, "/InventarioValorizado/saldos-iniciales?fechaInicio=2026-11-01");
  assert.deepEqual(calls[1].data, { codigo: "FB007", fechaInicio: "2026-11-01", cantidad: 100 });
  assert.equal(calls[1].method, "PUT");
  console.log("Saldo inicial: lectura y guardado dependen solo de la fecha de inicio.");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
