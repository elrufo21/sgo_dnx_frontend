import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

export type DeliveryGuideItem = {
  description: string;
  code: string;
  sunatCode: string;
  gtin: string;
  quantity: string;
  unit: string;
};

export type DeliveryGuideValues = {
  serie: string;
  number: string;
  deliveryDate: string;
  emissionTime: string;
  reason: string;
  reasonDescription: string;
  recipient: string;
  recipientDocument: string;
  departure: string;
  arrival: string;
  transportMode: string;
  transshipment: string;
  m1Vehicle: string;
  grossWeight: string;
  weightUnit: string;
  items: DeliveryGuideItem[];
};

type DeliveryGuidePdfProps = {
  values: DeliveryGuideValues;
  company: { name?: string; ruc?: string };
  qrBase64?: string;
};

const text = (value: unknown, fallback = "-") =>
  String(value ?? "").trim() || fallback;

const upper = (value: unknown, fallback = "-") => text(value, fallback).toUpperCase();

const date = (value: string) => {
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : text(value);
};

const styles = StyleSheet.create({
  page: { width: 800, height: 1150, padding: 14, fontFamily: "Helvetica", fontSize: 10, color: "#000" },
  content: { padding: 4 },
  top: { height: 120, flexDirection: "row", alignItems: "flex-start" },
  qr: { width: 90, height: 90, marginTop: 20, marginLeft: 8 },
  company: { flex: 1, paddingTop: 10, alignItems: "center" },
  companyName: { fontSize: 21, textAlign: "center" },
  emitted: { marginTop: 76, fontSize: 11 },
  documentBox: { width: 260, height: 74, borderWidth: 1.2, marginTop: 5, alignItems: "center", justifyContent: "center" },
  boxLine: { fontSize: 14, fontWeight: "bold", lineHeight: 18, textAlign: "center" },
  dataRow: { flexDirection: "row", marginTop: 26, gap: 25 },
  dataCell: { flex: 1, flexDirection: "row" },
  label: { fontWeight: "bold" },
  value: { flex: 1 },
  wide: { marginTop: 24, flexDirection: "row" },
  table: { marginTop: 24, borderWidth: 1, borderBottomWidth: 0 },
  tableHeader: { flexDirection: "row", minHeight: 53, backgroundColor: "#d1d1d1", borderBottomWidth: 1 },
  tableRow: { flexDirection: "row", minHeight: 20, borderBottomWidth: 1 },
  cell: { borderRightWidth: 1, paddingHorizontal: 3, paddingVertical: 3, justifyContent: "center" },
  lastCell: { paddingHorizontal: 3, paddingVertical: 3, justifyContent: "center" },
  header: { fontSize: 10, textAlign: "center" },
  item: { fontSize: 8 },
  centered: { textAlign: "center" },
  right: { textAlign: "right" },
  below: { marginTop: 14, fontSize: 11 },
  section: { marginTop: 18, fontSize: 11 },
  footer: { position: "absolute", bottom: 10, left: 8, right: 8, fontSize: 8, fontWeight: "bold", textAlign: "center" },
});

const columns = [
  ["N°", 28],
  ["Bien\nnormalizado", 65],
  ["Código de\nBien", 55],
  ["Código\nproducto\nSUNAT", 64],
  ["Partida\narancelaria", 75],
  ["Código\nGTIN", 58],
  ["Descripción Detallada", 290],
  ["Unidad de\nmedida", 58],
  ["Cantidad", 70],
] as const;

export function DeliveryGuidePdf({ values, company, qrBase64 = "" }: DeliveryGuidePdfProps) {
  const companyName = upper(company.name, "MI EMPRESA");
  const documentNumber = `${upper(values.serie, "EG01")}-${text(values.number, "00000001").padStart(8, "0")}`;

  return (
    <Document>
      <Page size={{ width: 800, height: 1150 }} style={styles.page}>
        <View style={styles.content}>
          <View style={styles.top}>
            <View style={styles.qr}>{qrBase64 ? <Image src={qrBase64} style={styles.qr} /> : null}</View>
            <View style={styles.company}>
              <Text style={styles.companyName}>{companyName}</Text>
              <Text style={styles.emitted}>Fecha y hora de emisión : {date(values.deliveryDate)} {text(values.emissionTime, "00:00")} </Text>
            </View>
            <View style={styles.documentBox}>
              <Text style={styles.boxLine}>RUC N°{text(company.ruc)}</Text>
              <Text style={styles.boxLine}>GUÍA DE REMISIÓN ELECTRÓNICA</Text>
              <Text style={styles.boxLine}>REMITENTE</Text>
              <Text style={styles.boxLine}>N° {documentNumber}</Text>
            </View>
          </View>

          <View style={styles.dataRow}>
            <View style={styles.dataCell}><Text style={styles.label}>Fecha de entrega de Bienes al transportista: </Text><Text style={styles.value}>{date(values.deliveryDate)}</Text></View>
            <View style={styles.dataCell}><Text style={styles.label}>Punto de Partida </Text><Text style={styles.value}>{upper(values.departure)}</Text></View>
          </View>
          <View style={styles.dataRow}>
            <View style={styles.dataCell}><Text style={styles.label}>Motivo de Traslado : </Text><Text style={styles.value}>{upper(values.reason)}</Text></View>
            <View style={styles.dataCell}><Text style={styles.label}>Punto de llegada </Text><Text style={styles.value}>{upper(values.arrival)}</Text></View>
          </View>
          <View style={styles.wide}><Text style={styles.label}>Descripción de Motivo : </Text><Text style={styles.value}>{upper(values.reasonDescription)}</Text></View>
          <View style={styles.wide}><Text style={styles.label}>Datos del Destinatario : </Text><Text style={styles.value}>{upper(values.recipient)} - REGISTRO ÚNICO DE CONTRIBUYENTES N° {text(values.recipientDocument)}</Text></View>
          <Text style={[styles.label, { marginTop: 18 }]}>Bienes por transportar:</Text>

          <View style={styles.table}>
            <View style={styles.tableHeader}>
              {columns.map(([label, width], index) => (
                <View key={label} style={index === columns.length - 1 ? [styles.lastCell, { width }] : [styles.cell, { width }]}>
                  <Text style={styles.header}>{label}</Text>
                </View>
              ))}
            </View>
            {values.items.map((item, index) => (
              <View key={`${item.description}-${index}`} style={styles.tableRow}>
                {[
                  [String(index + 1), ""], ["NO", ""], [upper(item.code), ""], [upper(item.sunatCode), ""], ["", ""], [upper(item.gtin), ""], [upper(item.description), "description"], [upper(item.unit, "UNIDAD (NIU)"), ""], [text(item.quantity, "0"), "quantity"],
                ].map(([value, kind], cellIndex) => {
                  const width = columns[cellIndex][1];
                  return <View key={`${cellIndex}-${value}`} style={cellIndex === columns.length - 1 ? [styles.lastCell, { width }] : [styles.cell, { width }]}><Text style={[styles.item, kind === "description" || cellIndex === 6 ? {} : styles.centered, kind === "quantity" ? styles.right : {}]}>{value}</Text></View>;
                })}
              </View>
            ))}
          </View>

          <Text style={styles.below}>Unidad de Medida del Peso Bruto: {upper(values.weightUnit, "KGM")}</Text>
          <Text style={styles.below}>Peso Bruto total de la carga: {text(values.grossWeight, "0")}</Text>
          <Text style={[styles.label, styles.section]}>Datos del traslado:</Text>
          <Text style={styles.section}>Modalidad de Traslado: {upper(values.transportMode)}</Text>
          <Text style={styles.section}>Indicador de transbordo programado: {upper(values.transshipment)}</Text>
          <Text style={styles.section}>Indicador de traslado en vehículos de categoría M1 o L: {upper(values.m1Vehicle)}</Text>
          <Text style={styles.footer}>Esta es una representación impresa sin valor tributario de la Guía de Remisión Electrónica generada en el sistema de la SUNAT. Puede verificarla utilizando su clave SOL</Text>
        </View>
      </Page>
    </Document>
  );
}
