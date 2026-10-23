import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const source = readFileSync(new URL("../src/App.css", import.meta.url), "utf8");
assert.match(source, /--breakpoint-desktop:\s*75rem\s*;/);
const assets = new URL("../dist/assets/", import.meta.url);
const css = readdirSync(assets).filter(name => name.endsWith(".css")).map(name => readFileSync(new URL(name, assets), "utf8")).join("\n");
assert.ok(/@media\s*\(\s*(?:width\s*>=\s*75rem|min-width\s*:\s*75rem)\s*\)/.test(css), "El build debe generar el umbral desktop de 1200 px.");
for (const rule of ["desktop\\:grid", "desktop\\:hidden", "desktop\\:flex-row"]) {
  assert.ok(css.includes(rule), `Falta la utilidad compilada ${rule}`);
}
const payment = readFileSync(new URL("../src/features/pos/pages/PaymentPage.tsx", import.meta.url), "utf8");
assert.ok(!payment.includes("1405px"), "Pago POS debe usar el mismo umbral desktop.");
assert.match(payment, /desktop:hidden/);
assert.match(payment, /desktop:grid/);
console.log("OK: breakpoint desktop 75rem compilado y vistas de Pago POS con umbral compartido. La revisión visual se documenta en docs/responsive-layout-analysis.md.");
