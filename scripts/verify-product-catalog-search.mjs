import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { indexProductCatalog, searchProductCatalog } from "../src/features/sales/helpers/productCatalogSearch.ts";

const products = [
  { codigo: "25IAP027", nombre: "DXN KIMONO - TALLA M", estado: "ACTIVO" },
  { codigo: "PEKIT13", nombre: "KIT PRÉMIUM BUSINESS", estado: "ACTIVO" },
  { codigo: "OTRO", nombre: "NO DISPONIBLE", estado: "INACTIVO" },
];
const index = indexProductCatalog(products);
assert.deepEqual(index.products, products.slice(0, 2));
for (const empty of ["", "   ", "---"]) assert.equal(searchProductCatalog(index, empty), index.products);
assert.deepEqual(searchProductCatalog(index, "25iap027"), [products[0]]);
assert.deepEqual(searchProductCatalog(index, "kimono talla"), [products[0]]);
assert.deepEqual(searchProductCatalog(index, "business premium"), [products[1]]);
assert.deepEqual(searchProductCatalog(index, "PEKIT13 business"), [products[1]]);
assert.deepEqual(searchProductCatalog(index, "inexistente"), []);
assert.deepEqual(searchProductCatalog(indexProductCatalog([...products, { codigo: "NUEVO", nombre: "RECIÉN CREADO", estado: "ACTIVO" }]), "recien" ).map(p => p.codigo), ["NUEVO"]);

let reads = 0;
const counted = { get codigo() { reads++; return "COD1"; }, get nombre() { reads++; return "Producto"; }, estado: "ACTIVO" };
const countedIndex = indexProductCatalog([counted]);
const readsAfterIndexing = reads;
for (const query of ["cod", "producto", "COD1", "no existe", ""]) searchProductCatalog(countedIndex, query);
assert.equal(reads, readsAfterIndexing, "Las búsquedas deben reutilizar el texto normalizado del índice.");

// Compare against the existing DataTable code/name matching rules.
const normalize = value => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, " ").toLowerCase().trim();
const previousSearch = (data, query) => {
  const terms = normalize(query).split(" ").filter(Boolean);
  return terms.length ? data.filter(p => {
    const text = [p.codigo, p.nombre].map(normalize).filter(Boolean).join(" ");
    return terms.every(term => text.includes(term));
  }) : data;
};
const largeCatalog = Array.from({ length: 10000 }, (_, i) => ({ codigo: `DXN-${i}`, nombre: `PRODUCTO CAFÉ PRÉMIUM TALLA ${i % 5} PRESENTACIÓN COMERCIAL`, estado: "ACTIVO" }));
const queries = ["", "dxn", "dxn-9999", "cafe premium", "talla 3", "no existe"];
const largeIndex = indexProductCatalog(largeCatalog);
assert.equal(searchProductCatalog(largeIndex, "dxn"), largeIndex.products, "Si todos coinciden se conserva la referencia para reutilizar las filas de la tabla.");
for (const query of queries) assert.deepEqual(searchProductCatalog(largeIndex, query), previousSearch(largeCatalog, query));
const elapsed = fn => { const start = performance.now(); for (let i = 0; i < 5; i++) for (const query of queries) fn(query); return performance.now() - start; };
const before = elapsed(query => previousSearch(largeCatalog, query));
const after = elapsed(query => searchProductCatalog(largeIndex, query));
console.log(`OK: catálogo completo, filtros equivalentes, acentos, múltiples términos, exclusión de inactivos e índice reutilizado. 10.000 productos / 30 búsquedas: anterior ${before.toFixed(1)} ms, indexado ${after.toFixed(1)} ms (solo filtrado, sin render).`);
