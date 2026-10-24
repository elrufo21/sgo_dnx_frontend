import { useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { useQuery } from "@tanstack/react-query";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import Alert from "@mui/material/Alert";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { esES } from "@mui/x-date-pickers/locales";
import { Eraser, Printer, Search } from "lucide-react";
import DataTable from "@/components/DataTable";
import {
  fetchAttendancePeople,
  fetchAttendanceReportRange,
  type AttendanceReportRow,
} from "@/features/reports/api/attendanceReport";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import { AttendanceReportPdf } from "@/features/reports/components/AttendanceReportPdf";
import dayjs, { type Dayjs } from "dayjs";
import { toast } from "sonner";
import "dayjs/locale/es";

const column = createColumnHelper<AttendanceReportRow>();
type ReportFilters = {
  fechaInicio: string;
  fechaFin: string;
  reporteGeneral: boolean;
  personalId?: number;
  personalNombre?: string;
};

const dayName = (value: string) => {
  const [day, month, year] = value.split("/").map(Number);
  if (!day || !month || !year) return "-";
  return new Date(year, month - 1, day).toLocaleDateString("es-PE", {
    weekday: "long",
  }).toLocaleUpperCase("es-PE");
};

export default function AttendanceReportPage() {
  const [defaultDateRange] = useState(() => {
    const today = new Date();
    return {
      fechaInicio: getLocalDateISO(new Date(today.getFullYear(), today.getMonth(), 1)),
      fechaFin: getLocalDateISO(today),
    };
  });
  const [fechaInicio, setFechaInicio] = useState(defaultDateRange.fechaInicio);
  const [fechaFin, setFechaFin] = useState(defaultDateRange.fechaFin);
  const [personalId, setPersonalId] = useState("");
  const [reporteGeneral, setReporteGeneral] = useState(true);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters | null>(() => ({
    ...defaultDateRange,
    reporteGeneral: true,
  }));
  const [filterError, setFilterError] = useState("");
  const [search, setSearch] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const people = useQuery({
    queryKey: ["attendance-report-people"],
    queryFn: fetchAttendancePeople,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const report = useQuery({
    queryKey: ["attendance-report-range", appliedFilters],
    queryFn: () => {
      if (!appliedFilters) return Promise.resolve([]);
      return fetchAttendanceReportRange(
        appliedFilters.fechaInicio,
        appliedFilters.fechaFin,
        appliedFilters.personalId,
      );
    },
    enabled: appliedFilters !== null,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const columns = useMemo<ColumnDef<AttendanceReportRow, unknown>[]>(
    () => [
      column.accessor("fecha", { header: "Fecha" }),
      column.display({ id: "dia", header: "Día", cell: ({ row }) => dayName(row.original.fecha) }),
      column.accessor("nombres", { header: "Nombres" }),
      column.accessor("horaIngreso", { header: "Ingreso", meta: { align: "center" } }),
      column.accessor("salidaRefrigerio", { header: "Salida refrigerio", meta: { align: "center" } }),
      column.accessor("retornoRefrigerio", { header: "Retorno refrigerio", meta: { align: "center" } }),
      column.accessor("horaSalida", { header: "Salida", meta: { align: "center" } }),
      column.accessor("cantidadTardanzas", { header: "N.º tardanzas", meta: { align: "right" } }),
      column.accessor("estadoAsistencia", {
        header: "Asistencia",
        cell: (info) => (
          <span className={info.getValue() === "TARDANZA" ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>
            {info.getValue() || "-"}
          </span>
        ),
        meta: { align: "center" },
      }),
    ] as unknown as ColumnDef<AttendanceReportRow, unknown>[],
    [],
  );

  const buscar = (
    nextFechaInicio = fechaInicio,
    nextFechaFin = fechaFin,
    nextPersonalId = personalId,
    nextReporteGeneral = reporteGeneral,
  ) => {
    setFilterError("");
    if (!nextFechaInicio || !nextFechaFin) {
      setFilterError("Selecciona la fecha de inicio y la fecha de fin.");
      return;
    }
    if (nextFechaInicio > nextFechaFin) {
      setFilterError("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }
    if (!nextReporteGeneral && !nextPersonalId) {
      setFilterError("Selecciona un personal o activa Reporte General.");
      return;
    }

    setAppliedFilters({
      fechaInicio: nextFechaInicio,
      fechaFin: nextFechaFin,
      reporteGeneral: nextReporteGeneral,
      personalId: nextReporteGeneral ? undefined : Number(nextPersonalId),
      personalNombre: nextReporteGeneral
        ? undefined
        : people.data?.find((person) => String(person.personalId) === nextPersonalId)?.nombres,
    });
  };

  const limpiar = () => {
    setFechaInicio(defaultDateRange.fechaInicio);
    setFechaFin(defaultDateRange.fechaFin);
    setPersonalId("");
    setReporteGeneral(true);
    setAppliedFilters(null);
    setFilterError("");
    setSearch("");
  };

  const reportRows = report.data ?? [];

  const abrirPdf = async () => {
    if (generatingPdf || !appliedFilters || reportRows.length === 0) return;

    const reportWindow = window.open("", "_blank");
    setGeneratingPdf(true);
    try {
      const blob = await pdf(
        <AttendanceReportPdf rows={reportRows} filters={appliedFilters} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      if (reportWindow) {
        reportWindow.location.href = url;
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = `Reporte_asistencia_${appliedFilters.fechaInicio}_${appliedFilters.fechaFin}.pdf`;
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      reportWindow?.close();
      toast.error(
        error instanceof Error ? error.message : "No se pudo generar el PDF.",
      );
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="p-2 sm:p-4">
      {filterError && <Alert className="mb-3" severity="warning">{filterError}</Alert>}
      {people.isError && (
        <Alert className="mb-3" severity="error">
          {people.error instanceof Error ? people.error.message : "No se pudo cargar el personal."}
        </Alert>
      )}
      {report.isError ? (
        <Alert severity="error">
          {report.error instanceof Error ? report.error.message : "Error al consultar las asistencias."}
        </Alert>
      ) : (
        <DataTable
          data={reportRows}
          columns={columns}
          isLoading={report.isLoading || report.isFetching}
          filterKeys={["fecha", "nombres", "estadoAsistencia"]}
          searchPlaceholder="Buscar por nombre o estado..."
          emptyMessage={appliedFilters ? "No hay asistencias para los filtros seleccionados." : "Selecciona los filtros y presiona Buscar."}
          initialPageSize={50}
          persistPageSize={false}
          tableMaxHeight="65vh"
          globalFilterValue={search}
          onGlobalFilterValueChange={setSearch}
          footerContent={reportRows.length > 0 ? <span className="font-semibold text-slate-700">Días trabajados: {reportRows.length}</span> : undefined}
          toolbarLeading={
            <LocalizationProvider
              dateAdapter={AdapterDayjs}
              adapterLocale="es"
              localeText={esES.components.MuiLocalizationProvider.defaultProps.localeText}
            >
              <div className="flex w-full flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div className="flex flex-wrap items-end gap-2">
                  <TextField
                    select
                    size="small"
                    label="Personal"
                    value={personalId}
                    onChange={(event) => {
                      const nextPersonalId = event.target.value;
                      setPersonalId(nextPersonalId);
                      buscar(fechaInicio, fechaFin, nextPersonalId, reporteGeneral);
                    }}
                    disabled={reporteGeneral || people.isLoading || people.isError}
                    sx={{ minWidth: 210, "& .MuiOutlinedInput-root": { height: 44, backgroundColor: "#fff" } }}
                  >
                    <MenuItem value="">Seleccionar personal</MenuItem>
                    {(people.data ?? []).map((person) => (
                      <MenuItem key={person.personalId} value={String(person.personalId)}>
                        {person.nombres}
                      </MenuItem>
                    ))}
                  </TextField>
                  <FormControlLabel
                    className="!mr-1 !mb-1"
                    control={<Checkbox checked={reporteGeneral} onChange={(event) => setReporteGeneral(event.target.checked)} size="small" />}
                    label={<span className="text-xs text-slate-700">Reporte General</span>}
                  />
                </div>
                <div data-table-date-filter className="flex flex-wrap items-end gap-2">
                  <label className="flex min-w-[150px] flex-col gap-1 text-xs text-slate-600">
                    Fecha inicio
                    <DatePicker
                      format="DD/MM/YYYY"
                      value={fechaInicio ? dayjs(fechaInicio) : null}
                      onChange={(value: Dayjs | null) => setFechaInicio(value?.isValid() ? value.format("YYYY-MM-DD") : "")}
                      slotProps={{
                        textField: {
                          size: "small",
                          sx: {
                            width: 155,
                            "& .MuiOutlinedInput-root": {
                              height: 44,
                              backgroundColor: "#fff",
                            },
                          },
                        },
                      }}
                    />
                  </label>
                  <label className="flex min-w-[150px] flex-col gap-1 text-xs text-slate-600">
                    Fecha fin
                    <DatePicker
                      format="DD/MM/YYYY"
                      value={fechaFin ? dayjs(fechaFin) : null}
                      onChange={(value: Dayjs | null) => {
                        const nextFechaFin = value?.isValid() ? value.format("YYYY-MM-DD") : "";
                        setFechaFin(nextFechaFin);
                        buscar(fechaInicio, nextFechaFin, personalId, reporteGeneral);
                      }}
                      slotProps={{
                        textField: {
                          size: "small",
                          sx: {
                            width: 155,
                            "& .MuiOutlinedInput-root": {
                              height: 44,
                              backgroundColor: "#fff",
                            },
                          },
                        },
                      }}
                    />
                  </label>
                </div>
              </div>
            </LocalizationProvider>
          }
          toolbarAction={
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => buscar()} disabled={report.isFetching} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#B23636] px-3 text-sm font-semibold text-white hover:bg-[#96312a] disabled:opacity-50">
                <Search className="h-4 w-4" /> Buscar
              </button>
              <button type="button" onClick={limpiar} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                <Eraser className="h-4 w-4" /> Limpiar
              </button>
              <button type="button" onClick={abrirPdf} disabled={reportRows.length === 0 || report.isFetching || generatingPdf} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                <Printer className="h-4 w-4" /> Imprimir
              </button>
            </div>
          }
          toolbarLayout="filters-inline"
        />
      )}

    </div>
  );
}
