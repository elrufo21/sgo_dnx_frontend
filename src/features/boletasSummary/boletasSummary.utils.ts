import type { BoletaSummaryDocument } from "@/types/boletasSummary";

const amountCleaner = /[^\d,.-]/g;

const normalizeText = (value: unknown) => String(value ?? "").trim();

export const parseAmount = (value: unknown): number => {
  const raw = normalizeText(value);
  if (!raw) return 0;

  const normalized = raw.replace(amountCleaner, "");
  if (!normalized) return 0;

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  let sanitized = normalized;
  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    sanitized =
      lastComma > lastDot
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "");
  } else if (hasComma) {
    sanitized = normalized.replace(",", ".");
  }

  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const calculateBoletaTotals = (documents: BoletaSummaryDocument[]) => {
  const subTotal = documents.reduce(
    (acc, document) => acc + parseAmount(document.subTotal),
    0,
  );
  const igv = documents.reduce((acc, document) => acc + parseAmount(document.igv), 0);
  const icbper = documents.reduce(
    (acc, document) => acc + parseAmount(document.icbper),
    0,
  );
  const total = documents.reduce((acc, document) => acc + parseAmount(document.total), 0);

  return {
    count: documents.length,
    subTotal,
    igv,
    icbper,
    total,
    average: documents.length > 0 ? total / documents.length : 0,
  };
};

const csvHeaders = [
  "DocuId",
  "Documento",
  "Fecha Emision",
  "Serie-Numero",
  "Cliente",
  "Cliente DNI",
  "SubTotal",
  "IGV",
  "ICBPER",
  "Total",
  "Usuario",
  "Estado Sunat",
];

const escapeCsv = (value: unknown) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

export const buildBoletasCsv = (documents: BoletaSummaryDocument[]) => {
  const rows = documents.map((document) =>
    [
      document.docuId,
      document.docuDocumento,
      document.fechaEmision,
      document.serieNumero,
      document.cliente,
      document.clienteDni,
      document.subTotal,
      document.igv,
      document.icbper,
      document.total,
      document.usuario,
      document.estadoSunat,
    ]
      .map(escapeCsv)
      .join(","),
  );

  return `\uFEFF${[csvHeaders.map(escapeCsv).join(","), ...rows].join("\n")}`;
};
