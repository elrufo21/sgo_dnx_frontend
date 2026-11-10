import { useCallback, useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import type { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/DataTable";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { formatDate } from "@/shared/helpers/formatDate";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import { toast } from "@/shared/ui/toast";
import { creditNoteMoney, creditNoteNumber, type CreditNote } from "./creditNoteTypes";

type Range = { fechaInicio: string; fechaFin: string };
const RANGE_KEY = "sgo.accounting.credit-notes.range";

export default function CreditNotesPage() {
  const navigate = useNavigate();
  const today = getLocalDateISO();
  const initialRange = useMemo(() => {
    const fallback = { fechaInicio: `${today.slice(0, 7)}-01`, fechaFin: today };
    try {
      const saved = JSON.parse(sessionStorage.getItem(RANGE_KEY) || "null") as Partial<Range> | null;
      return saved?.fechaInicio && saved.fechaFin && saved.fechaInicio <= saved.fechaFin
        ? { fechaInicio: saved.fechaInicio, fechaFin: saved.fechaFin } : fallback;
    } catch { return fallback; }
  }, [today]);
  const form = useForm<Range>({ defaultValues: initialRange });
  const [rows, setRows] = useState<CreditNote[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (range: Range) => {
    if (!range.fechaInicio || !range.fechaFin || range.fechaInicio > range.fechaFin) {
      toast.error("Seleccione un rango de fechas válido.");
      return;
    }
    setLoading(true);
    try {
      const query = new URLSearchParams(range);
      const result = await apiRequest<unknown>({ url: buildApiUrl(`/NotasCredito?${query}`) });
      if (!Array.isArray(result)) throw new Error("Respuesta inválida");
      setRows((result as CreditNote[]).map((note) => ({ ...note, comprobante: creditNoteNumber(note) })));
      try { sessionStorage.setItem(RANGE_KEY, JSON.stringify(range)); } catch { /* El listado funciona sin almacenamiento. */ }
    } catch {
      toast.error("No se pudieron cargar las notas de crédito.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(form.getValues()); }, [form, load]);

  const columns = useMemo<ColumnDef<CreditNote, unknown>[]>(() => [
    { id: "ver", header: "Ver", cell: ({ row }) => <button type="button" className="text-sm font-medium text-blue-600 hover:underline" onClick={() => navigate(`/accounting/credit-notes/${row.original.id}`)}>Ver</button> },
    { id: "comprobante", header: "Comprobante", accessorFn: creditNoteNumber },
    { accessorKey: "fecha", header: "Fecha", cell: ({ row }) => row.original.fecha ? formatDate(row.original.fecha) : "-" },
    { accessorKey: "cliente", header: "Cliente", cell: ({ row }) => row.original.cliente || "-" },
    { id: "documento", header: "RUC/DNI", accessorFn: (row) => row.ruc || row.dni || "-" },
    { accessorKey: "referencia", header: "Documento relacionado", cell: ({ row }) => row.original.referencia || "-" },
    { accessorKey: "usuario", header: "Usuario", cell: ({ row }) => row.original.usuario || "-" },
    { accessorKey: "estado", header: "Estado", cell: ({ row }) => row.original.estado || "-" },
    { accessorKey: "estadoSunat", header: "Estado SUNAT", cell: ({ row }) => row.original.estadoSunat || "-" },
    { accessorKey: "total", header: "Total", cell: ({ row }) => creditNoteMoney(row.original.total), meta: { align: "right" } },
  ], [navigate]);

  return <div className="space-y-4 p-3 sm:p-4">
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(load)} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <BackArrowButton fallbackTo="/accounting" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-black hover:bg-slate-100" />
        <HookFormInput<Range> name="fechaInicio" label="F. inicio" type="date" />
        <HookFormInput<Range> name="fechaFin" label="F. fin" type="date" />
        <button type="submit" disabled={loading} className="h-10 rounded-md bg-[#B23636] px-4 text-sm font-semibold text-white disabled:opacity-60">Buscar</button>
      </form>
    </FormProvider>
    <DataTable data={rows} columns={columns} isLoading={loading} searchPlaceholder="Buscar nota de crédito..." filterKeys={["comprobante", "serie", "numero", "cliente", "ruc", "dni", "referencia", "usuario", "estado", "estadoSunat"]} emptyMessage="No hay notas de crédito para el rango seleccionado." initialPageSize={50} tableMaxHeight="68vh" />
  </div>;
}
