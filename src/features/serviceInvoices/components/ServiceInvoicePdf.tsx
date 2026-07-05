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

type ServiceInvoicePdfProps = {
  invoice: ServiceInvoiceListItem;
  company?: {
    name?: string;
    commercialName?: string;
    ruc?: string;
    address?: string;
    phone?: string;
  } | null;
  preGeneratedQrBase64?: string;
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

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
  const normalized = text.includes("T") ? text.split("T")[0] : text;
  const [year, month, day] = normalized.split("-");
  if (!year || !month || !day) return text;
  return `${day}/${month}/${year}`;
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

const formatDateTime = (value: unknown, fallbackDate?: unknown) => {
  const text = safeText(value);
  if (!text) return formatDate(fallbackDate);

  const [datePart, timePart = ""] = text.replace("T", " ").split(" ");
  const date = formatDate(datePart);
  const time = timePart.split(".")[0];

  return [date, time].filter(Boolean).join(" ");
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
  const resolvedSerie = safeText(serie, "FA01");
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

const resolveDueDate = (invoice: ServiceInvoiceListItem) => {
  const compra = invoice.compra as typeof invoice.compra & {
    fechaVencimiento?: string;
    fechaVenc?: string;
  };

  const explicitDueDate =
    safeText(compra.fechaVto) ||
    safeText(compra.fechaVencimiento) ||
    safeText(compra.fechaVenc);

  if (explicitDueDate) return explicitDueDate;

  const fechaEmision = formatDateISO(compra.fechaEmision);

  if (fechaEmision) {
    const [year, month] = fechaEmision.split("-");
    return `${year}-${month}-24`;
  }

  return "";
};

const styles = StyleSheet.create({
  page: {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    backgroundColor: "#ffffff",
    padding: 12,
    fontFamily: "Helvetica",
    fontSize: 6.5,
    color: "#000000",
  },
  frame: {
    width: "100%",
    height: "100%",
    padding: 12,
  },
  row: {
    flexDirection: "row",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  top: {
    height: 110,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  logoArea: {
    width: 102,
    height: 82,
    paddingTop: 10,
  },
  logoText: {
    marginTop: -2,
    fontSize: 18,
    color: "#223575",
    fontWeight: "bold",
    letterSpacing: 4,
  },
  titleArea: {
    flex: 1,
    paddingTop: 50,
    alignItems: "center",
  },
  title: {
    fontSize: 13,
    fontWeight: "bold",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 6.3,
    fontWeight: "bold",
  },
  address: {
    marginTop: 3,
    fontSize: 6.1,
    fontWeight: "bold",
  },
  documentBox: {
    width: 155,
    height: 96,
    borderWidth: 1.4,
    borderColor: "#000000",
    marginLeft: 12,
    marginTop: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  documentText: {
    fontSize: 8,
    lineHeight: 1.15,
    textAlign: "center",
  },
  documentType: {
    fontSize: 9,
    textAlign: "center",
  },
  documentNumber: {
    fontSize: 7.5,
    textAlign: "center",
  },
  clientBox: {
    height: 36,
    borderWidth: 1.4,
    borderColor: "#000000",
    flexDirection: "row",
    marginTop: 6,
  },
  clientLeft: {
    flex: 1,
    paddingHorizontal: 4,
    paddingTop: 3,
  },
  clientRight: {
    width: 200,
    borderLeftWidth: 1.4,
    borderColor: "#000000",
    paddingHorizontal: 5,
    paddingTop: 3,
  },
  smallLine: {
    fontSize: 8,
    lineHeight: 1.16,
  },
  bold: {
    fontWeight: "bold",
  },
  termsBox: {
    height: 44,
    borderLeftWidth: 1.4,
    borderRightWidth: 1.4,
    borderTopWidth: 1.4,
    borderBottomWidth: 1.4,
    borderColor: "#000000",
    marginTop: 6,
  },
  termsCell: {
    height: 21.3,
    borderRightWidth: 1.4,
    borderColor: "#000000",
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  termsHeaderRow: {
    height: 21.3,
    flexDirection: "row",
    borderBottomWidth: 1.4,
    borderColor: "#000000",
  },
  termsValueRow: {
    height: 21.3,
    flexDirection: "row",
  },
  termsHeaderText: {
    fontSize: 6.2,
    fontWeight: "bold",
  },
  termsValue: {
    fontSize: 7,
  },
  itemsTable: {
    height: 482,
    borderLeftWidth: 1.4,
    borderRightWidth: 1.4,
    borderTopWidth: 1.4,
    borderBottomWidth: 1.4,
    borderColor: "#000000",
    marginTop: 6,
  },
  itemHeader: {
    height: 18,
    flexDirection: "row",
    borderBottomWidth: 1.4,
    borderColor: "#000000",
  },
  tableCol: {
    borderRightWidth: 1.4,
    borderColor: "#000000",
    paddingHorizontal: 3,
  },
  tableColLast: {
    paddingHorizontal: 3,
  },
  itemHeaderText: {
    fontSize: 5.8,
    fontWeight: "bold",
    textAlign: "center",
  },
  itemRow: {
    flex: 1,
    flexDirection: "row",
  },
  itemCell: {
    borderRightWidth: 1.4,
    borderColor: "#000000",
    paddingTop: 4,
    paddingHorizontal: 3,
  },
  itemDescription: {
    fontSize: 6.3,
    lineHeight: 1.14,
  },
  numeric: {
    textAlign: "right",
  },
  footer: {
    height: 118,
    flexDirection: "row",
    borderLeftWidth: 1.4,
    borderRightWidth: 1.4,
    borderBottomWidth: 1.4,
    borderColor: "#000000",
  },
  footerLeft: {
    flex: 1,
    padding: 7,
  },
  footerRight: {
    width: 155,
    borderLeftWidth: 1.4,
    borderColor: "#000000",
    paddingTop: 9,
    paddingHorizontal: 4,
  },
  son: {
    fontSize: 6,
    fontWeight: "bold",
    marginBottom: 13,
  },
  qrRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  qrBox: {
    width: 64,
    height: 64,
    marginLeft: 10,
    marginRight: 9,
  },
  legalText: {
    fontSize: 5.1,
    lineHeight: 1.18,
  },
  thanks: {
    position: "absolute",
    left: 7,
    bottom: 5,
    fontSize: 5.2,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2.1,
  },
  totalLabel: {
    fontSize: 7,
    fontWeight: "bold",
  },
  totalValue: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "right",
  },
});

function DxnLogo() {
  return (
    <View style={[styles.logoArea, styles.center]}>
      <Image
        src="/LogoManuel.png"
        style={{
          width: 86,
          height: 51,
          objectFit: "contain",
        }}
      />
    </View>
  );
}

export function ServiceInvoicePdfDocument({
  invoice,
  company,
  preGeneratedQrBase64,
}: ServiceInvoicePdfProps) {
  const compra = invoice.compra;
  const subtotal = resolveSubtotal(invoice);
  const igv = resolveIgv(invoice, subtotal);
  const total = safeNumber(compra.total) || subtotal + igv;
  const pendingAmount =
    compra.saldo === undefined || compra.saldo === null
      ? total
      : safeNumber(compra.saldo);
  const documentNumber = splitDocumentNumber(
    safeText(compra.nroComprobante),
    compra.serie,
    compra.numero,
  );
  const companyName = safeText(
    company?.name,
    safeText(company?.commercialName, "CENTRO DE SERVICIO DXN HUARAL"),
  ).toUpperCase();
  const companyRuc = safeText(company?.ruc, "15390049339");
  const companyAddress = safeText(
    company?.address,
    "CALLE LUIS COLAN NRO 456 Huaral-Huaral-Lima",
  );
  const companyPhone = safeText(company?.phone, "409-5092 /969-772-377");
  const clientRuc = safeText(compra.clienteRuc, safeText(compra.clienteDni));
  const amountWords = safeText(
    compra.letras,
    numberToWords(total, "SOLES"),
  ).toUpperCase();
  const details = invoice.detalles.length
    ? invoice.detalles
    : [
        {
          detalleCompraId: 1,
          compraId: compra.compraId,
          detalleDesc: safeText(compra.compraConcepto, "SERVICIO"),
          detalleCant: 1,
          detallePrecio: total,
          importe: subtotal,
        },
      ];

  const qrBase64 = isValidImageDataUrl(preGeneratedQrBase64)
    ? safeText(preGeneratedQrBase64)
    : "";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.frame}>
          <View style={styles.top}>
            <DxnLogo />
            <View style={styles.titleArea}>
              <Text style={styles.title}>{companyName}</Text>
              <Text style={styles.address}>
                {companyAddress} Telef: {companyPhone}
              </Text>
              <Text style={styles.address}>ICA ICA ICA</Text>
            </View>

            <View style={styles.documentBox}>
              <Text style={styles.documentText}>RUC: {companyRuc}</Text>
              <Text style={styles.documentType}>FACTURA ELECTRONICA</Text>
              <Text style={styles.documentNumber}>Nro. {documentNumber}</Text>
            </View>
          </View>

          <View style={styles.clientBox}>
            <View style={styles.clientLeft}>
              <Text style={styles.smallLine}>
                Senor(es) : {safeText(compra.clienteRazon, "CLIENTE")}
              </Text>
              <Text style={styles.smallLine}>
                Direccion : {safeText(compra.direccionFiscal, "-")}
              </Text>
              <Text style={styles.smallLine}>
                R.U.C.{"     "} :{clientRuc}
              </Text>
            </View>
            <View style={styles.clientRight}>
              <Text style={styles.smallLine}>
                Fecha Emision: {formatDateTime(compra.fechaRegistro)}
              </Text>
              <Text style={styles.smallLine}>Cuotas: 1</Text>
              <Text style={styles.smallLine}>
                M.Pen Pago : {money(pendingAmount)}
              </Text>
            </View>
          </View>

          <View style={styles.termsBox}>
            <View style={styles.termsHeaderRow}>
              {[
                ["Condicion", 86],
                ["Moneda", 70],
                ["N° Cuota", 76],
                ["Fec. Venc.", 86],
                ["Monto", 78],
                ["G.Remisión", 1],
              ].map(([label, width], index) => (
                <View
                  key={String(label)}
                  style={[
                    styles.termsCell,
                    {
                      width: width === 1 ? undefined : Number(width),
                      flex: width === 1 ? 1 : undefined,
                    },
                    ...(index === 6 ? [{ borderRightWidth: 0 }] : []),
                  ]}
                >
                  <Text style={styles.termsHeaderText}>{label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.termsValueRow}>
              {[
                [safeText(compra.formaPago, "CREDITO").toUpperCase(), 86],
                [
                  safeText(
                    (compra as typeof compra & { moneda?: string }).moneda,
                    "SOLES",
                  ).toUpperCase(),
                  70,
                ],
                ["1", 76],
                [formatDate(resolveDueDate(invoice)), 86],
                [money(pendingAmount), 78],
                ["", 1],
              ].map(([value, width], index) => (
                <View
                  key={`${value}-${index}`}
                  style={[
                    styles.termsCell,
                    {
                      width: width === 1 ? undefined : Number(width),
                      flex: width === 1 ? 1 : undefined,
                    },
                    ...(index === 6 ? [{ borderRightWidth: 0 }] : []),
                  ]}
                >
                  <Text style={styles.termsValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.itemsTable}>
            <View style={styles.itemHeader}>
              {[
                ["N°", 30],
                ["CODIGO", 66],
                ["DESCRIPCION", 217],
                ["P.UNIT", 52],
                ["CANT", 52],
                ["PV", 52],
                ["SV", 52],
                ["IMPORTE", 52],
              ].map(([label, width], index) => (
                <View
                  key={label}
                  style={[
                    styles.tableCol,
                    { width: Number(width) },
                    ...(index === 7 ? [{ borderRightWidth: 0 }] : []),
                    styles.center,
                  ]}
                >
                  <Text style={styles.itemHeaderText}>{label}</Text>
                </View>
              ))}
            </View>
            <View style={styles.itemRow}>
              {[
                ["no", 30],
                ["codigo", 66],
                ["descripcion", 217],
                ["punit", 52],
                ["cant", 52],
                ["pv", 52],
                ["sv", 52],
                ["importe", 52],
              ].map(([key, width], index) => {
                const first = details[0];
                const content =
                  key === "no"
                    ? "1"
                    : key === "codigo"
                      ? safeText(
                          first.codigoProducto,
                          safeText(first.codigoSunat, "SERV001"),
                        )
                      : key === "descripcion"
                        ? safeText(first.detalleDesc, "SERVICIO").toUpperCase()
                        : key === "punit"
                          ? money(first.detallePrecio)
                          : key === "cant"
                            ? safeNumber(first.detalleCant).toFixed(2)
                            : key === "pv"
                              ? "0.00"
                              : key === "sv"
                                ? "0.00"
                                : money(total);

                return (
                  <View
                    key={key}
                    style={[
                      styles.itemCell,
                      { width: Number(width) },
                      ...(index === 7 ? [{ borderRightWidth: 0 }] : []),
                    ]}
                  >
                    <Text
                      style={[
                        key === "descripcion"
                          ? styles.itemDescription
                          : styles.smallLine,
                        ...(["punit", "cant", "pv", "sv", "importe"].includes(
                          String(key),
                        )
                          ? [styles.numeric]
                          : []),
                      ]}
                    >
                      {content}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.footer}>
            <View style={styles.footerLeft}>
              <Text style={styles.son}>SON: {amountWords}</Text>
              <View style={styles.qrRow}>
                <View style={styles.qrBox}>
                  {qrBase64 && (
                    <Image src={qrBase64} style={{ width: 64, height: 64 }} />
                  )}
                </View>
                <View>
                  <Text style={styles.legalText}>
                    Autorizado mediante la resolucion de intendencia
                  </Text>
                  <Text style={styles.legalText}>SUNAT N° 0180050003180</Text>
                  <Text style={styles.legalText}>
                    Representacion impresa de la Factura Electronica.
                  </Text>
                  <Text style={styles.legalText}>
                    HASH: {safeText(compra.docuHash, "-")}
                  </Text>
                  <Text style={styles.legalText}>
                    Consulta tu Comprobante en: https://www.nubefact.com/buscar
                  </Text>
                  <Text style={styles.legalText}>
                    Email: 42772235m@gmail.com
                  </Text>
                  <Text style={styles.legalText}>
                    Nro Id: {compra.compraId}
                  </Text>
                </View>
              </View>
              <Text style={styles.thanks}>
                Gracias por su preferencia lo esperamos pronto.
              </Text>
            </View>
            <View style={styles.footerRight}>
              {[
                ["SUBTOTAL", subtotal],
                ["DESCUENTO", 0],
                ["OP.GRATUITAS", 0],
                ["OP.GRAVADAS", subtotal],
                ["OP.EXONERADAS", 0],
                ["I.G.V. 18%", igv],
                ["ICBPER.", 0],
                ["TOTAL  S/.", total],
              ].map(([label, value]) => (
                <View key={String(label)} style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{label}</Text>
                  <Text style={styles.totalValue}>{money(value)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export default function ServiceInvoicePdf(props: ServiceInvoicePdfProps) {
  const [generatedQrBase64, setGeneratedQrBase64] = useState("");
  const compra = props.invoice.compra;
  const subtotal = resolveSubtotal(props.invoice);
  const igv = resolveIgv(props.invoice, subtotal);
  const total = safeNumber(compra.total) || subtotal + igv;
  const documentNumber = splitDocumentNumber(
    safeText(compra.nroComprobante),
    compra.serie,
    compra.numero,
  );
  const companyRuc = safeText(props.company?.ruc, "15390049339");
  const clientRuc = safeText(compra.clienteRuc, safeText(compra.clienteDni));
  const qrData = [
    companyRuc,
    "01",
    documentNumber || "-",
    igv.toFixed(2),
    total.toFixed(2),
    formatDateISO(compra.fechaEmision),
    "06",
    clientRuc || "00000000000",
  ].join("|");

  useEffect(() => {
    if (props.preGeneratedQrBase64) return;

    let active = true;
    generateTicketQrBase64(qrData).then((url) => {
      if (active) setGeneratedQrBase64(url);
    });
    return () => {
      active = false;
    };
  }, [props.preGeneratedQrBase64, qrData]);

  return ServiceInvoicePdfDocument({
    ...props,
    preGeneratedQrBase64: props.preGeneratedQrBase64 || generatedQrBase64,
  });
}
