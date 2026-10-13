import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { AttendanceReportRow } from "@/features/reports/api/attendanceReport";

export type AttendanceReportPdfFilters = {
  fechaInicio: string;
  fechaFin: string;
  reporteGeneral: boolean;
  personalNombre?: string;
};

const formatDate = (value: string) => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const dayName = (value: string) => {
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return "-";
  return new Date(year, month - 1, day)
    .toLocaleDateString("es-PE", { weekday: "long" })
    .toLocaleUpperCase("es-PE");
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingHorizontal: 30,
    paddingBottom: 42,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#23344d",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#9b302b",
  },
  title: { fontSize: 17, fontWeight: "bold", color: "#8f2e29" },
  subtitle: { marginTop: 4, fontSize: 8, color: "#64748b" },
  reportTag: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 4,
    color: "#8f2e29",
    backgroundColor: "#f9e9e7",
    fontSize: 8,
    fontWeight: "bold",
  },
  summary: {
    flexDirection: "row",
    gap: 9,
    marginTop: 14,
    marginBottom: 14,
  },
  summaryCard: {
    flexGrow: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 0.7,
    borderColor: "#dbe3ed",
    borderRadius: 4,
    backgroundColor: "#f7f9fc",
  },
  summaryLabel: {
    marginBottom: 4,
    color: "#64748b",
    fontSize: 7,
    textTransform: "uppercase",
  },
  summaryValue: { fontSize: 9, fontWeight: "bold", color: "#23344d" },
  table: { borderWidth: 0.7, borderColor: "#d4dce7" },
  row: { flexDirection: "row", minHeight: 23 },
  headerRow: {
    minHeight: 27,
    color: "#ffffff",
    backgroundColor: "#35465f",
  },
  alternateRow: { backgroundColor: "#f5f8fc" },
  cell: {
    justifyContent: "center",
    paddingVertical: 5,
    paddingHorizontal: 5,
    borderRightWidth: 0.5,
    borderBottomWidth: 0.5,
    borderColor: "#dbe3ed",
  },
  headerCell: { borderColor: "#35465f" },
  cellText: { fontSize: 7.5 },
  headerText: { fontSize: 7, fontWeight: "bold", color: "#ffffff" },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
  status: { fontWeight: "bold", color: "#047857", textAlign: "center" },
  late: { color: "#b45309" },
  footer: {
    position: "absolute",
    left: 30,
    right: 30,
    bottom: 18,
    paddingTop: 6,
    borderTopWidth: 0.7,
    borderTopColor: "#dbe3ed",
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#64748b",
    fontSize: 7,
  },
});

const columns = [
  { label: "FECHA", width: "9%", value: (row: AttendanceReportRow) => row.fecha },
  { label: "DÍA", width: "9%", value: (row: AttendanceReportRow) => dayName(row.fecha) },
  { label: "NOMBRES", width: "19%", value: (row: AttendanceReportRow) => row.nombres },
  { label: "INGRESO", width: "9%", value: (row: AttendanceReportRow) => row.horaIngreso },
  { label: "SALIDA REFRIGERIO", width: "12%", value: (row: AttendanceReportRow) => row.salidaRefrigerio },
  { label: "RETORNO REFRIGERIO", width: "13%", value: (row: AttendanceReportRow) => row.retornoRefrigerio },
  { label: "SALIDA", width: "9%", value: (row: AttendanceReportRow) => row.horaSalida },
  { label: "N.º TARDANZAS", width: "10%", value: (row: AttendanceReportRow) => String(row.cantidadTardanzas) },
  { label: "ASISTENCIA", width: "10%", value: (row: AttendanceReportRow) => row.estadoAsistencia },
];

export function AttendanceReportPdf({
  rows,
  filters,
}: {
  rows: AttendanceReportRow[];
  filters: AttendanceReportPdfFilters;
}) {
  const subject = filters.reporteGeneral
    ? "Reporte General"
    : filters.personalNombre || "Personal";

  return (
    <Document title="Reporte de asistencia">
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Reporte de asistencia</Text>
            <Text style={styles.subtitle}>Control de asistencia del personal</Text>
          </View>
          <Text style={styles.reportTag}>{subject.toLocaleUpperCase("es-PE")}</Text>
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Periodo</Text>
            <Text style={styles.summaryValue}>
              {formatDate(filters.fechaInicio)} al {formatDate(filters.fechaFin)}
            </Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Personal</Text>
            <Text style={styles.summaryValue}>{subject}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Registros</Text>
            <Text style={styles.summaryValue}>{rows.length}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]} fixed>
            {columns.map((column) => (
              <View
                key={column.label}
                style={[styles.cell, styles.headerCell, { width: column.width }]}
              >
                <Text style={styles.headerText}>{column.label}</Text>
              </View>
            ))}
          </View>
          {rows.map((row, index) => (
            <View
              key={`${row.id}-${index}`}
              style={[styles.row, index % 2 === 1 ? styles.alternateRow : {}]}
              wrap={false}
            >
              {columns.map((column) => {
                const value = column.value(row) || "-";
                const isStatus = column.label === "ASISTENCIA";
                return (
                  <View
                    key={column.label}
                    style={[styles.cell, { width: column.width }]}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        column.label === "DÍA" || isStatus ? styles.center : {},
                        column.label === "N.º TARDANZAS" ? styles.right : {},
                        isStatus ? styles.status : {},
                        row.estadoAsistencia === "TARDANZA" && isStatus
                          ? styles.late
                          : {},
                      ]}
                    >
                      {value}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.footer} fixed>
          <Text>Reporte de asistencia · {rows.length} registros</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
