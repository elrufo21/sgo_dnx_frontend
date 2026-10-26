import assert from "node:assert/strict";
import { getAutomaticPaymentBank } from "../src/shared/helpers/paymentBank.ts";

for (const method of ["YAPE", "YAPE/EFECTIVO", "TARJETA"]) {
  assert.equal(getAutomaticPaymentBank(method), "BCP");
}
for (const method of [
  "", "(SELECCIONE)", "-", "EFECTIVO", "DEPOSITO",
  "EFECTIVO/DEPOSITO", "YAPE/DEPOSITO",
  "TARJETA/EFECTIVO", "TARJETA/DEPOSITO",
]) {
  assert.equal(getAutomaticPaymentBank(method), null);
}
console.log("OK: YAPE, YAPE/EFECTIVO y TARJETA usan BCP; las demás formas conservan la selección de entidad existente.");
