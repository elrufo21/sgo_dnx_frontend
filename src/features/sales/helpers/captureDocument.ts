export type CaptureDocumentType = "01" | "03" | "101";

const documentTypes: Record<string, CaptureDocumentType> = {
  BOLETA: "03",
  FACTURA: "01",
  "PROFORMA V": "101",
};

export const resolveCaptureDocumentType = (
  obsDocumentType: CaptureDocumentType,
  customerDefault?: unknown,
): CaptureDocumentType =>
  documentTypes[String(customerDefault ?? "").trim().toUpperCase()] ??
  obsDocumentType;
