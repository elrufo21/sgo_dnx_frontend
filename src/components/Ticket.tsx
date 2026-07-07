import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

import React, { useEffect, useMemo, useState } from "react";
import type { PosCartItem, PosTotals } from "@/types/pos";
import { generateTicketQrBase64 } from "@/components/ticketQr";

type TicketDocumentProps = {
  clientName?: string;
  clientId?: string;
  clientAddress?: string;
  docType?: "boleta" | "factura" | "proforma";
  paymentMethod?: string;
  items?: PosCartItem[];
  totals?: PosTotals;
  documentNumber?: string;
  noteId?: number | string | null;
  condition?: string;
  bankEntity?: string;
  operationNumber?: string;
  memberCode?: string;
  transactionNumber?: string;
  saleType?: string;
  companyName?: string;
  companyRuc?: string;
  companyAddress?: string;
  companyDistrict?: string;
  summary?: {
    operacionGravada?: number;
    descuento?: number;
    showDiscount?: boolean;
    subtotal?: number;
    igv?: number;
    total?: number;
    pvsTotalVenta?: number;
    pvsTotalMes?: number;
  };
  preGeneratedQrBase64?: string;
};

const AUTH_STORAGE_KEY = "sgo.auth.session";

const normalizePhoneLine = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const lowerRaw = raw.toLowerCase();
  const telefIndex = lowerRaw.indexOf("telef:");
  if (telefIndex >= 0) {
    return raw.slice(telefIndex).trim();
  }

  const telIndex = lowerRaw.indexOf("tel:");
  if (telIndex >= 0) {
    return raw.slice(telIndex).trim();
  }

  return raw;
};

const readCompanyPhoneFromStorage = (): string => {
  if (typeof window === "undefined") return "";

  try {
    const rawSession = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!rawSession) return "";

    const parsed = JSON.parse(rawSession) as {
      user?: { companyPhone?: unknown } | null;
      loginPayload?: { companiaTelefono?: unknown } | null;
    } | null;

    const rawPhone =
      parsed?.user?.companyPhone ?? parsed?.loginPayload?.companiaTelefono;
    return normalizePhoneLine(rawPhone);
  } catch {
    return "";
  }
};

const formatUnitPrefix = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const abbreviated = raw.slice(0, 3).toUpperCase();
  return `${abbreviated}. `;
};

const UNITS = [
  "",
  "UNO",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
];

const TENS = [
  "",
  "DIEZ",
  "VEINTE",
  "TREINTA",
  "CUARENTA",
  "CINCUENTA",
  "SESENTA",
  "SETENTA",
  "OCHENTA",
  "NOVENTA",
];

const SPECIALS: Record<number, string> = {
  10: "DIEZ",
  11: "ONCE",
  12: "DOCE",
  13: "TRECE",
  14: "CATORCE",
  15: "QUINCE",
  20: "VEINTE",
};

const HUNDREDS = [
  "",
  "CIENTO",
  "DOSCIENTOS",
  "TRESCIENTOS",
  "CUATROCIENTOS",
  "QUINIENTOS",
  "SEISCIENTOS",
  "SETECIENTOS",
  "OCHOCIENTOS",
  "NOVECIENTOS",
];

const threeDigitsToWords = (n: number) => {
  if (n === 0) return "";
  if (n === 100) return "CIEN";
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
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
    return [hundredPart, `VEINTI${unitPart.toLowerCase()}`]
      .filter(Boolean)
      .join(" ")
      .trim()
      .toUpperCase();
  }

  const tensUnits =
    units > 0 ? `${tensPart} Y ${unitPart}` : `${tensPart}`.trim();

  return [hundredPart, tensUnits].filter(Boolean).join(" ").trim();
};

const numberToWords = (amount: number, currencyLabel = "SOLES") => {
  if (Number.isNaN(amount)) return "";
  const value = Math.max(0, Math.floor(amount * 100)) / 100;
  const integerPart = Math.floor(value);
  const cents = Math.round((value - integerPart) * 100)
    .toString()
    .padStart(2, "0");

  if (integerPart === 0) {
    return `CERO CON ${cents}/100 ${currencyLabel}`;
  }

  const millions = Math.floor(integerPart / 1_000_000);
  const thousands = Math.floor((integerPart % 1_000_000) / 1_000);
  const hundreds = integerPart % 1_000;

  const parts: string[] = [];
  if (millions > 0) {
    parts.push(
      millions === 1 ? "UN MILLON" : `${threeDigitsToWords(millions)} MILLONES`,
    );
  }
  if (thousands > 0) {
    parts.push(
      thousands === 1 ? "MIL" : `${threeDigitsToWords(thousands)} MIL`,
    );
  }
  if (hundreds > 0) {
    parts.push(threeDigitsToWords(hundreds));
  }

  const integerWords = parts.join(" ").trim();

  return `${integerWords} CON ${cents}/100 ${currencyLabel}`.toUpperCase();
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#fff",
    padding: "6px",
    fontFamily: "Helvetica",
    fontSize: 10,
    display: "flex",
    flexDirection: "column",
    width: "80mm",
    borderWidth: 1,
    borderColor: "#000",
  },
  header: {
    marginBottom: 8,
    textAlign: "center",
    width: "100%",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
  },
  logo: {
    width: 92,
    height: 78,
    marginBottom: 4,
    alignSelf: "center",
    objectFit: "contain",
  },
  subtitle: {
    fontSize: 8,
    color: "#666",
    marginBottom: 10,
  },
  companyBox: {
    padding: 2,
    marginBottom: 6,
    fontWeight: "bold",
    //  backgroundColor: "#fffbeb",
  },
  companyText: {
    fontSize: 10,
    textAlign: "center",
    marginBottom: 2,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 4,
    marginBottom: 6,
    textAlign: "center",
  },
  ticketNumber: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    marginVertical: 6,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 3,
    fontSize: 9,
    textTransform: "uppercase",
  },
  infoLabel: {
    width: "34%",
    fontWeight: "bold",
  },
  infoValue: {
    width: "66%",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    paddingBottom: 4,
    marginBottom: 6,
    marginTop: 8,
  },
  tableHeaderText: {
    fontSize: 8,
    fontWeight: "bold",
  },
  colCant: {
    width: "18%",
  },
  colDesc: {
    width: "44%",
  },
  colPUni: {
    width: "20%",
    textAlign: "right",
  },
  colImporte: {
    width: "20%",
    textAlign: "right",
  },
  tableRow: {
    marginBottom: 6,
    fontSize: 9,
  },
  productMainRow: {
    flexDirection: "row",
  },
  productMeta: {
    marginLeft: "18%",
    fontSize: 9,
  },
  itemsCount: {
    fontSize: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  tbRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  tbLabel: {
    fontSize: 16,
    fontWeight: "bold",
    width: 36,
  },
  tbValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  summaryRow: {
    flexDirection: "row",
    marginBottom: 3,
    fontSize: 9,
    alignItems: "center",
  },
  summaryLabel: {
    width: "55%",
    fontWeight: "bold",
  },
  companyTitle: {
    fontSize: 11,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 3,
  },
  summaryCurrency: {
    width: "10%",
    textAlign: "center",
  },
  summaryAmount: {
    width: "35%",
    textAlign: "right",
  },
  totalRow: {
    flexDirection: "row",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#000",
    alignItems: "center",
  },
  totalLabel: {
    width: "55%",
    fontSize: 11,
    fontWeight: "bold",
  },
  totalCurrency: {
    width: "10%",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "center",
  },
  totalAmount: {
    width: "35%",
    fontSize: 12,
    fontWeight: "bold",
    textAlign: "right",
  },
  footer: {
    marginTop: 12,
    fontSize: 7,
    textAlign: "center",
    color: "#333",
  },
  footerText: {
    marginBottom: 3,
  },
  pointsBox: {
    marginTop: 7,
    marginBottom: 7,
  },
  pointsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  pointsLabel: {
    width: "68%",
    fontSize: 9,
    fontWeight: "bold",
  },
  pointsAmount: {
    width: "32%",
    fontSize: 9,
    fontWeight: "bold",
    textAlign: "left",
  },
  qrPlaceholder: {
    width: 80,
    height: 80,
    borderWidth: 2,
    borderColor: "#000",
    alignSelf: "center",
    marginTop: 10,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  qrText: {
    fontSize: 8,
  },
});
const TicketDocument = ({
  clientName,
  clientId,
  clientAddress,
  docType = "boleta",
  paymentMethod,
  items,
  totals,
  documentNumber,
  noteId,
  condition,
  bankEntity,
  operationNumber,
  memberCode,
  transactionNumber,
  saleType,
  companyName,
  companyRuc,
  companyAddress,
  companyDistrict,
  summary,
  preGeneratedQrBase64,
}: TicketDocumentProps) => {
  const [generatedQrBase64, setGeneratedQrBase64] = useState("");
  const companyPhoneFromStorage = useMemo(
    () => readCompanyPhoneFromStorage(),
    [],
  );

  const ticketData = useMemo(() => {
    const hasItems = Boolean(items?.length);
    const fallbackOperacionGravada = hasItems
      ? Number(totals?.subTotal ?? 0)
      : 10000;
    const fallbackSubtotal = hasItems ? Number(totals?.total ?? 0) : 100.0;
    const fallbackTotal = hasItems ? Number(totals?.total ?? 0) : 100.0;

    const operacionGravadaValue = Number(summary?.operacionGravada);
    const descuentoValue = Number(summary?.descuento);
    const subtotalValue = Number(summary?.subtotal);
    const igvValue = Number(summary?.igv);
    const totalValue = Number(summary?.total);
    const pvsTotalVentaValue = Number(summary?.pvsTotalVenta);
    const pvsTotalMesValue = Number(summary?.pvsTotalMes);

    const safeOperacionGravada = Number.isFinite(operacionGravadaValue)
      ? Math.max(0, operacionGravadaValue)
      : fallbackOperacionGravada;
    const safeDescuento = Number.isFinite(descuentoValue)
      ? Math.max(0, descuentoValue)
      : 0;
    const showDiscount = Boolean(summary?.showDiscount);
    const safeSubtotal = Number.isFinite(subtotalValue)
      ? Math.max(0, subtotalValue)
      : fallbackSubtotal;
    const safeIgv = Number.isFinite(igvValue)
      ? Math.max(0, igvValue)
      : Math.max(0, safeSubtotal - safeOperacionGravada);
    const safeTotal = Number.isFinite(totalValue)
      ? Math.max(0, totalValue)
      : fallbackTotal;
    const docLabel = docType === "factura" ? "RUC" : "DNI";
    const clientDoc =
      clientId?.trim() || (docLabel === "RUC" ? "00000000000" : "00000000");
    const now = new Date();
    const emissionDate = now.toLocaleDateString("es-PE");
    const emissionDateISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const amountInWords = numberToWords(safeTotal, "SOLES");
    const normalizedNoteId = String(noteId ?? "").trim();
    const qrDocTypeCode =
      docType === "factura" ? "01" : docType === "boleta" ? "03" : "";
    const qrClientDocTypeCode = docType === "factura" ? "06" : "01";
    const qrData = qrDocTypeCode
      ? [
          companyRuc?.trim() || "20601070155",
          qrDocTypeCode,
          documentNumber || "-",
          safeIgv.toFixed(2),
          safeTotal.toFixed(2),
          emissionDateISO,
          qrClientDocTypeCode,
          clientDoc,
        ].join("|")
      : "";
    const docLabelForAuthorization =
      docType === "factura"
        ? "Factura"
        : docType === "boleta"
          ? "Boleta"
          : "Comprobante";
    const normalizedItems = hasItems
      ? (items ?? []).map((item) => ({
          quantity: Number(item.cantidad ?? 0),
          description: item.nombre ?? "Producto",
          unitMeasure: item.unidadMedida ?? "",
          unitPrice: Number(item.precio ?? 0),
          total: Number(item.precio ?? 0) * Number(item.cantidad ?? 0),
          pv: Number(item.pv ?? 0),
          sv: Number(item.sv ?? 0),
        }))
      : [
          {
            quantity: 10.0,
            description: "UNI CHAPA CLASICA 250 CANTOL",
            unitMeasure: "",
            unitPrice: 79.0,
            total: 790.0,
            pv: 0,
            sv: 0,
          },
        ];
    const totalBags = normalizedItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0,
    );
    const fallbackPvsTotalVenta = normalizedItems.reduce(
      (sum, item) => sum + Number(item.pv || 0) * Number(item.quantity || 0),
      0,
    );
    const fallbackPvsTotalMes = normalizedItems.reduce(
      (sum, item) => sum + Number(item.sv || 0) * Number(item.quantity || 0),
      0,
    );

    return {
      isFactura: docType === "factura",
      isProforma: docType === "proforma",
      logo: "/LogoDXN.png",
      qrData,
      companyName: companyName?.trim() || "CONSORCIO FERRETERO ROSITA E.I.R.L.",
      ruc: companyRuc?.trim() || "20601070155",
      address: companyAddress?.trim() || "Calle 2 Mz B Lote 1",
      district: companyDistrict?.trim() || "LIMA",
      phones:
        companyPhoneFromStorage ||
        "Telef: 607-1883 / 943-296-081 / 944-284-915",
      documentType:
        docType === "factura"
          ? "FACTURA DE VENTA ELECTRONICA"
          : docType === "proforma"
            ? "PROFORMA DE VENTA"
            : "BOLETA DE VENTA ELECTRONICA",
      documentNumber: documentNumber || "",
      emissionDate,
      currency: "SOLES",
      paymentMethod: paymentMethod ?? "AL CONTADO",
      condition: condition || "AL CONTADO",
      bankEntity: bankEntity || "-",
      operationNumber: operationNumber || "",
      memberCode: memberCode || "",
      transactionNumber: transactionNumber || "",
      saleType: saleType || "CASH BILL",
      clientName: clientName || "Ultimo cliente",
      clientAddress: clientAddress?.trim() || "-",
      clientDNI: clientDoc,
      clientDocLabel: docLabel,
      seller: "ANDRE",
      items: normalizedItems,
      totalBags,
      pvsTotalVenta: Number.isFinite(pvsTotalVentaValue)
        ? Math.max(0, pvsTotalVentaValue)
        : fallbackPvsTotalVenta,
      pvsTotalMes: Number.isFinite(pvsTotalMesValue)
        ? Math.max(0, pvsTotalMesValue)
        : fallbackPvsTotalMes,
      operacionGravada: safeOperacionGravada,
      descuento: safeDescuento,
      showDiscount,
      subtotal: safeSubtotal,
      igv: safeIgv,
      total: safeTotal,
      son: amountInWords,
      authorization:
        docType === "proforma"
          ? "Nota: No es comprobante de pago, canjear por Boleta o Factura"
          : `Autorizado mediante Resolución de Intendencia SUNAT 0180050003180. Representación impresa de la ${docLabelForAuthorization} Electrónica. Consulta tu comprobante en: https://www.nubefact.com/buscar`,
      id: normalizedNoteId || "396548",
    };
  }, [
    clientId,
    clientAddress,
    clientName,
    docType,
    documentNumber,
    noteId,
    condition,
    bankEntity,
    operationNumber,
    memberCode,
    transactionNumber,
    saleType,
    items,
    paymentMethod,
    totals,
    companyName,
    companyRuc,
    companyAddress,
    companyDistrict,
    companyPhoneFromStorage,
    summary,
  ]);

  useEffect(() => {
    if (preGeneratedQrBase64) {
      return;
    }

    if (ticketData.qrData) {
      let active = true;
      generateTicketQrBase64(ticketData.qrData).then((url) => {
        if (active) setGeneratedQrBase64(url);
      });
      return () => {
        active = false;
      };
    }
  }, [preGeneratedQrBase64, ticketData.qrData]);

  const qrBase64 =
    preGeneratedQrBase64 || (ticketData.qrData ? generatedQrBase64 : "");

  return (
    <Document>
      <Page size={[226, 760]} style={styles.page}>
        <View style={styles.header}>
          {ticketData.logo && (
            <Image src={ticketData.logo} style={styles.logo} />
          )}
        </View>

        <View style={styles.companyBox}>
          <Text style={styles.companyTitle}>“ {ticketData.companyName} ”</Text>
          <Text style={styles.companyText}>R.U.C {ticketData.ruc}</Text>
          <Text style={styles.companyText}>{ticketData.address}</Text>
          <Text style={styles.companyText}>{ticketData.district}</Text>
          {ticketData.phones ? (
            <Text style={styles.companyText}>{ticketData.phones}</Text>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>{ticketData.documentType}</Text>
        <Text style={styles.ticketNumber}>{ticketData.documentNumber}</Text>

        <View style={styles.divider} />

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Fecha Emision</Text>
          <Text style={styles.infoValue}>: {ticketData.emissionDate}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>F-Vencimiento</Text>
          <Text style={styles.infoValue}>: {ticketData.emissionDate}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tipo Moneda</Text>
          <Text style={styles.infoValue}>: {ticketData.currency}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Condicion</Text>
          <Text style={styles.infoValue}>: {ticketData.condition}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Forma Pago</Text>
          <Text style={styles.infoValue}>: {ticketData.paymentMethod}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Entidad Ban.</Text>
          <Text style={styles.infoValue}>: {ticketData.bankEntity}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nro OPR</Text>
          <Text style={styles.infoValue}>: {ticketData.operationNumber}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Codigo</Text>
          <Text style={styles.infoValue}>: {ticketData.memberCode}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Señor(a)</Text>
          <Text style={styles.infoValue}>: {ticketData.clientName}</Text>
        </View>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{ticketData.clientDocLabel}</Text>
          <Text style={styles.infoValue}>: {ticketData.clientDNI}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Direccion</Text>
          <Text style={styles.infoValue}>: {ticketData.clientAddress}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Guia Remision</Text>
          <Text style={styles.infoValue}>: </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Tipo de Venta</Text>
          <Text style={styles.infoValue}>: {ticketData.saleType}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Nro Transacción</Text>
          <Text style={styles.infoValue}>: {ticketData.transactionNumber}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderText, styles.colCant]}>Cant.</Text>
          <Text style={[styles.tableHeaderText, styles.colDesc]}>
            Descripción
          </Text>
          <Text style={[styles.tableHeaderText, styles.colPUni]}>P.Uni</Text>
          <Text style={[styles.tableHeaderText, styles.colImporte]}>
            Importe
          </Text>
        </View>

        {ticketData.items.map((item, index) => (
          <View key={index} style={styles.tableRow}>
            <View style={styles.productMainRow}>
              <Text style={styles.colCant}>{item.quantity.toFixed(0)}</Text>
              <Text style={styles.colDesc}>
                {`${formatUnitPrefix(item.unitMeasure)}${item.description}`}
              </Text>
              <Text style={styles.colPUni}>{item.unitPrice.toFixed(2)}</Text>
              <Text style={styles.colImporte}>{item.total.toFixed(2)}</Text>
            </View>
            <Text style={styles.productMeta}>
              {`|***|PV:${Number(item.pv ?? 0).toFixed(2)} |***|SV:${Number(item.sv ?? 0).toFixed(2)}`}
            </Text>
          </View>
        ))}

        <Text style={styles.itemsCount}>items: {ticketData.items.length}</Text>

        <View style={styles.divider} />

        <View style={styles.tbRow}>
          <Text style={styles.tbLabel}>TB:</Text>
          <Text style={styles.tbValue}>{ticketData.totalBags.toFixed(0)}</Text>
        </View>

        {!ticketData.isProforma && (
          <>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>OP.GRAVADA :</Text>
              <Text style={styles.summaryCurrency}>S/</Text>
              <Text style={styles.summaryAmount}>
                {ticketData.operacionGravada.toFixed(2)}
              </Text>
            </View>
            {ticketData.showDiscount && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>DESCUENTO :</Text>
                <Text style={styles.summaryCurrency}>S/</Text>
                <Text style={styles.summaryAmount}>
                  {ticketData.descuento.toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>SUBTOTAL :</Text>
              <Text style={styles.summaryCurrency}>S/</Text>
              <Text style={styles.summaryAmount}>
                {ticketData.subtotal.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>I.G.V. :</Text>
              <Text style={styles.summaryCurrency}>S/</Text>
              <Text style={styles.summaryAmount}>
                {ticketData.igv.toFixed(2)}
              </Text>
            </View>
          </>
        )}
        {/* Totals are still shown for all document types */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL :</Text>
          <Text style={styles.totalCurrency}>S/</Text>
          <Text style={styles.totalAmount}>{ticketData.total.toFixed(2)}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>SON: {ticketData.son}</Text>
        </View>

        <View style={styles.pointsBox}>
          <View style={styles.pointsRow}>
            <Text style={styles.pointsLabel}>PVS TOTAL DE VENTA -----&gt;</Text>
            <Text style={styles.pointsAmount}>
              {ticketData.pvsTotalVenta.toFixed(2)}
            </Text>
          </View>
          <View style={styles.pointsRow}>
            <Text style={styles.pointsLabel}>PVS TOTAL DEL MES -----&gt;</Text>
            <Text style={styles.pointsAmount}>
              {ticketData.pvsTotalMes.toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          {ticketData.authorization ? (
            <Text style={styles.footerText}>{ticketData.authorization}</Text>
          ) : null}
          <Text style={styles.footerText}>ID: {ticketData.id}</Text>
        </View>

        <View>
          {qrBase64 && (
            <Image
              src={qrBase64}
              style={{
                width: 80,
                height: 80,
                alignSelf: "center",
                marginTop: 10,
              }}
            />
          )}
        </View>
      </Page>
    </Document>
  );
};

export default TicketDocument;
