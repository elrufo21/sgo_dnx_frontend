import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { create } from "zustand";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";

// Ejecuta los stores y la tabla reales con transporte simulado; nunca llama a una API ni una BD.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const calls = [];
const context = vm.createContext({ console, AbortController, URLSearchParams, setTimeout, clearTimeout });
const modules = new Map();
const synthetic = (key, exports) => {
  if (!modules.has(key)) {
    modules.set(key, new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    }, { context, identifier: key }));
  }
  return modules.get(key);
};
const link = async (specifier) => {
  if (specifier === "@/config") return synthetic(specifier, {
    API_BASE_URL: "http://test/api/v1", buildApiUrl: (route) => `http://test/api/v1${route}`,
  });
  if (specifier === "@/shared/helpers/apiRequest") return synthetic(specifier, {
    apiRequest: (request) => new Promise((resolve) => calls.push({ request, resolve })),
  });
  if (specifier === "zustand") return synthetic(specifier, { create });
  if (specifier === "@/store/app/dialog.store") return synthetic(specifier, {
    useDialogStore: (selector) => selector({ open: false }),
  });
  if (specifier.startsWith("@/")) return load(path.join(root, "src", specifier.slice(2)));
  return synthetic(specifier, await import(specifier));
};
const load = async (file) => {
  if (!path.extname(file)) file += fs.existsSync(file + ".ts") ? ".ts" : ".tsx";
  if (modules.has(file)) return modules.get(file);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = new vm.SourceTextModule(source, { context, identifier: file });
  modules.set(file, mod);
  await mod.link(link);
  await mod.evaluate();
  return mod;
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
const cashModule = await load(path.join(root, "src/store/cashFlow/cashFlow.store.ts"));
const invoiceModule = await load(path.join(root, "src/store/serviceInvoices/serviceInvoices.store.ts"));
const cash = cashModule.namespace.useCashFlowStore;
const invoices = invoiceModule.namespace.useServiceInvoicesStore;

for (const test of [
  { store: cash, fetch: "fetchFlows", rows: "flows", row: (id) => ({ cajaId: id, estado: "CERRADA", diferencia: -12.34 }), id: (r) => r.id },
  { store: invoices, fetch: "fetchInvoices", rows: "invoices", row: (id) => ({ docuId: id, docuEstado: "ANULADO" }), id: (r) => r.compra.compraId },
]) {
  const filters = { fechaInicio: "2026-10-01", fechaFin: "2026-10-31", page: 2, pageSize: 10, buscar: "Liz" };
  const before = calls.length;
  const one = test.store.getState()[test.fetch](filters);
  const duplicate = test.store.getState()[test.fetch](filters);
  await tick();
  assert.equal(calls.length, before + 1, "Una petición idéntica en curso no debe duplicarse");
  const call = calls.at(-1);
  assert.equal(new URL(call.request.url).searchParams.get("page"), "2");
  assert.equal(new URL(call.request.url).searchParams.get("buscar"), "Liz");
  assert.equal(call.request.config.timeout, 20000);
  assert.equal(test.store.getState().loading, true);
  call.resolve({ items: [test.row(70), test.row(99)], totalRows: 120, page: 2, pageSize: 10 });
  await Promise.all([one, duplicate]);
  assert.deepEqual(Array.from(test.store.getState()[test.rows], test.id), [70, 99], "Respetar orden SQL");
  assert.equal(test.store.getState().totalRows, 120);
  assert.equal(test.store.getState().loading, false);
  if (test.store === cash) assert.equal(test.store.getState().flows[0].diferencia, -12.34);

  const old = test.store.getState()[test.fetch]({ ...filters, buscar: "antigua" });
  await tick();
  const oldCall = calls.at(-1);
  const current = test.store.getState()[test.fetch]({ ...filters, buscar: "actual" });
  await tick();
  assert.equal(oldCall.request.config.signal.aborted, true);
  calls.at(-1).resolve({ items: [test.row(123)], totalRows: 1, page: 1, pageSize: 10 });
  await current;
  oldCall.resolve({ items: [test.row(456)], totalRows: 999, page: 1, pageSize: 10 });
  await old;
  assert.equal(test.id(test.store.getState()[test.rows][0]), 123, "Una respuesta tardía no debe reemplazar resultados nuevos");
  assert.equal(test.store.getState().totalRows, 1);

  const failure = test.store.getState()[test.fetch]({ ...filters, buscar: "fallo" });
  await tick();
  calls.at(-1).resolve({ isAxiosError: true, message: "timeout", code: "ECONNABORTED" });
  await failure;
  assert.ok(test.store.getState().error, "Un fallo debe mostrarse, no convertirse en vacío válido");
  assert.ok(test.store.getState().error.includes("tiempo"));
  assert.equal(test.store.getState().loading, false);
  assert.equal(test.store.getState().totalRows, 0);
  const empty = test.store.getState()[test.fetch]({ ...filters, buscar: "sin coincidencias" });
  await tick();
  calls.at(-1).resolve({ items: [], totalRows: 0, page: 1, pageSize: 10 });
  await empty;
  assert.equal(test.store.getState().error, null, "Un resultado vacío válido no debe convertirse en error");
  assert.equal(test.store.getState()[test.rows].length, 0);
  console.log(`${test.fetch}: deduplicación, cancelación, orden, paginación y errores OK`);
}

const tableModule = await load(path.join(root, "src/components/DataTable.tsx"));
const Table = tableModule.namespace.default;
const renderTable = (manualFiltering) => renderToStaticMarkup(React.createElement(MemoryRouter, null,
  React.createElement(Table, {
    columns: [{ accessorKey: "name", header: "Nombre" }], data: [{ name: "resultado del servidor" }],
    globalFilterValue: "busqueda fuera de pagina", manualFiltering, totalRows: 40,
    paginationPage: 2, paginationPageSize: 10, onPaginationChange() {}, persistPageSize: false,
  }),
));
assert.ok(renderTable(true).includes("resultado del servidor"), "La búsqueda remota no debe volver a filtrar solo la página");
assert.ok(!renderTable(false).includes("resultado del servidor"), "Las tablas locales conservan su filtro");
console.log("DataTable: búsqueda remota y compatibilidad de búsqueda local OK");
