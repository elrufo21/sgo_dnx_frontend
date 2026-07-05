import type { ServiceInvoiceListItem } from "@/types/serviceInvoice";

const safeText = (value: unknown, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDateISO = (value: unknown) => {
  const text = safeText(value);
  if (!text) return "";
  const normalized = text.replace("T", " ").split(" ")[0];

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  const [day, month, year] = normalized.split("/");
  if (day && month && year) return `${year}-${month}-${day}`;

  return "";
};

const splitDocumentNumber = (
  value: string,
  serie?: string,
  numero?: string,
) => {
  const normalized = safeText(value);
  if (normalized.includes("-")) return normalized;

  const resolvedSerie = safeText(serie, "FN01");
  const resolvedNumber = safeText(numero, normalized || "00000000");

  return `${resolvedSerie}-${resolvedNumber}`;
};

const resolveLineImporte = (detail: ServiceInvoiceListItem["detalles"][number]) => {
  const explicit = safeNumber(detail.importe);
  if (explicit > 0) return explicit;

  return safeNumber(detail.detalleCant) * safeNumber(detail.detallePrecio);
};

const resolveSubtotal = (invoice: ServiceInvoiceListItem) => {
  const compraSubtotal = safeNumber(invoice.compra.subTotal);
  if (compraSubtotal > 0) return compraSubtotal;

  const compraIgv = safeNumber(invoice.compra.igv);
  const compraTotal = safeNumber(invoice.compra.total);

  if (compraTotal > 0 && compraIgv > 0) return compraTotal - compraIgv;

  const detailsSubtotal = invoice.detalles.reduce(
    (sum, detail) => sum + resolveLineImporte(detail),
    0,
  );

  return detailsSubtotal > 0 ? detailsSubtotal : compraTotal / 1.18;
};

const resolveIgv = (invoice: ServiceInvoiceListItem, subtotal: number) => {
  const compraIgv = safeNumber(invoice.compra.igv);
  if (compraIgv > 0) return compraIgv;

  const compraTotal = safeNumber(invoice.compra.total);
  return Math.max(0, compraTotal - subtotal);
};

const resolveInvoiceDocumentNumber = (invoice: ServiceInvoiceListItem) =>
  splitDocumentNumber(
    safeText(invoice.compra.nroComprobante),
    invoice.compra.serie,
    invoice.compra.numero,
  );

const resolveDebitNoteDocumentNumber = (invoice: ServiceInvoiceListItem) =>
  safeText(
    invoice.compra.anuladoPorNroComprobante,
    safeText(invoice.compra.anuladoPorDocuNumero),
  ) || resolveInvoiceDocumentNumber(invoice);

export const buildDebitNoteQrData = (
  invoice: ServiceInvoiceListItem,
  company?: { ruc?: string } | null,
) => {
  const compra = invoice.compra;
  const subtotal = resolveSubtotal(invoice);
  const igv = resolveIgv(invoice, subtotal);
  const total = safeNumber(compra.total) || subtotal + igv;
  const clientRuc = safeText(compra.clienteRuc, safeText(compra.clienteDni));

  return [
    safeText(company?.ruc, "10464869978"),
    "08",
    resolveDebitNoteDocumentNumber(invoice),
    igv.toFixed(2),
    total.toFixed(2),
    formatDateISO(compra.fechaEmision),
    "06",
    clientRuc || "00000000000",
  ].join("|");
};
