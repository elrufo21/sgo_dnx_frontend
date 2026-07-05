import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

import { useEffect, useState } from "react";
import { generateTicketQrBase64 } from "@/components/ticketQr";
import { numberToWords } from "@/shared/helpers/numberToWords";
import type {
  ServiceInvoiceListDetail,
  ServiceInvoiceListItem,
} from "@/types/serviceInvoice";
import { buildDebitNoteQrData } from "./debitNotePdfHelpers";

type DebitNotePdfProps = {
  invoice: ServiceInvoiceListItem;
  company?: {
    name?: string;
    commercialName?: string;
    ruc?: string;
    address?: string;
    phone?: string;
    email?: string;
  } | null;
  preGeneratedQrBase64?: string;
};

const safeText = (value: unknown, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: unknown) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeNumber(value));

const formatDate = (value: unknown) => {
  const text = safeText(value);
  if (!text) return "";
  const normalized = text.replace("T", " ").split(" ")[0];

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const [year, month, day] = normalized.split("-");
    return `${day}/${month}/${year}`;
  }

  return text;
};

const isValidImageDataUrl = (value: unknown) =>
  /^data:image\/(?:png|jpeg|jpg);base64,[a-z0-9+/]+=*$/i.test(
    safeText(value),
  );

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

const resolveLineImporte = (detail: ServiceInvoiceListDetail) => {
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

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 30,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  companyTitle: {
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 3,
  },
  companyText: {
    fontSize: 8,
    marginBottom: 2,
  },
  docBox: {
    width: 172,
    height: 72,
    borderWidth: 1,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  docLine: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 7,
  },
  docNumber: {
    fontSize: 11,
    fontWeight: "bold",
  },
  info: {
    marginTop: 28,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: 135,
    fontSize: 8,
  },
  value: {
    fontSize: 8,
  },
  table: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#000",
  },
  tableHeader: {
    flexDirection: "row",
    height: 17,
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  th: {
    fontSize: 8,
    textAlign: "center",
    paddingTop: 4,
    borderRightWidth: 1,
    borderColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
    minHeight: 28,
  },
  td: {
    fontSize: 7.2,
    padding: 3,
    borderRightWidth: 1,
    borderColor: "#000",
  },
  tdDesc: {
    fontSize: 7.2,
    lineHeight: 1.05,
    padding: 3,
    borderRightWidth: 1,
    borderColor: "#000",
  },
  right: {
    textAlign: "right",
  },
  son: {
    marginTop: 20,
    fontSize: 8,
  },
  separator: {
    marginTop: 12,
    borderTopWidth: 1,
    borderColor: "#555",
  },
  footer: {
    flexDirection: "row",
    marginTop: 8,
    alignItems: "flex-start",
  },
  footerLeft: {
    width: 218,
  },
  legal: {
    fontSize: 7,
    marginBottom: 7,
  },
  qr: {
    width: 82,
    height: 82,
  },
  qrBox: {
    width: 108,
    alignItems: "center",
    paddingTop: 4,
  },
  totals: {
    width: 154,
    marginTop: 6,
    marginLeft: 50,
  },
  totalRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  totalLabel: {
    width: 104,
    fontSize: 9,
    fontWeight: "bold",
  },
  totalCurrency: {
    width: 14,
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "left",
  },
  totalValue: {
    width: 36,
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "right",
  },
});

export default function DebitNotePdf({
  invoice,
  company,
  preGeneratedQrBase64,
}: DebitNotePdfProps) {
  const [generatedQrBase64, setGeneratedQrBase64] = useState("");
  const compra = invoice.compra;

  const subtotal = resolveSubtotal(invoice);
  const igv = resolveIgv(invoice, subtotal);
  const total = safeNumber(compra.total) || subtotal + igv;

  const companyName = safeText(
    company?.name,
    safeText(company?.commercialName, "CENTRO DE SERVICIO DXN PAUCARPATA"),
  ).toUpperCase();

  const companyRuc = safeText(company?.ruc, "10464869978");
  const companyAddress = safeText(company?.address, "");
  const companyPhone = safeText(company?.phone, "");

  const clientRuc = safeText(compra.clienteRuc, safeText(compra.clienteDni));

  const details =
    invoice.detalles.length > 0
      ? invoice.detalles
      : [
          {
            detalleCompraId: 1,
            compraId: compra.compraId,
            detalleDesc: safeText(compra.compraConcepto, "SERVICIO"),
            detalleCant: 1,
            detallePrecio: total,
            importe: total,
          } as ServiceInvoiceListDetail,
        ];

  const firstDetail = details[0];

  const amountWords = safeText(
    compra.letras,
    numberToWords(total, "SOLES"),
  ).toUpperCase();

  const compraExtra = compra as typeof compra & {
    documentoReferencia?: string;
    docReferencia?: string;
    nroDocumentoReferencia?: string;
    nroDocReferencia?: string;
    motivo?: string;
    observacion?: string;
    codTipoNota?: string;
    tipoNota?: string;
    docuHash?: string;
  };

  const annulmentDocuNumero = safeText(compraExtra.anuladoPorDocuNumero);
  const annulmentDocumentNumber = safeText(
    compraExtra.anuladoPorNroComprobante,
    annulmentDocuNumero,
  );

  const invoiceDocumentNumber = resolveInvoiceDocumentNumber(invoice);

  const documentNumber = annulmentDocumentNumber || invoiceDocumentNumber;

  const docReferencia = safeText(
    compraExtra.documentoReferencia,
    safeText(compraExtra.docReferencia, "FACTURA"),
  );

  const nroDocReferencia = invoiceDocumentNumber;

  const motivo = safeText(compraExtra.motivo, "ANULACION DE LA OPERACION");

  const codTipoNota = safeText(
    compraExtra.codTipoNota,
    safeText(compraExtra.tipoNota, "01"),
  );

  const observacion = safeText(
    compraExtra.observacion,
    "ANULACION DE TODA LA FACTURA",
  );

  const qrData = buildDebitNoteQrData(invoice, company);
  const qrBase64 = isValidImageDataUrl(preGeneratedQrBase64)
    ? safeText(preGeneratedQrBase64)
    : isValidImageDataUrl(generatedQrBase64)
      ? generatedQrBase64
      : "";

  useEffect(() => {
    if (isValidImageDataUrl(preGeneratedQrBase64)) return;

    let active = true;

    generateTicketQrBase64(qrData).then((url) => {
      if (active) setGeneratedQrBase64(url);
    });

    return () => {
      active = false;
    };
  }, [preGeneratedQrBase64, qrData]);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.companyTitle}>{companyName}</Text>

            <Text style={styles.companyText}>
              {companyAddress}
              {companyPhone ? ` Cel:${companyPhone}` : ""}
            </Text>
          </View>

          <View style={styles.docBox}>
            <Text style={styles.docLine}>RUC:{companyRuc}</Text>
            <Text style={styles.docLine}>NOTA DE CREDITO ELECTRÓNICA</Text>
            <Text style={styles.docNumber}>Nro. {documentNumber}</Text>
          </View>
        </View>

        <View style={styles.info}>
          {[
            ["Fecha de Emision:", formatDate(compra.fechaEmision)],
            ["Señor(es):", safeText(compra.clienteRazon, "CLIENTE")],
            ["R.U.C:", clientRuc],
            ["Direccion:", safeText(compra.direccionFiscal, "-")],
            ["Doc.Referencia:", docReferencia],
            ["N° Doc. Referencia:", nroDocReferencia],
            ["Motivo:", motivo],
            ["Cod.Tipo de Nota Cre.:", codTipoNota],
            ["Observacion:", observacion],
          ].map(([label, value]) => (
            <View style={styles.infoRow} key={label}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { width: 25 }]}>ITEM</Text>
            <Text style={[styles.th, { width: 55 }]}>CANTIDAD</Text>
            <Text style={[styles.th, { width: 38 }]}>UM</Text>
            <Text style={[styles.th, { width: 320 }]}>DESCRIPCION</Text>
            <Text style={[styles.th, { width: 65 }]}>P.UNIT.</Text>
            <Text style={[styles.th, { width: 65, borderRightWidth: 0 }]}>
              IMPORTE
            </Text>
          </View>

          <View style={styles.tableRow}>
            <Text style={[styles.td, styles.right, { width: 25 }]}>1</Text>

            <Text style={[styles.td, styles.right, { width: 55 }]}>
              {safeNumber(firstDetail.detalleCant).toFixed(2)}
            </Text>

            <Text style={[styles.td, { width: 38 }]}>
              {safeText(
                (firstDetail as ServiceInvoiceListDetail & { unidad?: string })
                  .unidad,
                "UNI",
              )}
            </Text>

            <Text style={[styles.tdDesc, { width: 320 }]}>
              {safeText(firstDetail.detalleDesc, "SERVICIO").toUpperCase()}
            </Text>

            <Text style={[styles.td, styles.right, { width: 65 }]}>
              {money(firstDetail.detallePrecio)}
            </Text>

            <Text
              style={[
                styles.td,
                styles.right,
                { width: 65, borderRightWidth: 0 },
              ]}
            >
              {money(firstDetail.detallePrecio)}
            </Text>
          </View>
        </View>

        <Text style={styles.son}>SON: {amountWords}</Text>

        <View style={styles.separator} />

        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <Text style={styles.legal}>
              Autorizado mediante la resolucion de intendencia
            </Text>
            <Text style={styles.legal}>SUNAT/N° 0180050003180</Text>
            <Text style={styles.legal}>
              Representacion impresa de la factura electronica
            </Text>
            <Text style={styles.legal}>
              HASH: {safeText(compraExtra.docuHash, "")}
            </Text>
            <Text style={styles.legal}>
              Consulta tu Comprobante en: -https://www.nubefact.com/buscar
            </Text>
            <Text style={styles.legal}>
              Email: {safeText(company?.email, "DXNPAUCARPATA@hotmail.com")}
            </Text>
            <Text style={styles.legal}>Nro Id: {compra.compraId}</Text>
          </View>

          <View style={styles.qrBox}>
            {qrBase64 && (
              <Image src={qrBase64} style={styles.qr} />
            )}
          </View>

          <View style={styles.totals}>
            {[
              ["OP.GRAVADAS", subtotal],
              ["DESCUENTOS", 0],
              ["OP.EXONERADAS", 0],
              ["SUB TOTAL", subtotal],
              ["I.G.V(18.00)%", igv],
              ["ICBPER", 0],
              ["TOTAL", total],
            ].map(([label, value]) => (
              <View style={styles.totalRow} key={String(label)}>
                <Text style={styles.totalLabel}>{label}</Text>
                <Text style={styles.totalCurrency}>S/</Text>
                <Text style={styles.totalValue}>{money(value)}</Text>
              </View>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}
