import { useEffect, useState, type FormEvent } from "react";
import { useProductsStore } from "@/store/products/products.store";
import { useProductSalesReportStore } from "@/store/reports/productSalesReport.store";
import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import Alert from "@mui/material/Alert";
import Autocomplete, { createFilterOptions } from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { Product } from "@/types/product";

type ChartType = "bar" | "line";
const currentYear = new Date().getFullYear();
const currency = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const axisCurrency = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 4,
});
const quantityFormat = new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 });
const formatCurrency = (value: number) => currency.format(value);
const filterProducts = createFilterOptions<Product>({
  stringify: (product) => `${product.nombre} ${product.codigo}`,
});

export default function ProductSalesReportPage() {
  const products = useProductsStore((state) => state.products);
  const productsLoading = useProductsStore((state) => state.loading);
  const fetchProducts = useProductsStore((state) => state.fetchProducts);
  const report = useProductSalesReportStore((state) => state.report);
  const loading = useProductSalesReportStore((state) => state.loading);
  const error = useProductSalesReportStore((state) => state.error);
  const fetchReport = useProductSalesReportStore((state) => state.fetchReport);
  const [year, setYear] = useState(String(currentYear));
  const [productId, setProductId] = useState<number | null>(null);
  const [chartType, setChartType] = useState<ChartType>("bar");
  const selectedProduct = products.find((product) => product.id === productId) ?? null;
  const validYear = /^\d{4}$/.test(year) && Number(year) >= 1753 && Number(year) <= currentYear;
  const visibleReport = report?.productId === productId && report.year === Number(year)
    ? report
    : null;

  useEffect(() => {
    if (!products.length) void fetchProducts();
  }, [products.length, fetchProducts]);

  const consult = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (validYear && productId) void fetchReport(Number(year), productId);
  };

  return (
    <div className="space-y-3 p-2 sm:p-4">
      <Paper variant="outlined" className="rounded-xl p-3 shadow-sm sm:p-4">
        <form
          onSubmit={consult}
          className="grid grid-cols-1 items-start gap-3 md:grid-cols-[112px_minmax(240px,1fr)_auto_auto]"
        >
          <TextField
            label="Año"
            type="number"
            size="small"
            fullWidth
            value={year}
            onChange={(event) => setYear(event.target.value)}
            slotProps={{ htmlInput: { min: 1753, max: currentYear, step: 1 } }}
            error={year.length > 0 && !validYear}
            helperText={year.length > 0 && !validYear ? `Ingrese un año entre 1753 y ${currentYear}.` : undefined}
          />
          <Autocomplete<Product>
            options={products}
            filterOptions={filterProducts}
            value={selectedProduct}
            loading={productsLoading}
            onChange={(_, value) => setProductId(value?.id ?? null)}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            getOptionLabel={(product) => `${product.nombre} (${product.codigo})`}
            sx={{ width: "100%" }}
            renderInput={(params) => (
              <TextField {...params} label="Producto" size="small" />
            )}
          />
          <Button
            type="submit"
            variant="contained"
            className="h-10 px-5"
            disabled={!validYear || !productId || productsLoading || loading}
          >
            Consultar
          </Button>
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
        </form>
      </Paper>

      {productsLoading && !products.length ? (
        <div className="flex justify-center py-12" role="status" aria-label="Cargando productos">
          <CircularProgress />
        </div>
      ) : products.length === 0 ? (
        <Alert severity="info">No hay productos activos para consultar.</Alert>
      ) : loading ? (
        <div className="flex justify-center py-12" role="status" aria-label="Cargando reporte">
          <CircularProgress />
        </div>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : visibleReport ? (
        <>
          {visibleReport.months.every((month) => month.amount === 0 && month.quantity === 0) && (
            <Alert severity="info">No hay ventas del producto seleccionado para el año indicado.</Alert>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Paper variant="outlined" className="rounded-xl border-l-4 border-l-indigo-500 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cantidad vendida · {visibleReport.productUnit || "unidad base"}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {quantityFormat.format(visibleReport.totalQuantity)}
              </p>
            </Paper>
            <Paper variant="outlined" className="rounded-xl border-l-4 border-l-emerald-500 p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Venta total · {visibleReport.year}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {formatCurrency(visibleReport.totalSales)}
              </p>
            </Paper>
          </div>
          <div className="grid items-start gap-3 2xl:grid-cols-[minmax(0,1.7fr)_minmax(460px,1fr)]">
            <Paper variant="outlined" className="rounded-xl p-3 shadow-sm sm:p-5">
              <div className="mb-1">
                <h2 className="text-lg font-semibold text-slate-900">Ventas mensuales</h2>
                <p className="text-sm text-slate-600">{visibleReport.productName} · {visibleReport.year}</p>
              </div>
              {chartType === "bar" ? (
                <BarChart
                  dataset={visibleReport.months}
                  xAxis={[{ scaleType: "band", dataKey: "monthName", label: "Mes" }]}
                  yAxis={[{ width: 120, valueFormatter: (value: number) => axisCurrency.format(value) }]}
                  series={[{ dataKey: "amount", label: "Venta", valueFormatter: (value) => formatCurrency(value ?? 0) }]}
                  height={370}
                  margin={{ left: 140, right: 24, top: 16, bottom: 48 }}
                />
              ) : (
                <LineChart
                  dataset={visibleReport.months}
                  xAxis={[{ scaleType: "point", dataKey: "monthName", label: "Mes" }]}
                  yAxis={[{ width: 120, valueFormatter: (value: number) => axisCurrency.format(value) }]}
                  series={[{ dataKey: "amount", label: "Venta", valueFormatter: (value) => formatCurrency(value ?? 0) }]}
                  height={370}
                  margin={{ left: 140, right: 24, top: 16, bottom: 48 }}
                />
              )}
            </Paper>
            <TableContainer component={Paper} variant="outlined" className="rounded-xl shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-base font-semibold text-slate-900">Detalle mensual</h2>
                <p className="text-sm text-slate-600">Cantidad e importe por mes</p>
              </div>
              <Table size="small" aria-label="Ventas y cantidades por mes">
                <TableHead className="bg-slate-50">
                  <TableRow>
                    <TableCell>Mes</TableCell>
                    <TableCell align="right">Cantidad ({visibleReport.productUnit || "unidad base"})</TableCell>
                    <TableCell align="right">Venta</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleReport.months.map((month) => (
                    <TableRow key={month.month} hover>
                      <TableCell>{month.monthName}</TableCell>
                      <TableCell align="right">{quantityFormat.format(month.quantity)}</TableCell>
                      <TableCell align="right">{formatCurrency(month.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>
        </>
      ) : (
        <Alert severity="info">Seleccione un año y un producto para consultar su reporte mensual.</Alert>
      )}
    </div>
  );
}
