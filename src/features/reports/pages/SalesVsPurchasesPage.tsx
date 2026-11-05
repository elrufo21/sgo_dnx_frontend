import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { BarChart } from "@mui/x-charts/BarChart";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";

type Filters = { year: string; month: string };
type CompanyRow = { companyId: number; companyName: string; sales: number; purchases: number };
type Report = { year: number; month: number; rows: CompanyRow[] };
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const currency = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });

async function fetchReport(year: number, month: number): Promise<Report> {
  const response = await apiRequest<Report>({ url: buildApiUrl(`/SalesReport/sales-vs-purchases?year=${year}&month=${month}`) });
  if (!response || typeof response !== "object" || response.year !== year || response.month !== month || !Array.isArray(response.rows) ||
    response.rows.some((row) => !Number.isFinite(row.sales) || !Number.isFinite(row.purchases))) {
    throw new Error("No se pudo cargar el reporte. Inténtalo nuevamente.");
  }
  return response;
}

export default function SalesVsPurchasesPage() {
  const [today] = useState(() => new Date());
  const methods = useForm<Filters>({ defaultValues: { year: String(today.getFullYear()), month: String(today.getMonth() + 1) } });
  const year = useWatch({ control: methods.control, name: "year" });
  const month = useWatch({ control: methods.control, name: "month" });
  const validYear = /^\d{4}$/.test(year) && Number(year) >= 1753 && Number(year) <= today.getFullYear();
  const report = useQuery({ queryKey: ["sales-vs-purchases", year, month], queryFn: () => fetchReport(Number(year), Number(month)), enabled: validYear && Number(month) >= 1 && Number(month) <= 12 });
  const rows = report.data?.rows ?? [];
  const highestAmount = Math.max(0, ...rows.flatMap((row) => [row.sales, row.purchases]));

  return <div className="space-y-4 p-2 sm:p-4">
    <Paper variant="outlined" className="p-4">
      <HookForm methods={methods} onSubmit={() => { if (validYear) void report.refetch(); }} className="flex flex-wrap items-end gap-3">
        <div className="w-36"><HookFormInput<Filters> name="year" label="Año" type="number" min={1753} max={today.getFullYear()} step={1} /></div>
        <div className="w-44"><HookFormSelect<Filters> name="month" label="Mes" options={monthNames.map((label, index) => ({ value: String(index + 1), label }))} /></div>
        <button type="submit" disabled={!validYear || report.isFetching} className="h-10 rounded-lg bg-red-700 px-4 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">Consultar</button>
      </HookForm>
      {!validYear && <p className="mt-2 text-sm text-red-700">Ingresa un año válido entre 1753 y {today.getFullYear()}.</p>}
    </Paper>
    {validYear && report.isLoading ? <div className="flex justify-center py-16" role="status" aria-label="Cargando reporte"><CircularProgress /></div> :
      validYear && report.isError ? <Alert severity="error">{report.error instanceof Error ? report.error.message : "No se pudo consultar el reporte."}</Alert> :
      validYear && report.data ? <Paper variant="outlined" className="p-3 sm:p-5">
        <h2 className="text-center text-lg font-semibold text-slate-800">Ventas vs. Compras · {monthNames[Number(month) - 1]} {year}</h2>
        {rows.length === 0 ? <Alert severity="info" className="mt-4">El procedimiento no devolvió datos para tu compañía en el período seleccionado.</Alert> :
          <BarChart dataset={rows} xAxis={[{ scaleType: "band", dataKey: "companyName", categoryGapRatio: 0.65 }]} yAxis={[{ width: 120, max: highestAmount > 0 ? highestAmount * 1.15 : undefined, valueFormatter: (value: number) => currency.format(value) }]}
            series={[
              { dataKey: "sales", label: "Monto Ventas", color: "#4085e3", barLabel: (item) => currency.format(Number(item.value ?? 0)), barLabelPlacement: "outside", valueFormatter: (value) => currency.format(value ?? 0) },
              { dataKey: "purchases", label: "Monto Compras", color: "#ffb43e", barLabel: (item) => currency.format(Number(item.value ?? 0)), barLabelPlacement: "outside", valueFormatter: (value) => currency.format(value ?? 0) },
            ]} height={440} margin={{ left: 140, right: 24, top: 32, bottom: 70 }} />}
      </Paper> : null}
  </div>;
}
