import assert from "node:assert/strict";
import { hasPermission } from "../src/shared/security/permissions.ts";

const admin = { id: "42", isAdministrator: true, permissions: ["VENTAS.VER"] };
assert.equal(hasPermission(admin, "VENTAS.VER"), true);
assert.equal(hasPermission(admin, "CAJA.VER"), false);
assert.equal(hasPermission({ ...admin, isAdministrator: false }, "CAJA.VER"), false);
assert.equal(hasPermission({ ...admin, id: "identity-guid" }, "CAJA.VER"), true);
assert.equal(hasPermission(null, "VENTAS.VER"), false);
