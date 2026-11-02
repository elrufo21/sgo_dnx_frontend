import assert from "node:assert/strict";
import { formatDate, formatDateTime } from "../src/shared/helpers/formatDate.ts";

assert.equal(formatDate("2026-04-03"), "03/04/2026");
assert.equal(formatDate("03/04/2026"), "03/04/2026");
assert.equal(formatDate("31/02/2026"), "");
assert.equal(formatDateTime("03/04/2026 14:05"), "03/04/2026 14:05:00");
assert.equal(formatDateTime("31/02/2026 14:05:00"), "");
assert.equal(formatDateTime("2026-04-03 14:05:06.000"), "03/04/2026 14:05:06");
console.log("Formato de fechas verificado.");
