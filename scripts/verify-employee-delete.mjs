import { build } from "esbuild";
import { strict as assert } from "node:assert";
import { createRequire } from "node:module";

const mocks = {
  zustand: `export const create = (init) => { let state; const set = (update) => { state = { ...state, ...(typeof update === "function" ? update(state) : update) }; }; state = init(set); return { getState: () => state, setState: set }; };`,
  "@/shared/helpers/apiRequest": `export const apiRequest = async () => globalThis.__employeeDeleteResponse;`,
  "@/config": `export const buildApiUrl = (path) => path;`,
  "@/shared/queryClient": `export const queryClient = { invalidateQueries: async () => { globalThis.__employeeDeleteInvalidations++; if (globalThis.__employeeDeleteCacheError) throw new Error("cache"); } };`,
};

const output = await build({
  entryPoints: ["src/store/employees/employees.store.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  plugins: [{
    name: "mocks",
    setup(builder) {
      builder.onResolve({ filter: /^(zustand|@\/shared\/helpers\/apiRequest|@\/config|@\/shared\/queryClient)$/ }, (args) => ({ path: args.path, namespace: "mock" }));
      builder.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({ contents: mocks[args.path], loader: "js" }));
    },
  }],
});

const module = { exports: {} };
new Function("require", "module", "exports", output.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const store = module.exports.useEmployeesStore;
for (const [response, expected] of [[true, true], [false, false], [null, false], [undefined, false], [{ codigo: "ASISTENCIA_REQUERIDA" }, false], ["true", false], ["OK|1", true], ["ERROR|falló", false]]) {
  globalThis.__employeeDeleteResponse = response;
  globalThis.__employeeDeleteInvalidations = 0;
  store.setState({ employees: [{ personalId: 1 }, { personalId: 2 }] });
  assert.equal(await store.getState().deleteMaintenanceEmployee(1), expected);
  assert.equal(store.getState().employees.length, expected ? 1 : 2);
  assert.equal(globalThis.__employeeDeleteInvalidations, expected ? 1 : 0);
}
globalThis.__employeeDeleteResponse = true;
globalThis.__employeeDeleteCacheError = true;
store.setState({ employees: [{ personalId: 1 }] });
const originalConsoleError = console.error;
try {
  console.error = () => {};
  assert.equal(await store.getState().deleteMaintenanceEmployee(1), true);
  assert.equal(store.getState().employees.length, 0);
} finally {
  console.error = originalConsoleError;
  delete globalThis.__employeeDeleteCacheError;
}
console.log("Eliminación de personal: true, false, fallo y respuesta anterior verificados.");
