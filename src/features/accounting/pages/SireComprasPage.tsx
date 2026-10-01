import DataTable from "@/components/DataTable";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Workbook } from "exceljs";
import { Download, FileSpreadsheet, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

type Filter = { periodo: string };
type Row = Record<string, string>;
const helper = createColumnHelper<Row>();

const rowsFrom = (value: unknown, depth = 0): Row[] => {
  if (depth > 4 || value == null) return [];
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item && typeof item === "object" && !Array.isArray(item))
        return Object.fromEntries(Object.entries(item).map(([key, cell]) => [key, typeof cell === "object" ? JSON.stringify(cell) : String(cell ?? "")]));
      return { registro: String(item ?? "") };
    });
  }
  if (typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  for (const key of ["registros", "records", "data", "detalle", "items", "comprobantes"]) {
    if (key in record) {
      const rows = rowsFrom(record[key], depth + 1);
      if (rows.length) return rows;
    }
  }
  for (const nested of Object.values(record)) {
    const rows = rowsFrom(nested, depth + 1);
    if (rows.length) return rows;
  }
  return [];
};

export default function SireComprasPage() {
  const methods = useForm<Filter>({ defaultValues: { periodo: new Date().toISOString().slice(0, 7) } });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const keys = useMemo(() => [...new Set(rows.slice(0, 20).flatMap((row) => Object.keys(row)))].slice(0, 40), [rows]);
  const columns = useMemo(() => keys.map((key) => helper.accessor((row) => row[key] ?? "", { id: key, header: key })), [keys]);

  const search = async ({ periodo }: Filter) => {
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      toast.error("Selecciona un periodo válido.");
      return;
    }
    setLoading(true);
    const query = new URLSearchParams({ periodo: periodo.replace("-", "") });
    const response = await apiRequest<unknown>({
      url: `${buildApiUrl("/sunat/sire/compras")}?${query}`,
      config: { timeout: 180000 },
      fallback: null,
    });
    if (!response || (typeof response === "object" && "isAxiosError" in response)) {
      setRows([]);
      toast.error("No se pudo consultar compras SIRE. Revisa la configuración y vuelve a intentar.");
    } else {
      const resultRows = rowsFrom(response);
      setRows(resultRows);
      if (!resultRows.length) toast.info("SIRE no devolvió registros para el periodo.");
    }
    setLoading(false);
  };

  const exportExcel = async () => {
    if (!rows.length || !columns.length) return;
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet("Compras SIRE");
    sheet.columns = keys.map((key) => ({
      header: key,
      key,
      width: 22,
    }));
    rows.forEach((row) => sheet.addRow(row));
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB23636" } };
    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `sire-compras-${methods.getValues("periodo").replace("-", "")}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 px-2 py-2 sm:px-1">
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <BackArrowButton fallbackTo="/accounting" />
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#B23636]/10 text-[#B23636]"><FileSpreadsheet className="h-5 w-5" /></div>
        <div><h1 className="text-xl font-semibold text-slate-950">Compras SIRE</h1><p className="text-sm text-slate-600">Consulta la propuesta RCE por periodo tributario.</p></div>
      </div>
      <HookForm methods={methods} onSubmit={search} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="w-52"><HookFormInput<Filter> name="periodo" label="Periodo" type="month" rules={{ required: "Selecciona un periodo." }} /></div>
        <button type="submit" disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#B23636] px-4 text-sm font-semibold text-white hover:bg-[#9f2e2e] disabled:opacity-60"><Search className="h-4 w-4" />{loading ? "Consultando..." : "Consultar"}</button>
        <button type="button" onClick={() => void exportExcel()} disabled={!rows.length || loading} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Download className="h-4 w-4" />Excel</button>
      </HookForm>
      <DataTable data={rows} columns={columns as ColumnDef<Row, unknown>[]} isLoading={loading} emptyMessage="Selecciona un periodo para consultar compras SIRE." initialPageSize={20} pageSizeOptions={[10, 20, 50, 100]} tableMaxHeight="65vh" />
    </div>
  );
}
