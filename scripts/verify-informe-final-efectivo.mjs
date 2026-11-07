import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/features/cashFlow/pages/CashFinalReportPage.tsx", import.meta.url), "utf8");
const file = ts.createSourceFile("CashFinalReportPage.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
const helpers = [];
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(file) === "totals") callback = node.initializer.arguments[0].getText(file);
  if (ts.isVariableStatement(node) && node.declarationList.declarations.some((item) => ["BASE_INCOMES", "isIocIncome", "isBaseIncome"].includes(item.name.getText(file)))) helpers.push(node.getText(file));
  ts.forEachChild(node, visit);
}
visit(file);
assert.ok(callback);
const code = ts.transpileModule(`${helpers.join("\n")}\nresult = (${callback})();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
for (const [obs, expenses, expected] of [[1000, [200, 50], 750], [100, [150], -50], [0.1, [0.2], -0.1], [100, [], 100]]) {
  const state = { preparation: { totalObs: obs, sencillo: 0 }, allExpenseRows: expenses.map(importe => ({ importe })), incomeRows: [], manualRows: [], coins: [] };
  runInNewContext(code, state);
  assert.equal(state.result.incomes[0].importe, expected);
  assert.equal(state.result.expected, expected);
  assert.equal(state.result.difference, -expected);
}
const state = {
  preparation: { totalObs: 1000, sencillo: 0 },
  allExpenseRows: [{ importe: 40 }],
  incomeRows: [{ descripcion: "VENTA LIBRE", importe: 100 }, { descripcion: "VITRINA", importe: 20 }],
  manualRows: [{ tipo: "income", importe: 15 }],
  coins: [{ denominacion: 10, cantidad: 100 }],
  view: "new",
};
runInNewContext(code, state);
assert.equal(state.result.expected, 1095);
assert.equal(state.result.difference, -95);
assert.equal(state.result.incomes.filter(row => row.descripcion === "VENTA LIBRE").length, 1);
assert.equal(state.result.incomes.filter(row => row.descripcion === "VITRINA").length, 1);
const saved = { ...state, view: "detail", incomeRows: [{ descripcion: "VITRINA", importe: 20 }], manualRows: [{ descripcion: "VENTA LIBRE", tipo: "income", importe: 100 }] };
runInNewContext(code, saved);
assert.equal(saved.result.expected, 1080);
assert.equal(saved.result.incomes.filter(row => row.descripcion === "VENTA LIBRE").length, 1);
console.log("OK: OBS, salidas, ventas libres, conceptos base y diferencial.");
