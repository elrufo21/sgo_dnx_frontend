import assert from "node:assert/strict";
import { productToRow, setSaleProductQuantity } from "../src/features/sales/helpers/saleRows.ts";

const kimono = { id: 27, codigo: "25IAP027", nombre: "DXN KIMONO", preVenta: 168, preCosto: 100, cantidad: 4, pv: 5, sv: 8 };
const kit = { ...kimono, id: 28, codigo: "PEKIT13", nombre: "KIT PREMIUM", preVenta: 125 };
let rows = setSaleProductQuantity([], kimono, "1");
assert.equal(rows.length, 1);
assert.equal(rows[0].quantity, 1);
assert.equal(rows[0].price, 168);
rows = setSaleProductQuantity(rows, kit, "2");
assert.equal(rows.length, 2);

// A detail price edit must survive subsequent quantity edits in Products.
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
console.log("OK: cantidades enteras, rechazo de decimales, selección, eliminación, precios editados y totales.");
