import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { creditNoteMoney, creditNoteNumber, type CreditNote, type CreditNoteItem } from "./creditNoteTypes";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, color: "#1e293b" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  title: { fontSize: 13, fontWeight: "bold", marginBottom: 4 },
  box: { borderWidth: 1, borderColor: "#94a3b8", padding: 10, textAlign: "center" },
  line: { marginBottom: 5 },
  section: { marginBottom: 14 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#e2e8f0", paddingVertical: 6 },
  heading: { backgroundColor: "#f1f5f9", fontWeight: "bold" },
  code: { width: "15%" }, description: { width: "40%" },
  quantity: { width: "15%", textAlign: "right" }, amount: { width: "15%", textAlign: "right" },
  totals: { alignSelf: "flex-end", width: 180, marginTop: 12 },
  totalLine: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
});

type Company = { name?: string; ruc?: string; address?: string };

export function CreditNotePdf({ note, items, company }: { note: CreditNote; items: CreditNoteItem[]; company: Company }) {
  return <Document><Page size="A4" style={styles.page}>
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>{company.name || "-"}</Text>
        <Text style={styles.line}>RUC: {company.ruc || "-"}</Text>
        <Text>{company.address || "-"}</Text>
      </View>
      <View style={styles.box}>
        <Text style={styles.title}>NOTA DE CRÉDITO</Text>
        <Text>{creditNoteNumber(note)}</Text>
      </View>
    </View>
    <View style={styles.section}>
      <Text style={styles.line}>Fecha: {note.fecha || "-"}</Text>
      <Text style={styles.line}>Cliente: {note.cliente || "-"}</Text>
      <Text style={styles.line}>RUC/DNI: {note.ruc || note.dni || "-"}</Text>
      <Text style={styles.line}>Nro. asociado: {note.referencia || "-"}</Text>
      <Text style={styles.line}>Concepto: {note.concepto || "-"}</Text>
      <Text>Estado: {note.estado || "-"} · SUNAT: {note.estadoSunat || "-"}</Text>
    </View>
    <View style={[styles.row, styles.heading]}>
      <Text style={styles.code}>Código</Text><Text style={styles.description}>Descripción</Text>
      <Text style={styles.quantity}>Cantidad</Text><Text style={styles.amount}>Precio</Text><Text style={styles.amount}>Importe</Text>
    </View>
    {items.map((item) => <View key={item.id} style={styles.row} wrap={false}>
      <Text style={styles.code}>{item.codigo || "-"}</Text><Text style={styles.description}>{item.descripcion || "-"}</Text>
      <Text style={styles.quantity}>{item.cantidad}</Text><Text style={styles.amount}>{creditNoteMoney(item.precio)}</Text>
      <Text style={styles.amount}>{creditNoteMoney(item.importe)}</Text>
    </View>)}
    {items.length === 0 && <Text style={styles.line}>Esta nota de crédito no tiene detalles registrados.</Text>}
    <View style={styles.totals}>
      <View style={styles.totalLine}><Text>Subtotal</Text><Text>S/ {creditNoteMoney(note.subtotal)}</Text></View>
      <View style={styles.totalLine}><Text>IGV</Text><Text>S/ {creditNoteMoney(note.igv)}</Text></View>
      <View style={styles.totalLine}><Text>Total</Text><Text>S/ {creditNoteMoney(note.total)}</Text></View>
    </View>
  </Page></Document>;
}
