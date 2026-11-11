// tmp/factura-servicio-verificacion.tsx
import { pdf } from "@react-pdf/renderer";
import { writeFile } from "node:fs/promises";

// src/features/serviceInvoices/components/ServiceInvoicePdf.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image
} from "@react-pdf/renderer";
import { useEffect, useState } from "react";

// src/components/ticketQr.ts
import QRCode from "qrcode";

// src/shared/helpers/numberToWords.ts
var UNITS = [
  "",
  "UNO",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE"
];
var TENS = [
  "",
  "DIEZ",
  "VEINTE",
  "TREINTA",
  "CUARENTA",
  "CINCUENTA",
  "SESENTA",
  "SETENTA",
  "OCHENTA",
  "NOVENTA"
];
var SPECIALS = {
  10: "DIEZ",
  11: "ONCE",
  12: "DOCE",
  13: "TRECE",
  14: "CATORCE",
  15: "QUINCE",
  20: "VEINTE"
};
var HUNDREDS = [
  "",
  "CIENTO",
  "DOSCIENTOS",
  "TRESCIENTOS",
  "CUATROCIENTOS",
  "QUINIENTOS",
  "SEISCIENTOS",
  "SETECIENTOS",
  "OCHOCIENTOS",
  "NOVECIENTOS"
];
var threeDigitsToWords = (n) => {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor(n % 100 / 10);
  const units = n % 10;
  const hundredPart = HUNDREDS[hundreds];
  const twoDigit = n % 100;
  if (SPECIALS[twoDigit]) {
    return [hundredPart, SPECIALS[twoDigit]].filter(Boolean).join(" ").trim();
  }
  const tensPart = TENS[tens];
  const unitPart = units === 1 && tens === 0 ? "UNO" : UNITS[units];
  if (!tensPart) {
    return [hundredPart, unitPart].filter(Boolean).join(" ").trim();
  }
  if (tens === 2 && units > 0) {
    return [hundredPart, `VEINTI${unitPart.toLowerCase()}`].filter(Boolean).join(" ").trim().toUpperCase();
  }
  const tensUnits = units > 0 ? `${tensPart} Y ${unitPart}` : `${tensPart}`.trim();
  return [hundredPart, tensUnits].filter(Boolean).join(" ").trim();
};
var numberToWords = (amount, currencyLabel = "SOLES") => {
  if (Number.isNaN(amount)) return "";
  const value = Math.max(0, Math.floor(amount * 100)) / 100;
  const integerPart = Math.floor(value);
  const cents = Math.round((value - integerPart) * 100).toString().padStart(2, "0");
  if (integerPart === 0) {
    return `CERO CON ${cents}/100 ${currencyLabel}`;
  }
  const millions = Math.floor(integerPart / 1e6);
  const thousands = Math.floor(integerPart % 1e6 / 1e3);
  const hundreds = integerPart % 1e3;
  const parts = [];
  if (millions > 0) {
    parts.push(
      millions === 1 ? "UN MILLON" : `${threeDigitsToWords(millions)} MILLONES`
    );
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? "MIL" : `${threeDigitsToWords(thousands)} MIL`);
  }
  if (hundreds > 0) {
    parts.push(threeDigitsToWords(hundreds));
  }
  return `${parts.join(" ").trim()} CON ${cents}/100 ${currencyLabel}`.toUpperCase();
};

// src/features/serviceInvoices/components/ServiceInvoicePdf.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var PAGE_WIDTH = 595.28;
var PAGE_HEIGHT = 841.89;
var safeText = (value, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};
var safeNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
var money = (value) => new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
}).format(safeNumber(value));
var formatDate = (value) => {
  const text = safeText(value);
  if (!text) return "";
  const normalized = text.includes("T") ? text.split("T")[0] : text;
  const [year, month, day] = normalized.split("-");
  if (!year || !month || !day) return text;
  return `${day}/${month}/${year}`;
};
var formatDateISO = (value) => {
  const text = safeText(value);
  if (!text) return "";
  const normalized = text.replace("T", " ").split(" ")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const [day, month, year] = normalized.split("/");
  if (day && month && year) return `${year}-${month}-${day}`;
  return "";
};
var formatDateTime = (value, fallbackDate) => {
  const text = safeText(value);
  if (!text) return formatDate(fallbackDate);
  const [datePart, timePart = ""] = text.replace("T", " ").split(" ");
  const date = formatDate(datePart);
  const time = timePart.split(".")[0];
  return [date, time].filter(Boolean).join(" ");
};
var isValidImageDataUrl = (value) => /^data:image\/(?:png|jpeg|jpg);base64,[a-z0-9+/]+=*$/i.test(
  safeText(value)
);
var splitDocumentNumber = (value, serie, numero) => {
  const normalized = safeText(value);
  if (normalized.includes("-")) return normalized;
  const resolvedSerie = safeText(serie, "FA01");
  const resolvedNumber = safeText(numero, normalized || "00000000");
  return `${resolvedSerie}-${resolvedNumber}`;
};
var resolveLineImporte = (detail) => {
  const explicit = safeNumber(detail.importe);
  if (explicit > 0) return explicit;
  return safeNumber(detail.detalleCant) * safeNumber(detail.detallePrecio);
};
var resolveSubtotal = (invoice2) => {
  const compraSubtotal = safeNumber(invoice2.compra.subTotal);
  if (compraSubtotal > 0) return compraSubtotal;
  const compraIgv = safeNumber(invoice2.compra.igv);
  const compraTotal = safeNumber(invoice2.compra.total);
  if (compraTotal > 0 && compraIgv > 0) return compraTotal - compraIgv;
  const detailsSubtotal = invoice2.detalles.reduce(
    (sum, detail) => sum + resolveLineImporte(detail),
    0
  );
  return detailsSubtotal > 0 ? detailsSubtotal : compraTotal / 1.18;
};
var resolveIgv = (invoice2, subtotal) => {
  const compraIgv = safeNumber(invoice2.compra.igv);
  if (compraIgv > 0) return compraIgv;
  const compraTotal = safeNumber(invoice2.compra.total);
  return Math.max(0, compraTotal - subtotal);
};
var resolveDueDate = (invoice2) => {
  const compra = invoice2.compra;
  const explicitDueDate = safeText(compra.fechaVto) || safeText(compra.fechaVencimiento) || safeText(compra.fechaVenc);
  if (explicitDueDate) return explicitDueDate;
  const fechaEmision = formatDateISO(compra.fechaEmision);
  const esContado = safeText(compra.condicion, compra.formaPago).toUpperCase().includes("CONTADO");
  if (fechaEmision && esContado) return fechaEmision;
  if (fechaEmision) {
    const [year, month] = fechaEmision.split("-");
    return `${year}-${month}-24`;
  }
  return "";
};
var styles = StyleSheet.create({
  page: {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    backgroundColor: "#ffffff",
    padding: 12,
    fontFamily: "Helvetica",
    fontSize: 6.5,
    color: "#000000"
  },
  frame: {
    width: "100%",
    height: "100%",
    padding: 12
  },
  row: {
    flexDirection: "row"
  },
  center: {
    alignItems: "center",
    justifyContent: "center"
  },
  top: {
    height: 110,
    flexDirection: "row",
    alignItems: "flex-start"
  },
  logoArea: {
    width: 102,
    height: 82,
    paddingTop: 10
  },
  logoText: {
    marginTop: -2,
    fontSize: 18,
    color: "#223575",
    fontWeight: "bold",
    letterSpacing: 4
  },
  titleArea: {
    flex: 1,
    paddingTop: 50,
    alignItems: "center"
  },
  title: {
    fontSize: 13,
    fontWeight: "bold"
  },
  subtitle: {
    marginTop: 2,
    fontSize: 6.3,
    fontWeight: "bold"
  },
  address: {
    marginTop: 3,
    fontSize: 6.1,
    fontWeight: "bold"
  },
  documentBox: {
    width: 155,
    height: 96,
    borderWidth: 1.4,
    borderColor: "#000000",
    marginLeft: 12,
    marginTop: 15,
    alignItems: "center",
    justifyContent: "center"
  },
  documentText: {
    fontSize: 8,
    lineHeight: 1.15,
    textAlign: "center"
  },
  documentType: {
    fontSize: 9,
    textAlign: "center"
  },
  documentNumber: {
    fontSize: 7.5,
    textAlign: "center"
  },
  clientBox: {
    height: 36,
    borderWidth: 1.4,
    borderColor: "#000000",
    flexDirection: "row",
    marginTop: 6
  },
  clientLeft: {
    flex: 1,
    paddingHorizontal: 4,
    paddingTop: 3
  },
  clientRight: {
    width: 200,
    borderLeftWidth: 1.4,
    borderColor: "#000000",
    paddingHorizontal: 5,
    paddingTop: 3
  },
  smallLine: {
    fontSize: 8,
    lineHeight: 1.16
  },
  bold: {
    fontWeight: "bold"
  },
  termsBox: {
    height: 44,
    borderLeftWidth: 1.4,
    borderRightWidth: 1.4,
    borderTopWidth: 1.4,
    borderBottomWidth: 1.4,
    borderColor: "#000000",
    marginTop: 6
  },
  termsCell: {
    height: 21.3,
    borderRightWidth: 1.4,
    borderColor: "#000000",
    paddingHorizontal: 8,
    justifyContent: "center"
  },
  termsHeaderRow: {
    height: 21.3,
    flexDirection: "row",
    borderBottomWidth: 1.4,
    borderColor: "#000000"
  },
  termsValueRow: {
    height: 21.3,
    flexDirection: "row"
  },
  termsHeaderText: {
    fontSize: 6.2,
    fontWeight: "bold"
  },
  termsValue: {
    fontSize: 7
  },
  itemsTable: {
    height: 482,
    borderLeftWidth: 1.4,
    borderRightWidth: 1.4,
    borderTopWidth: 1.4,
    borderBottomWidth: 1.4,
    borderColor: "#000000",
    marginTop: 6
  },
  itemHeader: {
    height: 18,
    flexDirection: "row",
    borderBottomWidth: 1.4,
    borderColor: "#000000"
  },
  tableCol: {
    borderRightWidth: 1.4,
    borderColor: "#000000",
    paddingHorizontal: 3
  },
  tableColLast: {
    paddingHorizontal: 3
  },
  itemHeaderText: {
    fontSize: 5.8,
    fontWeight: "bold",
    textAlign: "center"
  },
  itemRow: {
    flex: 1,
    flexDirection: "row"
  },
  itemCell: {
    borderRightWidth: 1.4,
    borderColor: "#000000",
    paddingTop: 4,
    paddingHorizontal: 3
  },
  itemDescription: {
    fontSize: 6.3,
    lineHeight: 1.14
  },
  numeric: {
    textAlign: "right"
  },
  footer: {
    height: 118,
    flexDirection: "row",
    borderLeftWidth: 1.4,
    borderRightWidth: 1.4,
    borderBottomWidth: 1.4,
    borderColor: "#000000"
  },
  footerLeft: {
    flex: 1,
    padding: 7
  },
  footerRight: {
    width: 155,
    borderLeftWidth: 1.4,
    borderColor: "#000000",
    paddingTop: 9,
    paddingHorizontal: 4
  },
  son: {
    fontSize: 6,
    fontWeight: "bold",
    marginBottom: 13
  },
  qrRow: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  qrBox: {
    width: 64,
    height: 64,
    marginLeft: 10,
    marginRight: 9
  },
  legalText: {
    fontSize: 5.1,
    lineHeight: 1.18
  },
  thanks: {
    position: "absolute",
    left: 7,
    bottom: 5,
    fontSize: 5.2
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2.1
  },
  totalLabel: {
    fontSize: 7,
    fontWeight: "bold"
  },
  totalValue: {
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "right"
  }
});
function DxnLogo() {
  return /* @__PURE__ */ jsx(View, { style: [styles.logoArea, styles.center], children: /* @__PURE__ */ jsx(
    Image,
    {
      src: "/LogoDXN.png",
      style: {
        width: 86,
        height: 51,
        objectFit: "contain"
      }
    }
  ) });
}
function ServiceInvoicePdfDocument({
  invoice: invoice2,
  company,
  preGeneratedQrBase64,
  montoPendiente
}) {
  const compra = invoice2.compra;
  const subtotal = resolveSubtotal(invoice2);
  const igv = resolveIgv(invoice2, subtotal);
  const total2 = safeNumber(compra.total) || subtotal + igv;
  const documentNumber = splitDocumentNumber(
    safeText(compra.nroComprobante),
    compra.serie,
    compra.numero
  );
  const companyName = safeText(
    company?.name,
    safeText(company?.commercialName, "MI EMPRESA")
  ).toUpperCase();
  const companyRuc = safeText(company?.ruc, "-");
  const companyAddress = safeText(company?.address, "-");
  const companyPhone = safeText(company?.phone);
  const isServiceInvoice = montoPendiente != null;
  const isCredit = [compra.condicion, compra.formaPago].some(
    (value) => safeText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase() === "CREDITO"
  );
  const termsHeaders = isServiceInvoice ? [["Condicion", 86], ["Moneda", 70], ["N\xB0 Cuota", 76], ["Fec. Venc.", 86], ["Monto", 78], ["G.Remisi\xF3n", 1]] : [["Condicion", 68], ["Forma Pago", 76], ["Entidad Bancaria", 103], ["Moneda", 55], ["Nro Membresia", 88], ["Nro Transaccion", 100], ["G.Remisi\xF3n", 1]];
  const currency = safeText(compra.moneda, "SOLES").toUpperCase();
  const termsValues = isServiceInvoice ? [[safeText(compra.condicion, compra.formaPago).toUpperCase(), 86], [currency, 70], [isCredit ? "1" : "-", 76], [isCredit ? formatDate(resolveDueDate(invoice2)) : "-", 86], [isCredit ? money(montoPendiente) : "-", 78], ["", 1]] : [[safeText(compra.condicion, "CONTADO").toUpperCase(), 68], [safeText(compra.formaPago, "-").toUpperCase(), 76], [safeText(compra.entidadBancaria, "-"), 103], [currency, 55], [safeText(compra.codigoCliente), 88], [safeText(compra.notaTransaccion, safeText(compra.nroOperacion)), 100], ["", 1]];
  const isBoleta = safeText(compra.tipoCodigo) === "03" || safeText(compra.documento).toUpperCase().includes("BOLETA");
  const documentLabel = isBoleta ? "BOLETA" : "FACTURA";
  const clientDocument = isBoleta ? safeText(compra.clienteDni, safeText(compra.clienteRuc)) : safeText(compra.clienteRuc, safeText(compra.clienteDni));
  const amountWords = safeText(
    compra.letras,
    numberToWords(total2, "SOLES")
  ).toUpperCase();
  const details = invoice2.detalles.length ? invoice2.detalles : [
    {
      detalleCompraId: 1,
      compraId: compra.compraId,
      detalleDesc: safeText(compra.compraConcepto, "SERVICIO"),
      detalleCant: 1,
      detallePrecio: total2,
      importe: subtotal
    }
  ];
  const qrBase64 = isValidImageDataUrl(preGeneratedQrBase64) ? safeText(preGeneratedQrBase64) : "";
  return /* @__PURE__ */ jsx(Document, { children: /* @__PURE__ */ jsx(Page, { size: "A4", style: styles.page, children: /* @__PURE__ */ jsxs(View, { style: styles.frame, children: [
    /* @__PURE__ */ jsxs(View, { style: styles.top, children: [
      /* @__PURE__ */ jsx(DxnLogo, {}),
      /* @__PURE__ */ jsxs(View, { style: styles.titleArea, children: [
        /* @__PURE__ */ jsx(Text, { style: styles.title, children: isServiceInvoice ? safeText(company?.commercialName, companyName).toUpperCase() : safeText(company?.district) ? `DXN ${safeText(company?.district).toUpperCase()}` : companyName }),
        /* @__PURE__ */ jsxs(Text, { style: styles.subtitle, children: [
          "De: ",
          companyName
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: styles.address, children: [
          companyAddress,
          companyPhone ? ` Telef: ${companyPhone}` : ""
        ] })
      ] }),
      /* @__PURE__ */ jsxs(View, { style: styles.documentBox, children: [
        /* @__PURE__ */ jsxs(Text, { style: styles.documentText, children: [
          "RUC: ",
          companyRuc
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: styles.documentType, children: [
          documentLabel,
          " ELECTRONICA"
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: styles.documentNumber, children: [
          "Nro. ",
          documentNumber
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs(View, { style: styles.clientBox, children: [
      /* @__PURE__ */ jsxs(View, { style: styles.clientLeft, children: [
        /* @__PURE__ */ jsxs(Text, { style: styles.smallLine, children: [
          "Senor(es) : ",
          safeText(compra.clienteRazon, "CLIENTE")
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: styles.smallLine, children: [
          "Direccion : ",
          safeText(compra.direccionFiscal, "-")
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: styles.smallLine, children: [
          isBoleta ? "D.N.I." : "R.U.C.",
          "     ",
          " :",
          clientDocument
        ] })
      ] }),
      /* @__PURE__ */ jsx(View, { style: styles.clientRight, children: isServiceInvoice ? /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs(Text, { style: styles.smallLine, children: [
          "Fecha Emision: ",
          formatDate(compra.fechaEmision)
        ] }),
        isCredit && /* @__PURE__ */ jsx(Text, { style: styles.smallLine, children: "Cuotas: 1" }),
        /* @__PURE__ */ jsxs(Text, { style: styles.smallLine, children: [
          "M.Pen Pago : ",
          money(montoPendiente)
        ] })
      ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsxs(Text, { style: styles.smallLine, children: [
          "Fecha Emision: ",
          formatDateTime(compra.fechaRegistro)
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: styles.smallLine, children: [
          "Fecha Venc: ",
          formatDate(resolveDueDate(invoice2))
        ] }),
        /* @__PURE__ */ jsxs(Text, { style: styles.smallLine, children: [
          "Hora Emision: ",
          formatDateTime(compra.fechaRegistro).split(" ").slice(1).join(" ")
        ] })
      ] }) })
    ] }),
    /* @__PURE__ */ jsxs(View, { style: styles.termsBox, children: [
      /* @__PURE__ */ jsx(View, { style: styles.termsHeaderRow, children: termsHeaders.map(([label, width], index) => /* @__PURE__ */ jsx(
        View,
        {
          style: [
            styles.termsCell,
            {
              width: width === 1 ? void 0 : Number(width),
              flex: width === 1 ? 1 : void 0
            },
            ...index === termsHeaders.length - 1 ? [{ borderRightWidth: 0 }] : []
          ],
          children: /* @__PURE__ */ jsx(Text, { style: styles.termsHeaderText, children: label })
        },
        String(label)
      )) }),
      /* @__PURE__ */ jsx(View, { style: styles.termsValueRow, children: termsValues.map(([value, width], index) => /* @__PURE__ */ jsx(
        View,
        {
          style: [
            styles.termsCell,
            {
              width: width === 1 ? void 0 : Number(width),
              flex: width === 1 ? 1 : void 0
            },
            ...index === termsValues.length - 1 ? [{ borderRightWidth: 0 }] : []
          ],
          children: /* @__PURE__ */ jsx(Text, { style: styles.termsValue, children: value })
        },
        `${value}-${index}`
      )) })
    ] }),
    /* @__PURE__ */ jsxs(View, { style: styles.itemsTable, children: [
      /* @__PURE__ */ jsx(View, { style: styles.itemHeader, children: [
        ["N\xB0", 30],
        ["CODIGO", 66],
        ["DESCRIPCION", 217],
        ["P.UNIT", 52],
        ["CANT", 52],
        ["PV", 52],
        ["SV", 52],
        ["IMPORTE", 52]
      ].map(([label, width], index) => /* @__PURE__ */ jsx(
        View,
        {
          style: [
            styles.tableCol,
            { width: Number(width) },
            ...index === 7 ? [{ borderRightWidth: 0 }] : [],
            styles.center
          ],
          children: /* @__PURE__ */ jsx(Text, { style: styles.itemHeaderText, children: label })
        },
        label
      )) }),
      details.map((detail, detailIndex) => /* @__PURE__ */ jsx(
        View,
        {
          style: styles.itemRow,
          children: [
            ["no", 30],
            ["codigo", 66],
            ["descripcion", 217],
            ["punit", 52],
            ["cant", 52],
            ["pv", 52],
            ["sv", 52],
            ["importe", 52]
          ].map(([key, width], index) => {
            const content = key === "no" ? String(detailIndex + 1) : key === "codigo" ? safeText(
              detail.codigoProducto,
              safeText(detail.codigoSunat, "SERV001")
            ) : key === "descripcion" ? safeText(detail.detalleDesc, "SERVICIO").toUpperCase() : key === "punit" ? money(detail.detallePrecio) : key === "cant" ? safeNumber(detail.detalleCant).toFixed(2) : key === "pv" ? money(detail.pv) : key === "sv" ? money(detail.sv) : money(resolveLineImporte(detail));
            return /* @__PURE__ */ jsx(
              View,
              {
                style: [
                  styles.itemCell,
                  { width: Number(width) },
                  ...index === 7 ? [{ borderRightWidth: 0 }] : []
                ],
                children: /* @__PURE__ */ jsx(
                  Text,
                  {
                    style: [
                      key === "descripcion" ? styles.itemDescription : styles.smallLine,
                      ...["punit", "cant", "pv", "sv", "importe"].includes(
                        String(key)
                      ) ? [styles.numeric] : []
                    ],
                    children: content
                  }
                )
              },
              key
            );
          })
        },
        `${detail.detalleCompraId}-${detailIndex}`
      ))
    ] }),
    /* @__PURE__ */ jsxs(View, { style: styles.footer, children: [
      /* @__PURE__ */ jsxs(View, { style: styles.footerLeft, children: [
        /* @__PURE__ */ jsxs(Text, { style: styles.son, children: [
          "SON: ",
          amountWords
        ] }),
        /* @__PURE__ */ jsxs(View, { style: styles.qrRow, children: [
          /* @__PURE__ */ jsx(View, { style: styles.qrBox, children: qrBase64 && /* @__PURE__ */ jsx(Image, { src: qrBase64, style: { width: 64, height: 64 } }) }),
          /* @__PURE__ */ jsxs(View, { children: [
            /* @__PURE__ */ jsxs(Text, { style: styles.legalText, children: [
              "Representacion impresa de la ",
              documentLabel,
              " Electronica."
            ] }),
            /* @__PURE__ */ jsx(Text, { style: styles.legalText, children: "Autorizado mediante la resolucion de intendencia SUNAT/N\xB0 0180050003180" }),
            /* @__PURE__ */ jsxs(Text, { style: styles.legalText, children: [
              "HASH: ",
              safeText(compra.docuHash, "-")
            ] }),
            /* @__PURE__ */ jsx(Text, { style: styles.legalText, children: "Consulta tu Comprobante en: https://www.nubefact.com/buscar" }),
            /* @__PURE__ */ jsxs(Text, { style: styles.legalText, children: [
              "Nro Id: ",
              compra.compraId
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsx(Text, { style: styles.thanks, children: "Gracias por su preferencia lo esperamos pronto." })
      ] }),
      /* @__PURE__ */ jsx(View, { style: styles.footerRight, children: [
        ["SUBTOTAL", subtotal],
        ["DESCUENTO", 0],
        ["OP.GRATUITAS", 0],
        ["OP.GRAVADAS", subtotal],
        ["OP.EXONERADAS", 0],
        ["I.G.V. 18%", igv],
        ["ICBPER.", 0],
        ["TOTAL  S/.", total2]
      ].map(([label, value]) => /* @__PURE__ */ jsxs(View, { style: styles.totalRow, children: [
        /* @__PURE__ */ jsx(Text, { style: styles.totalLabel, children: label }),
        /* @__PURE__ */ jsx(Text, { style: styles.totalValue, children: money(value) })
      ] }, String(label))) })
    ] })
  ] }) }) });
}

// tmp/factura-servicio-verificacion.tsx
var total = 31011.34;
var invoice = { compra: { compraId: 1, tipoCodigo: "01", compraConcepto: "SERVICIO", serie: "FA02", numero: "00000001", nroComprobante: "FA02-00000001", fechaEmision: "2026-11-10", fechaRegistro: "2026-11-10 10:00:00", condicion: "CREDITO", total, subTotal: 26280.8, igv: 4730.54 }, detalles: [{ detalleCompraId: 1, compraId: 1, detalleDesc: "SERVICIO", detalleCant: 1, detallePrecio: total, importe: total }] };
var blob = await pdf(ServiceInvoicePdfDocument({ invoice, company: { name: "EMPRESA", ruc: "00000000000" }, montoPendiente: total - Math.round(total * 0.1) })).toBlob();
await writeFile("tmp/pdfs/factura-servicio-verificacion.pdf", Buffer.from(await blob.arrayBuffer()));
