import assert from "node:assert/strict";
import JSZip from "jszip";
import {
  crearXmlGreRemitente,
  greXmlFileName,
  greZipFileName,
} from "../src/features/sales/components/greRemitenteXml.ts";

const xml = crearXmlGreRemitente({
  serie: "T001",
  number: "1",
  deliveryDate: "2026-09-05",
  emissionTime: "08:30",
  reason: "04",
  reasonDescription: "Traslado & prueba",
  recipient: "Empresa < destino",
  recipientDocument: "20123456789",
  departure: "Av. A",
  departureUbigeo: "120101",
  arrival: "Av. B",
  arrivalUbigeo: "120801",
  transportMode: "02",
  transshipment: "NO",
  m1Vehicle: "NO",
  vehiclePlate: "ABC-123",
  driverDocument: "12345678",
  grossWeight: "1.500",
  weightUnit: "KGM",
  items: [{ description: "Producto & caja", code: "P-1", sunatCode: "", gtin: "", quantity: "2", unit: "NIU" }],
}, { nombre: "Empresa & Cia", ruc: "20123456789" });

assert.ok(xml.includes("Producto &amp; caja"));
assert.ok(xml.includes("<cbc:DespatchAdviceTypeCode>09</cbc:DespatchAdviceTypeCode>"));
assert.equal(greXmlFileName("20123456789", "T001", "00000001"), "20123456789-09-T001-1.xml");
assert.equal(greZipFileName("20123456789", "T001", "00000001"), "20123456789-09-T001-1.zip");

const zip = new JSZip();
zip.file("20123456789-09-T001-1.xml", xml);
const generatedZip = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
const loadedZip = await JSZip.loadAsync(generatedZip);
assert.equal(await loadedZip.file("20123456789-09-T001-1.xml").async("string"), xml);
console.log("GRE XML check passed");
