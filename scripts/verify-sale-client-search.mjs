import assert from "node:assert/strict";
import { indexSaleClients, searchSaleClients } from "../src/app/sales/helpers/saleClientSearch.ts";

const makeClient = (id, label, code, ruc = "", dni = "") => ({
  id, nombreRazon: label, clienteCodigo: code, ruc, dni,
});
const clients = Array.from({ length: 2500 }, (_, i) =>
  makeClient(i + 1, "Cliente de prueba " + i, "TEST-" + i),
);
const exact = makeClient(2501, "María del Águila", "TEST", "20600000001", "77777777");
const duplicateA = makeClient(2502, "Cliente A", "A", "20600000002");
const duplicateB = makeClient(2503, "Cliente B", "B", "20600000002");
const lateExact = makeClient(2504, "Cliente Zeta", "000991", "20600000009");
const placeholder = makeClient(2505, "Varios", "VARIOS", "00000000001");
const codeMatchingRuc = makeClient(2506, "Código numérico", "20600000001");
const index = indexSaleClients([...clients, exact, duplicateA, duplicateB, lateExact, placeholder, codeMatchingRuc]);

assert.equal(searchSaleClients(index, "name", "").length, 15);
assert.equal(searchSaleClients(index, "name", "cliente de prueba").length, 15);
assert.equal(searchSaleClients(index, "code", "test")[0].client.id, exact.id);
assert.equal(searchSaleClients(index, "code", "000991")[0].client.id, lateExact.id);
assert.deepEqual(searchSaleClients(index, "code", "20600000009"), []);
assert.deepEqual(searchSaleClients(index, "code", "77777777"), []);
assert.deepEqual(searchSaleClients(index, "code", "20600000001").map(({ client }) => client.id), [codeMatchingRuc.id]);
assert.equal(searchSaleClients(index, "ruc", "20600000001")[0].client.id, exact.id);
assert.equal(searchSaleClients(index, "name", "aguila maria")[0].client.id, exact.id);
assert.deepEqual(searchSaleClients(index, "ruc", "77777777"), []);
assert.deepEqual(searchSaleClients(index, "ruc", "20600000002"), []);
assert.deepEqual(index.byRuc.get("20600000002"), [duplicateA, duplicateB]);
assert.deepEqual(searchSaleClients(index, "ruc", "00000000001"), []);
assert.equal(searchSaleClients(index, "ruc", "20600000009")[0].client.id, lateExact.id);

const updated = indexSaleClients([...clients, { ...exact, nombreRazon: "Cliente actualizado" }]);
assert.equal(searchSaleClients(updated, "name", "aguila").length, 0);
assert.equal(searchSaleClients(updated, "name", "actualizado")[0].client.id, exact.id);
console.log("OK: límite, orden, acentos, catálogo actualizado y RUC exclusivo sin duplicados.");
