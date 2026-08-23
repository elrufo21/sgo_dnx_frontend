import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CashFlowProductWeb } from "@/store/cashFlowProductsWeb/cashFlowProductsWeb.store";
import type { CashFlowMovementWeb } from "@/store/cashFlowMovementsWeb/cashFlowMovementsWeb.store";

type CashCount = { cantidad: number | ""; denominacion: number };

export type CashFlowReportPdfProps = {
  cajaId: number;
  encargado: string;
  usuario: string;
  fechaApertura: string;
  fechaCierre: string;
  sistemaObs: number;
  gastos: CashFlowMovementWeb[];
  ingresos: CashFlowMovementWeb[];
  conteoMonedas: CashCount[];
  totalEfectivo: number;
  totalBilletes: number;
  totalSencillo: number;
  totalIngresos: number;
  diferencial: number;
  observaciones: string;
  products: CashFlowProductWeb[];
};

const money = (value: number) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const dateOnly = (value: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toLocaleDateString("en-GB");
};

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: "Helvetica", fontSize: 8, color: "#111" },
  title: { fontSize: 15, fontWeight: "bold", textAlign: "center" },
  subtitle: { marginTop: 2, fontSize: 9, textAlign: "center" },
  line: { borderBottomWidth: 1, borderColor: "#111", marginVertical: 9 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  meta: { fontSize: 8.5 },
  section: { marginTop: 10 },
  sectionTitle: { fontSize: 10, fontWeight: "bold", marginBottom: 4 },
  table: { borderWidth: 0.8, borderColor: "#111" },
  row: { flexDirection: "row", minHeight: 18 },
  head: { backgroundColor: "#ececec", fontWeight: "bold", minHeight: 20 },
  cell: { borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: "#555", padding: 4 },
  lastCell: { borderRightWidth: 0 },
  right: { textAlign: "right" },
  center: { textAlign: "center" },
  total: { backgroundColor: "#fff200", flexDirection: "row", justifyContent: "flex-end", padding: 6, fontSize: 11, fontWeight: "bold" },
  totals: { flexDirection: "row", justifyContent: "space-between", marginTop: 7 },
  totalLabel: { fontSize: 9, fontWeight: "bold" },
  summary: { flexDirection: "row", borderWidth: 0.8, borderColor: "#111" },
  summaryCell: { flex: 1, padding: 6, borderRightWidth: 0.5, borderColor: "#555" },
  noBorder: { borderRightWidth: 0 },
  purple: { backgroundColor: "#8a008a", color: "#fff", padding: 7, textAlign: "right", fontSize: 11, fontWeight: "bold" },
  observations: { minHeight: 36, borderWidth: 0.8, borderColor: "#111", padding: 5 },
  productTotal: { flexDirection: "row", justifyContent: "space-between", borderWidth: 0.8, borderTopWidth: 0, borderColor: "#111", padding: 6, fontWeight: "bold" },
});

const Header = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <>
    <Text style={styles.title}>{title}</Text>
    {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    <View style={styles.line} />
  </>
);

const DataRow = ({
  cells,
  widths,
  header = false,
}: {
  cells: string[];
  widths: number[];
  header?: boolean;
}) => (
  <View style={[styles.row, ...(header ? [styles.head] : [])]} wrap={false}>
    {cells.map((cell, index) => (
      <Text
        key={`${cell}-${index}`}
        style={[
          styles.cell,
          { width: `${widths[index]}%` },
          ...(index === cells.length - 1 ? [styles.lastCell] : []),
          ...(index > 0 ? [styles.right] : []),
        ]}
      >
        {cell}
      </Text>
    ))}
  </View>
);

export function CashFlowReportPdf(props: CashFlowReportPdfProps) {
  const totalProductos = props.products.reduce(
    (sum, product) => sum + Number(product.importe || 0),
    0,
  );
  const gastos = props.gastos.filter((item) => Number(item.importe || 0) !== 0);

  return (
    <Document title={`Cierre de caja ${props.cajaId}`} author="DNX Ventas">
      <Page size="A4" style={styles.page}>
        <Header title="Centro de Servicio- Reporte General Caja Diaria" />
        <View style={styles.metaRow}>
          <Text style={styles.meta}>Fecha: DIA {dateOnly(props.fechaCierre || props.fechaApertura)}</Text>
          <Text style={styles.meta}>Caja: {props.cajaId}</Text>
        </View>
        <Text style={styles.meta}>Ventas: {props.encargado || "-"}</Text>
        <Text style={[styles.meta, { marginTop: 3 }]}>Admin: {props.usuario || "-"}</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen</Text>
          <View style={styles.summary}>
            <View style={styles.summaryCell}><Text>SISTEMA (OBS)</Text><Text style={[styles.right, { marginTop: 3 }]}>{money(props.sistemaObs)}</Text></View>
            <View style={styles.summaryCell}><Text>SALIDAS</Text><Text style={[styles.right, { marginTop: 3 }]}>{money(gastos.reduce((sum, item) => sum + Number(item.importe || 0), 0))}</Text></View>
            <View style={[styles.summaryCell, styles.noBorder]}><Text>DIFERENCIAL</Text><Text style={[styles.right, { marginTop: 3 }]}>{money(props.diferencial)}</Text></View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conteo de monedas</Text>
          <View style={styles.table}>
            <DataRow cells={["EFECTIVO", "BILLETE", "MONTO"]} widths={[34, 33, 33]} header />
            {props.conteoMonedas.map((item) => (
              <DataRow
                key={item.denominacion}
                cells={[
                  item.cantidad === "" ? "" : String(item.cantidad),
                  money(item.denominacion),
                  money(Number(item.cantidad || 0) * item.denominacion),
                ]}
                widths={[34, 33, 33]}
              />
            ))}
          </View>
          <View style={styles.total}><Text>{money(props.totalEfectivo)}</Text></View>
          <View style={styles.totals}>
            <Text style={styles.totalLabel}>Total de Billetes : {money(props.totalBilletes)}</Text>
            <Text style={styles.totalLabel}>Total de Monedas : {money(props.totalSencillo)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Otros Movimientos - Ingresos</Text>
          <View style={styles.table}>
            <DataRow cells={["DESCRIPCION", "IMPORTE"]} widths={[75, 25]} header />
            {props.ingresos.map((item) => (
              <DataRow key={`${item.id}-${item.descripcion}`} cells={[item.descripcion, money(item.importe)]} widths={[75, 25]} />
            ))}
          </View>
          <View style={styles.purple}><Text>{money(props.totalIngresos)}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Otros Movimientos - Salidas</Text>
          <View style={styles.table}>
            <DataRow cells={["DESCRIPCION", "IMPORTE"]} widths={[75, 25]} header />
            {gastos.length ? gastos.map((item) => (
              <DataRow key={`${item.id}-${item.descripcion}`} cells={[item.descripcion, money(item.importe)]} widths={[75, 25]} />
            )) : <DataRow cells={["Sin salidas registradas", money(0)]} widths={[75, 25]} />}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Observaciones</Text>
          <View style={styles.observations}><Text>{props.observaciones || "-"}</Text></View>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <Header
          title="Centro de Servicios - Resumen de Venta (Producto)"
          subtitle={`[ ${dateOnly(props.fechaApertura)} - ${dateOnly(props.fechaCierre || props.fechaApertura)} ]`}
        />
        <View style={styles.table}>
          <DataRow cells={["Codigo", "Descripcion", "Cantidad", "IMPORTE"]} widths={[18, 50, 14, 18]} header />
          {props.products.length ? props.products.map((product) => (
            <DataRow
              key={`${product.codigo}-${product.descripcion}`}
              cells={[product.codigo, product.descripcion, money(product.cantidad), money(product.importe)]}
              widths={[18, 50, 14, 18]}
            />
          )) : <DataRow cells={["-", "Sin productos para esta caja", "0.00", "0.00"]} widths={[18, 50, 14, 18]} />}
        </View>
        <View style={styles.productTotal}>
          <Text>items: {props.products.length}</Text>
          <Text>TOTAL S/ {money(totalProductos)}</Text>
        </View>
      </Page>
    </Document>
  );
}
