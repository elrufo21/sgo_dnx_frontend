import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/features/cashFlow/pages/CashFinalReportPage.tsx", import.meta.url), "utf8");
const file = ts.createSourceFile("CashFinalReportPage.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let callback;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(file) === "totals") callback = node.initializer.arguments[0].getText(file);
  ts.forEachChild(node, visit);
}
visit(file);
assert.ok(callback);
const code = ts.transpileModule(`result = (${callback})();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
for (const [obs, expenses, expected] of [[1000, [200, 50], 750], [100, [150], -50], [0.1, [0.2], -0.1], [100, [], 100]]) {
  const state = { preparation: { totalObs: obs, sencillo: 0 }, allExpenseRows: expenses.map(importe => ({ importe })), incomeRows: [], manualRows: [], coins: [] };
  runInNewContext(code, state);
  assert.equal(state.result.incomes[0].importe, expected);
  assert.equal(state.result.expected, expected);
  assert.equal(state.result.difference, -expected);
}
console.log("OK: OBS menos salidas, negativos, centavos y diferencial.");
