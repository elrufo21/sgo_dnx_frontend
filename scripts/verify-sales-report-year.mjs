import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import ts from "typescript";

// Run the real page and query cache with deferred local responses; no API or SQL.
const source = readFileSync(new URL("../src/features/reports/pages/SalesReportPage.tsx", import.meta.url), "utf8");
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const currentYear = new Date().getFullYear();
const state = [];
const requests = [];
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, cacheTime: Infinity } },
  logger: { log() {}, warn() {}, error() {} },
});
let observer;
let queryOptions;
let stateIndex;
const module = { exports: {} };
runInNewContext(code, {
  module, exports: module.exports, Intl, Date,
  require(name) {
    if (name === "react/jsx-runtime") return jsxRuntime;
    if (name === "react") return { useState: (initialValue) => {
      const index = stateIndex++;
      if (!(index in state)) state[index] = initialValue;
      return [state[index], (value) => { state[index] = value; }];
    } };
    if (name === "@tanstack/react-query") return { useQuery: (options) => {
      queryOptions = options;
      if (!observer) {
        observer = new QueryObserver(client, options);
        observer.subscribe(() => {});
      } else observer.setOptions(options);
      return observer.getCurrentResult();
    } };
    if (name === "@/config") return { buildApiUrl: (path) => `http://fixture${path}` };
    if (name === "@/shared/helpers/apiRequest") return {
      apiRequest: ({ url }) => new Promise((resolve, reject) => requests.push({ url, resolve, reject })),
    };
    const component = name.split("/").at(-1);
    return { default: component, [component]: component, Search: "Search" };
  },
});
function render() {
  stateIndex = 0;
  const elements = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visit);
    elements.push(node);
    visit(node.props?.children);
  }
  visit(module.exports.default());
  return elements;
}
const has = (elements, type) => elements.some((element) => element.type === type);
const totalLabel = (elements) => elements.find((element) => element.props?.children?.[0] === "Total ");
const setYear = (year) => {
  render().find((element) => element.type === "TextField").props.onChange({ target: { value: String(year) } });
  return render();
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
const data = (year) => ({ year, total: year, months: [{ month: 1, monthName: "Enero", total: year }] });
function assertEmpty(elements) {
  assert.equal(has(elements, "BarChart") || has(elements, "LineChart"), false, "No mostrar gráfica anterior.");
  assert.equal(totalLabel(elements), undefined, "No mostrar total anterior.");
}

render();
assert.equal(requests.length, 1);
for (const year of ["202", "", "20", "1752", String(currentYear + 1)]) {
  const before = requests.length;
  setYear(year);
  for (const chartType of ["bar", "line"]) {
    render().find((element) => element.type === "ToggleButtonGroup").props.onChange(null, chartType);
    const elements = render();
    assertEmpty(elements);
    assert.equal(queryOptions.enabled, false);
    assert.equal(has(elements, "CircularProgress") || has(elements, "Alert"), false);
  }
  assert.equal(requests.length, before, "Un año inválido no debe consultar.");
}
requests[0].resolve(data(currentYear));
await tick();
assertEmpty(render());

const olderYear = currentYear - 2;
setYear(olderYear);
assert.equal(requests.length, 2, "Completar el año debe consultar sin lupa ni Enter.");
assert.ok(requests[1].url.endsWith(`year=${olderYear}`));
assertEmpty(render());
const latestYear = currentYear - 1;
setYear(latestYear);
assert.equal(requests.length, 3);
assert.ok(requests[2].url.endsWith(`year=${latestYear}`));
requests[2].resolve(data(latestYear));
await tick();
assert.ok(has(render(), "LineChart"));
assert.equal(totalLabel(render()).props.children[1], latestYear);
requests[1].resolve(data(olderYear));
await tick();
assert.equal(totalLabel(render()).props.children[1], latestYear, "Una respuesta tardía no debe reemplazar el año actual.");

// The search button/Enter must still refresh a year already displayed.
render().find((element) => element.type === "form").props.onSubmit({ preventDefault() {} });
assert.equal(requests.length, 4);
requests[3].resolve(data(latestYear));
await tick();

setYear(currentYear - 3);
requests[4].resolve(data(latestYear));
await tick();
assertEmpty(render());
assert.ok(has(render(), "Alert"), "Rechazar una respuesta cuyo año no coincide con el solicitado.");
assertEmpty(setYear("202"));
assert.equal(has(render(), "Alert"), false, "Limpiar el error al dejar el año incompleto.");

observer.destroy();
client.clear();
console.log("OK: consulta automática por año completo, limpieza de años inválidos, respuestas tardías, validación del año recibido y actualización con lupa/Enter.");
