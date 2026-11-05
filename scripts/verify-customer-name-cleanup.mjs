import assert from "node:assert/strict";
import { cleanCustomerName } from "../src/shared/helpers/cleanCustomerName.ts";

assert.equal(cleanCustomerName("NORMA DORIS [EXP01-01-2013]"), "NORMA DORIS ");
assert.equal(cleanCustomerName("ADA EULOGIA ELLIS EXP01-01-2013"), "ADA EULOGIA ELLIS ");
assert.equal(cleanCustomerName("PEÑA, S.A. [exp30-12-2024] {CLIENTE}"), "PEÑA SA  CLIENTE");
assert.equal(cleanCustomerName("NIÑO & CÍA-1"), "NIÑO & CÍA-1");
assert.equal(cleanCustomerName("[EXP01-01-2013]"), "");
assert.equal(cleanCustomerName("[EXP1-1-2013]"), "EXP1-1-2013");
