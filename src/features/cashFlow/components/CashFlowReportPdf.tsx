import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CashFlowProductWeb } from "@/store/cashFlowProductsWeb/cashFlowProductsWeb.store";
import type { CashFlowMovementWeb } from "@/store/cashFlowMovementsWeb/cashFlowMovementsWeb.store";

type CashCount = { cantidad: number | ""; denominacion: number };
type CashReportMovement = Pick<CashFlowMovementWeb, "descripcion" | "importe">;

export type CashFlowReportPdfProps = {
  cajaId: number;
  encargado: string;
  usuario: string;
  fechaApertura: string;
  fechaCierre: string;
  sistemaObs: number;
  gastos: CashReportMovement[];
  ingresos: CashReportMovement[];
  conteoMonedas: CashCount[];
  totalEfectivo: number;
  totalBilletes: number;
  totalSencillo: number;
  totalIngresos: number;
  diferencial: number;
  observaciones: string;
  products?: CashFlowProductWeb[];
  documentTitle?: string;
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

const dateWithDay = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return dateOnly(value);
  const day = date.toLocaleDateString("es-PE", { weekday: "long" });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} ${dateOnly(value)}`;
};

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: "Helvetica", fontSize: 8, color: "#111" },
  title: { fontSize: 15, fontWeight: "bold", textAlign: "center" },
  subtitle: { marginTop: 2, fontSize: 9, textAlign: "center" },
  line: { borderBottomWidth: 1, borderColor: "#111", marginVertical: 9 },
  dateBar: {
    marginTop: 6,
    backgroundColor: "#00e5e5",
    paddingHorizontal: 6,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "bold",
  },
  meta: { fontSize: 8.5 },
  section: { marginTop: 10 },
  sectionTitle: { fontSize: 10, fontWeight: "bold", marginBottom: 4 },
  table: { borderWidth: 0.8, borderColor: "#111" },
  row: { flexDirection: "row", minHeight: 18 },
  head: { backgroundColor: "#ececec", fontWeight: "bold", minHeight: 20 },
  cell: {
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: "#555",
    padding: 4,
  },
  lastCell: { borderRightWidth: 0 },
  left: { textAlign: "left" },
  right: { textAlign: "right" },
  center: { textAlign: "center" },
  countTotals: { marginTop: 7 },
  totalLabelCell: {
    backgroundColor: "#fff200",
    fontWeight: "bold",
    textAlign: "center",
  },
  totalValueCell: {
    backgroundColor: "#00b050",
    fontWeight: "bold",
    textAlign: "right",
  },
  summary: { flexDirection: "row", borderWidth: 0.8, borderColor: "#111" },
  summaryCell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 0.5,
    borderColor: "#555",
  },
  noBorder: { borderRightWidth: 0 },
  observations: { marginTop: 12, minHeight: 36, fontWeight: "bold" },
  productTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 0.8,
    borderTopWidth: 0,
    borderColor: "#111",
    padding: 6,
    fontWeight: "bold",
  },
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
  headerColor,
  alignments = [],
}: {
  cells: string[];
  widths: number[];
  header?: boolean;
  headerColor?: string;
  alignments?: ("left" | "center" | "right")[];
}) => (
  <View
    style={[
      styles.row,
      ...(header
        ? [
            styles.head,
            ...(headerColor ? [{ backgroundColor: headerColor }] : []),
          ]
        : []),
    ]}
    wrap={false}
  >
    {cells.map((cell, index) => (
      <Text
        key={`${cell}-${index}`}
        style={[
          styles.cell,
          { width: `${widths[index]}%` },
          ...(index === cells.length - 1 ? [styles.lastCell] : []),
          ...(alignments[index] === "center"
            ? [styles.center]
            : alignments[index] === "left" || index === 0
              ? [styles.left]
              : [styles.right]),
        ]}
      >
        {cell}
      </Text>
    ))}
  </View>
);

const TotalRow = ({
  total,
  widths = [75, 25],
  valueBackground = "#00ff00",
}: {
  total: number;
  widths?: number[];
  valueBackground?: string;
}) => (
  <View style={styles.row} wrap={false}>
    <Text
      style={[styles.cell, styles.totalLabelCell, { width: `${widths[0]}%` }]}
    >
      TOTAL S/
    </Text>
    <Text
      style={[
        styles.cell,
        styles.lastCell,
        styles.totalValueCell,
        { backgroundColor: valueBackground },
        { width: `${widths[1]}%` },
      ]}
    >
      {money(total)}
    </Text>
  </View>
);

const CashTotalRow = ({ total }: { total: number }) => (
  <View style={styles.row} wrap={false}>
    <Text style={[styles.cell, styles.totalLabelCell, { width: "34%" }]} />
    <Text style={[styles.cell, styles.totalLabelCell, { width: "33%" }]}>
      TOTAL S/
    </Text>
    <Text
      style={[
        styles.cell,
        styles.lastCell,
        styles.totalLabelCell,
        styles.right,
        { width: "33%" },
      ]}
    >
      {money(total)}
    </Text>
  </View>
);

const BillCoinTotals = ({
  billetes,
  monedas,
}: {
  billetes: number;
  monedas: number;
}) => (
  <View style={[styles.table, styles.countTotals]}>
    <DataRow
      cells={["TOTAL DE BILLETES S/.", money(billetes)]}
      widths={[70, 30]}
      alignments={["right", "right"]}
      header
      headerColor="#fff"
    />
    <DataRow
      cells={["TOTAL DE MONEDAS S/.", money(monedas)]}
      widths={[70, 30]}
      alignments={["right", "right"]}
      header
      headerColor="#fff"
    />
  </View>
);

export function CashFlowReportPdf(props: CashFlowReportPdfProps) {
  const products = props.products ?? [];
  const totalProductos = products.reduce(
    (sum, product) => sum + Number(product.importe || 0),
    0,
  );
  const gastos = props.gastos.filter((item) => Number(item.importe || 0) !== 0);
  const totalSalidas = gastos.reduce(
    (sum, item) => sum + Number(item.importe || 0),
    0,
  );

  return (
    <Document title={props.documentTitle ?? `Cierre de caja ${props.cajaId}`} author="DNX Ventas">
      <Page size="A4" style={styles.page}>
        <Header title="Centro de Servicio- Reporte General Caja Diaria" />
        <View style={styles.dateBar}>
          <Text>
            Fecha: {dateWithDay(props.fechaCierre || props.fechaApertura)}
          </Text>
        </View>
        <Text style={styles.meta}>Ventas: {props.encargado || "-"}</Text>
        <Text style={[styles.meta, { marginTop: 3 }]}>
          Admin: {props.usuario || "-"}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumen</Text>
          <View style={styles.summary}>
            <View style={styles.summaryCell}>
              <Text>SISTEMA (OBS)</Text>
              <Text style={[styles.right, { marginTop: 3 }]}>
                {money(props.sistemaObs)}
              </Text>
            </View>
            <View style={styles.summaryCell}>
              <Text>SALIDAS</Text>
              <Text style={[styles.right, { marginTop: 3 }]}>
                {money(totalSalidas)}
              </Text>
            </View>
            <View style={[styles.summaryCell, styles.noBorder]}>
              <Text>DIFERENCIAL</Text>
              <Text style={[styles.right, { marginTop: 3 }]}>
                {money(props.diferencial)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Conteo de monedas</Text>
          <View style={styles.table}>
            <DataRow
              cells={["EFECTIVO", "BILLETE", "MONTO"]}
              widths={[34, 33, 33]}
              alignments={["center"]}
              header
              headerColor="#00ff00"
            />
            {props.conteoMonedas.map((item) => (
              <DataRow
                key={item.denominacion}
                cells={[
                  Number(item.cantidad || 0) === 0 ? "" : String(item.cantidad),
                  money(item.denominacion),
                  money(Number(item.cantidad || 0) * item.denominacion),
                ]}
                widths={[34, 33, 33]}
                alignments={["center"]}
              />
            ))}
            <CashTotalRow total={props.totalEfectivo} />
          </View>
          <BillCoinTotals
            billetes={props.totalBilletes}
            monedas={props.totalSencillo}
          />
        </View>

        <View style={styles.section}>
          <View style={styles.table}>
            <DataRow
              cells={["INGRESO", "TOTAL"]}
              widths={[75, 25]}
              header
              headerColor="#00ff00"
            />
            {props.ingresos.map((item, index) => (
              <DataRow
                key={`${item.descripcion}-${index}`}
                cells={[item.descripcion, money(item.importe)]}
                widths={[75, 25]}
              />
            ))}
            <TotalRow total={props.totalIngresos} valueBackground="#fff200" />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.table}>
            <DataRow
              cells={["SALIDAS", "TOTAL"]}
              widths={[75, 25]}
              header
              headerColor="#fff200"
            />
            {gastos.length ? (
              gastos.map((item, index) => (
                <DataRow
                  key={`${item.descripcion}-${index}`}
                  cells={[item.descripcion, money(item.importe)]}
                  widths={[75, 25]}
                />
              ))
            ) : (
              <DataRow
                cells={["Sin salidas registradas", money(0)]}
                widths={[75, 25]}
              />
            )}
            <TotalRow total={totalSalidas} />
          </View>
        </View>

        <View style={styles.observations}>
          <Text>OBSERVACIONES: {props.observaciones || ""}</Text>
        </View>
      </Page>

      {props.products !== undefined && <Page size="A4" style={styles.page}>
        <Header
          title="Centro de Servicios - Resumen de Venta (Producto)"
          subtitle={`[ ${dateOnly(props.fechaApertura)} - ${dateOnly(props.fechaCierre || props.fechaApertura)} ]`}
        />
        <View style={styles.table}>
          <DataRow
            cells={["Codigo", "Descripcion", "Cantidad", "IMPORTE"]}
            widths={[18, 50, 14, 18]}
            alignments={["left", "left", "center", "right"]}
            header
          />
          {products.length ? (
            products.map((product) => (
              <DataRow
                key={`${product.codigo}-${product.descripcion}`}
                cells={[
                  product.codigo,
                  product.descripcion,
                  money(product.cantidad),
                  money(product.importe),
                ]}
                widths={[18, 50, 14, 18]}
                alignments={["left", "left"]}
              />
            ))
          ) : (
            <DataRow
              cells={["-", "Sin productos para esta caja", "0.00", "0.00"]}
              widths={[18, 50, 14, 18]}
              alignments={["left", "left"]}
            />
          )}
        </View>
        <View style={styles.productTotal}>
          <Text>items: {products.length}</Text>
          <Text>TOTAL S/ {money(totalProductos)}</Text>
        </View>
      </Page>}
    </Document>
  );
}
