import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { create } from "zustand";

let response;
const context = vm.createContext({ console, FormData, File });
const modules = {
  "zustand": { create },
  "@/config": { API_BASE_URL: "http://test/api/v1" },
  "@/shared/helpers/apiRequest": {
    apiRequest: async (request) => {
      assert.equal("fallback" in request, false, "No convertir fallos en productos guardados");
      return response;
    },
  },
};
const source = ts.transpileModule(fs.readFileSync(new URL("../src/store/products/products.store.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const module = new vm.SourceTextModule(source, { context });
await module.link((name) => {
  const exports = modules[name];
  if (!exports) throw new Error(`Dependencia inesperada: ${name}`);
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context });
});
await module.evaluate();
const store = module.namespace.useProductsStore;
const product = { codigo: "FB109", nombre: "PRUEBA", unidadMedida: "UNIDAD", preVenta: 10, preCosto: 10, cantidad: 1, estado: "ACTIVO", aplicaINV: "S", usuario: "test" };

response = "existe Codigo";
let result = await store.getState().addProduct(product);
assert.equal(result.ok, false);
assert.equal(result.error, "El código de producto ya existe.");
assert.equal(store.getState().products.length, 0);
response = { isAxiosError: true, response: { status: 400, data: "Imagen inválida" } };
result = await store.getState().addProduct(product);
assert.equal(result.error, "Imagen inválida");
response = { isAxiosError: true, message: "Network Error" };
result = await store.getState().addProduct(product);
assert.equal(result.error, "No se pudo crear el producto.");
response = "error";
result = await store.getState().addProduct(product);
assert.equal(result.ok, false);
assert.equal(store.getState().products.length, 0);
response = "123";
result = await store.getState().addProduct(product);
assert.equal(result.ok, true);
assert.equal(store.getState().products[0].id, 123);
response = "existe Codigo";
result = await store.getState().updateProduct(123, product);
assert.equal(result.error, "El código de producto ya existe.");
response = { isAxiosError: true, message: "Network Error" };
result = await store.getState().updateProduct(123, product);
assert.equal(result.error, "No se pudo guardar el producto.");
assert.equal(store.getState().products.length, 1);
console.log("Guardado de productos: duplicados, errores y éxito verificados.");
