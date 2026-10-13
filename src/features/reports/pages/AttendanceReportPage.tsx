import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import Alert from "@mui/material/Alert";
import type { AttendanceReportRow } from "@/features/reports/api/attendanceReport";
import { fetchAttendanceReport } from "@/features/reports/api/attendanceReport";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { esES } from "@mui/x-date-pickers/locales";
import DataTable from "@/components/DataTable";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/es";

const column = createColumnHelper<AttendanceReportRow>();
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export default function AttendanceReportPage() {
  const [fecha, setFecha] = useState(today);
  const report = useQuery({
    queryKey: ["attendance-report", fecha],
    queryFn: () => fetchAttendanceReport(fecha),
    enabled: Boolean(fecha),
  });

  const columns = useMemo<ColumnDef<AttendanceReportRow, unknown>[]>(
    () => [
      column.accessor("nombres", { header: "Usuario" }),
      column.accessor("personalId", {
        header: "Personal ID",
        meta: { align: "right" },
      }),
      column.accessor("horaIngreso", {
        header: "Ingreso",
        meta: { align: "center" },
      }),
      column.accessor("salidaRefrigerio", {
        header: "Salida a refrigerio",
        meta: { align: "center" },
      }),
      column.accessor("retornoRefrigerio", {
        header: "Retorno de refrigerio",
        meta: { align: "center" },
      }),
      column.accessor("horaSalida", {
        header: "Salida",
        meta: { align: "center" },
      }),
      column.accessor("estadoAsistencia", {
        header: "Asistencia",
        cell: (info) => (
          <span
            className={
              info.getValue() === "TARDANZA"
                ? "font-semibold text-amber-700"
                : "font-semibold text-emerald-700"
            }
          >
            {info.getValue() || "-"}
          </span>
        ),
        meta: { align: "center" },
      }),
    ],
    [],
  );

  return (
    <div className="p-2 sm:p-4">
      {report.isError ? (
        <Alert severity="error">
          {report.error instanceof Error
            ? report.error.message
            : "Error al consultar las asistencias."}
        </Alert>
      ) : (
        <DataTable
          data={report.data ?? []}
          columns={columns}
          isLoading={report.isLoading || report.isFetching}
          filterKeys={["nombres", "personalId", "estadoAsistencia"]}
          searchPlaceholder="Buscar por nombre o Personal ID..."
          emptyMessage="No hay asistencias registradas para la fecha seleccionada."
          initialPageSize={50}
          persistPageSize={false}
          tableMaxHeight="65vh"
          toolbarLeading={
            <LocalizationProvider
              dateAdapter={AdapterDayjs}
              adapterLocale="es"
              localeText={
                esES.components.MuiLocalizationProvider.defaultProps.localeText
              }
            >
              <label className="flex min-w-[160px] flex-col gap-1 text-xs text-slate-600">
                Fecha
                <DatePicker
                  format="DD/MM/YY"
                  value={fecha ? dayjs(fecha) : null}
                  onChange={(value: Dayjs | null) =>
                    setFecha(value?.isValid() ? value.format("YYYY-MM-DD") : "")
                  }
                  slotProps={{
                    textField: {
                      size: "small",
                      sx: {
                        width: 170,
                        "& .MuiOutlinedInput-root": {
                          height: 44,
                          borderRadius: "0.5rem",
                          backgroundColor: "#ffffff",
                        },
                      },
                    },
                  }}
                />
              </label>
            </LocalizationProvider>
          }
        />
      )}
    </div>
  );
}
