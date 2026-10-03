import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart, MarkElement, type MarkElementProps } from "@mui/x-charts/LineChart";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { Search } from "lucide-react";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";

type MonthSale = { month: number; monthName: string; total: number };
type SalesReport = { year: number; total: number; months: MonthSale[] };
type ChartType = "bar" | "line";

const currentYear = new Date().getFullYear();
const currency = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const axisCurrency = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 0,
});
const formatCurrency = (value: number) => currency.format(value);

async function fetchReport(year: number): Promise<SalesReport> {
  const response = await apiRequest<SalesReport>({
    url: buildApiUrl(`/SalesReport/monthly?year=${year}`),
  });
  if (!response || typeof response !== "object" || !("months" in response)) {
    throw new Error("No se pudo cargar el reporte de ventas.");
  }
  return response as SalesReport;
}

export default function SalesReportPage() {
  const [year, setYear] = useState(String(currentYear));
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [chartType, setChartType] = useState<ChartType>("bar");
  const validYear = /^\d{4}$/.test(year) && Number(year) >= 1753 && Number(year) <= currentYear;
  const report = useQuery({
    queryKey: ["sales-report", selectedYear],
    queryFn: () => fetchReport(selectedYear),
  });
  const chartMax = Math.max(...(report.data?.months.map((month) => month.total) ?? [0])) * 1.15 || 1;
  const ValueLabelMark = (props: MarkElementProps) => (
    <g>
      <MarkElement {...props} />
      <text
        x={props.x}
        y={props.y}
        dy={-10}
        textAnchor="middle"
        fontSize={10}
        fontWeight={600}
        fill="#334155"
        pointerEvents="none"
      >
        {formatCurrency(report.data?.months[props.dataIndex]?.total ?? 0)}
      </text>
    </g>
  );

  const consult = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (validYear) setSelectedYear(Number(year));
  };

  return (
    <div className="space-y-3 p-2 sm:p-4">
      <Paper
        variant="outlined"
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3"
      >
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={consult} className="flex flex-wrap items-center gap-3">
            <TextField
              label="Año"
              type="number"
              size="small"
              sx={{ width: 112 }}
              value={year}
              onChange={(event) => setYear(event.target.value)}
              slotProps={{ htmlInput: { min: 1753, max: currentYear, step: 1 } }}
              error={year.length > 0 && !validYear}
              helperText={
                year.length > 0 && !validYear
                  ? `Ingrese un año entre 1753 y ${currentYear}.`
                  : undefined
              }
            />
            <IconButton
              type="submit"
              aria-label="Consultar reporte de ventas"
              title="Consultar reporte de ventas"
              disabled={!validYear || report.isFetching}
              color="primary"
              className="h-10 w-10"
            >
              <Search size={20} />
            </IconButton>
          </form>
          <ToggleButtonGroup
            aria-label="Tipo de gráfica"
            exclusive
            size="small"
            value={chartType}
            onChange={(_, value: ChartType | null) => value && setChartType(value)}
          >
            <ToggleButton value="bar" aria-label="Columnas">Columnas</ToggleButton>
            <ToggleButton value="line" aria-label="Líneas">Líneas</ToggleButton>
          </ToggleButtonGroup>
        </div>
        {report.data && (
          <div className="flex items-baseline gap-3 border-l border-slate-200 pl-4">
            <span className="text-sm text-slate-600">Total {report.data.year}</span>
            <span className="text-xl font-semibold tabular-nums text-slate-900">{formatCurrency(report.data.total)}</span>
          </div>
        )}
      </Paper>

      {report.isLoading ? (
        <div className="flex justify-center py-16" role="status" aria-label="Cargando reporte">
          <CircularProgress />
        </div>
      ) : report.isError ? (
        <Alert severity="error">{report.error instanceof Error ? report.error.message : "Error al consultar las ventas."}</Alert>
      ) : report.data ? (
        <Paper variant="outlined" className="p-3 sm:p-5">
          {report.data.months.every((month) => month.total === 0) && (
            <Alert severity="info" className="mb-3">
              No hay ventas canceladas para el año seleccionado.
            </Alert>
          )}
          {chartType === "bar" ? (
            <BarChart
              dataset={report.data.months}
              xAxis={[{ scaleType: "band", dataKey: "monthName", label: "Mes" }]}
              yAxis={[{
                width: 120,
                max: chartMax,
                valueFormatter: (value: number) => axisCurrency.format(value),
              }]}
              series={[
                {
                  dataKey: "total",
                  label: "Ventas",
                  barLabel: (item) => formatCurrency(Number(item.value ?? 0)),
                  barLabelPlacement: "outside",
                  valueFormatter: (value) => formatCurrency(value ?? 0),
                },
              ]}
              height={440}
              margin={{ left: 140, right: 24, top: 24, bottom: 48 }}
            />
          ) : (
            <LineChart
              dataset={report.data.months}
              xAxis={[{ scaleType: "point", dataKey: "monthName", label: "Mes" }]}
              yAxis={[{
                width: 120,
                max: chartMax,
                valueFormatter: (value: number) => axisCurrency.format(value),
              }]}
              series={[
                {
                  dataKey: "total",
                  label: "Ventas",
                  showMark: true,
                  valueFormatter: (value) => formatCurrency(value ?? 0),
                },
              ]}
              slots={{ mark: ValueLabelMark }}
              height={440}
              margin={{ left: 140, right: 24, top: 24, bottom: 48 }}
            />
          )}
        </Paper>
      ) : null}
    </div>
  );
}
