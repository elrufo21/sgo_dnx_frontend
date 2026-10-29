import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import ts from "typescript";
import { productToRow, setSaleProductQuantity } from "../src/features/sales/helpers/saleRows.ts";

const kimono = { id: 27, codigo: "25IAP027", nombre: "DXN KIMONO", preVenta: 168, preCosto: 100, cantidad: 4, pv: 5, sv: 8 };
const kit = { ...kimono, id: 28, codigo: "PEKIT13", nombre: "KIT PREMIUM", preVenta: 125 };
let rows = setSaleProductQuantity([], kimono, "1");
assert.equal(rows.length, 1);
assert.equal(rows[0].quantity, 1);
assert.equal(rows[0].price, 168);
rows = setSaleProductQuantity(rows, kit, "2");
assert.equal(rows.length, 2);

// Quantity edits must preserve the price already stored on the sale row.
rows = rows.map((row) => row.code === kimono.codigo ? { ...row, price: 170, valueUm: 1 } : row);
const kitRow = rows[1];
rows = setSaleProductQuantity(rows, kimono, "3");
assert.equal(rows.length, 2);
assert.equal(rows[0].quantity, 3);
assert.equal(rows[0].price, 170);
assert.equal(rows[0].valueUm, 1);
assert.equal(rows[1], kitRow);
assert.equal(rows.reduce((total, row) => total + row.quantity * row.price, 0), 760);

for (const invalid of ["-1", "NaN", "Infinity", Number.NaN, "0.5", "1.5", "1,5", 2.25, Number.MAX_SAFE_INTEGER + 1]) {
  assert.equal(setSaleProductQuantity(rows, kimono, invalid), rows);
  const empty = [];
  assert.equal(setSaleProductQuantity(empty, kimono, invalid), empty);
}
assert.equal(setSaleProductQuantity(rows, kimono, "3"), rows);
rows = setSaleProductQuantity(rows, kimono, "12");
assert.equal(rows[0].quantity, 12);
assert.equal(rows[0].price, 170);
assert.equal(rows.reduce((total, row) => total + row.quantity * row.price, 0), 2290);
rows = setSaleProductQuantity(rows, kimono, "0");
assert.deepEqual(rows.map((row) => row.code), [kit.codigo]);
rows = setSaleProductQuantity(rows, kit, "");
assert.equal(rows.length, 0);
assert.equal(productToRow(kimono, 2, false).matched, false);

// Exercise the detail's real change/blur callbacks without an API or a saved sale.
const page = ts.createSourceFile("capture.tsx", readFileSync(new URL("../src/features/sales/pages/HtmlCaptureSalePage.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let quantityInput;
const handlers = [];
function visit(node) {
  if (ts.isVariableDeclaration(node) && ["handleRowQuantityChange", "handleRemoveRow"].includes(node.name.getText(page))) {
    handlers.push(`const ${node.getText(page)};`);
  }
  if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(page) === "NavigableNumberInput" && node.getText(page).includes("row.code")) quantityInput = node.getText(page);
  ts.forEachChild(node, visit);
}
visit(page);
assert.ok(quantityInput);
const detailCode = ts.transpileModule(`${handlers.join("\n")}\nrenderInput = (row) => (${quantityInput});`, {
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
}).outputText;
for (const listaProductosTabla of [false, true]) {
  const state = {
    React: { createElement }, NavigableNumberInput: "input", listaProductosTabla,
    isReadOnly: false, isCapturedSale: false, isSaving: false,
    rows: [productToRow(kimono, 2), productToRow(kit, 1)],
    setRows(update) { this.rows = update(this.rows); },
    setLastTicket() {}, clearManualSaleDraft() {}, handleNumberInputKeyDown() {},
  };
  state.setRows = state.setRows.bind(state);
  runInNewContext(detailCode, state);
  for (const value of ["", "0", "3"]) {
    state.renderInput(state.rows[0]).props.onChange(value);
    const input = state.renderInput(state.rows[0]);
    assert.equal(String(input.props.value), value);
    input.props.onBlur?.();
    assert.equal(state.rows.length, 2, `Salir de cantidad '${value}' debe conservar el producto (tabla=${listaProductosTabla}).`);
    assert.equal(state.rows[0].code, kimono.codigo);
    assert.equal(state.rows[0].price, 168);
    assert.equal(state.rows[1].quantity, 1);
  }
}
console.log("OK: vaciar, salir del campo y volver a escribir conserva el detalle en ambos modos.");
console.log("OK: cantidades enteras, rechazo de decimales, selección, eliminación, precios existentes y totales.");
