import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { create } from "zustand";

// Store real con transporte simulado; no llama a una API ni a SQL.
let response;
const context = vm.createContext({ console, URLSearchParams });
const dependencies = {
  "zustand": { create },
  "@/config": { API_BASE_URL: "http://test/api/v1" },
  "@/shared/helpers/apiRequest": { apiRequest: async () => response },
  "@/shared/helpers/localDate": { getLocalDateISO: () => "2026-10-26" },
};
const code = ts.transpileModule(
  fs.readFileSync(new URL("../src/store/orderNote/orderNote.store.ts", import.meta.url), "utf8"),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText;
const module = new vm.SourceTextModule(code, { context });
await module.link((name) => {
  const values = dependencies[name];
  assert.ok(values, `Dependencia no simulada: ${name}`);
  return new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { context });
});
await module.evaluate();
const store = module.namespace.useOrderNoteStore;
const fields = Array(46).fill("");
for (const [index, value] of Object.entries({
  0: "17", 1: "BOLETA", 2: "5", 3: "CLIENTE DE PRUEBA", 13: "26/10/2026 10:16:13",
  14: "USUARIO", 15: "DEPOSITO", 16: "PAGO/VARIOS", 23: "268.01",
  24: "268.01", 25: "0.00", 29: "CANCELADO", 35: "BA01", 36: "00162690",
  42: "0.00", 43: "268.01", 44: "ENVIADO", 45: "36009898",
})) fields[index] = value;

for (const concept of ["VENTA", "FACTURA MANUAL", "", "  VENTA LIBRE  "]) {
  response = [...fields, concept].join("|");
  await store.getState().fetchNotes();
  const note = store.getState().notes[0];
  assert.equal(note.conceptoOBS, concept.trim() || "-");
  assert.equal(note.codigoCliente, "36009898");
  assert.equal(note.estadoSunat, "ENVIADO");
  assert.equal(note.total, "268.01");
  assert.equal(note.efectivo, "0.00");
  assert.equal(note.deposito, "268.01");
}
response = fields.join("|");
await store.getState().fetchNotes();
assert.equal(store.getState().notes[0].conceptoOBS, "-", "Un procedimiento anterior sigue siendo legible.");
for (const key of ["conceptoOBS", "ConceptoOBS"]) {
  response = [{ notaId: 17, clienteRazon: "CLIENTE", notaFecha: "2026-10-26", [key]: "FACTURA MANUAL" }];
  await store.getState().fetchNotes();
  assert.equal(store.getState().notes[0].conceptoOBS, "FACTURA MANUAL");
}
console.log("OK: concepto en cadena y JSON, conceptos vacíos, formato anterior e importes sin desplazamientos.");
