import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/features/cashFlow/pages/CashFinalReportPage.tsx", import.meta.url), "utf8");
const file = ts.createSourceFile("CashFinalReportPage.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = [];
let calculate, saveIncomes;
function visit(node) {
  if (ts.isVariableDeclaration(node)) {
    const name = node.name.getText(file);
    if (["BASE_INCOMES", "isIocIncome", "isBaseIncome"].includes(name)) declarations.push(`const ${node.getText(file)};`);
    if (name === "totals") calculate = node.initializer.arguments[0].getText(file);
  }
  if (ts.isPropertyAssignment(node) && node.name.getText(file) === "ingresos" && node.initializer.getText(file).startsWith("totals.incomes.flatMap")) saveIncomes = node.initializer.getText(file);
  ts.forEachChild(node, visit);
}
visit(file);
assert.ok(calculate && saveIncomes && declarations.length === 3);
const code = ts.transpileModule(`${declarations.join("\n")}\nclassify = isBaseIncome; totals = (${calculate})(); payload = ${saveIncomes};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
for (const stored of [
  [{ descripcion: "IOC (1)", importe: 766, id: 17, estado: "T" }],
  [{ descripcion: "IOC", importe: 100, id: 21, estado: "T" }, { descripcion: "IOC (2)", importe: 30, id: 22, estado: "M" }],
  [],
]) {
  const other = { descripcion: "IOC EXTRA", importe: 8, manual: true, tipo: "income", id: 50 };
  const state = { preparation: { totalObs: 0, sencillo: 0 }, allExpenseRows: [], incomeRows: stored, manualRows: [other], coins: [], view: "detail", editing: true, reportId: 1 };
  runInNewContext(code, state);
  assert.ok(stored.every(state.classify));
  assert.equal(state.classify(other), false);
  const ioc = state.totals.incomes.filter(row => row.descripcion === "IOC");
  assert.equal(ioc.length, 1);
  assert.equal(ioc[0].importe, stored.reduce((sum, row) => sum + row.importe, 0));
  assert.equal(state.totals.expected, ioc[0].importe + 8);
  assert.deepEqual(JSON.parse(JSON.stringify(state.payload.filter(row => /^IOC(?:\s*\(|$)/i.test(row.descripcion)))), stored);
  assert.ok(state.payload.some(row => row.descripcion === "IOC EXTRA" && row.id === 50));
}
console.log("OK: una fila IOC, totales e identificadores originales conservados al editar.");
