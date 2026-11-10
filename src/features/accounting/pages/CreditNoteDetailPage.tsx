import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { pdf } from "@react-pdf/renderer";
import { FileDown } from "lucide-react";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import ButtonComponent from "@/components/inputs/addButton";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { downloadBrowserFile } from "@/shared/helpers/downloadBrowserFile";
import { formatDate } from "@/shared/helpers/formatDate";
import { toast } from "@/shared/ui/toast";
import { useAuthStore } from "@/store/auth/auth.store";
import { CreditNotePdf } from "./CreditNotePdf";
import { creditNoteMoney, creditNoteNumber, type CreditNote, type CreditNoteItem } from "./creditNoteTypes";

type Detail = { nota: CreditNote; detalles: CreditNoteItem[]; ventaNotaId: number | null };

function DetailField({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0">
    <p className="mb-1 text-xs text-slate-500">{label}</p>
    <p className="min-h-9 break-words rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{value || "-"}</p>
  </div>;
}

export default function CreditNoteDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setDetail(null);
    void apiRequest<unknown>({ url: buildApiUrl(`/NotasCredito/${encodeURIComponent(id ?? "")}`) }).then((response) => {
      if (!active) return;
      const data = response as Partial<Detail> | null;
      if (!data?.nota || !Array.isArray(data.detalles)) setError("No se pudo cargar la nota de crédito.");
      else setDetail(data as Detail);
      setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  const note = detail?.nota;
  const downloadPdf = async () => {
    if (!detail || downloading) return;
    setDownloading(true);
    try {
      const blob = await pdf(<CreditNotePdf note={detail.nota} items={detail.detalles} company={{
        name: user?.companyName || user?.companyCommercialName,
        ruc: user?.companyRuc, address: user?.companySunatAddress,
      }} />).toBlob();
      const filename = creditNoteNumber(detail.nota).replace(/[^a-zA-Z0-9_-]/g, "_");
      await downloadBrowserFile(blob, `nota-credito-${filename}.pdf`);
    } catch {
      toast.error("No se pudo generar el PDF de la nota de crédito.");
    } finally {
      setDownloading(false);
    }
  };
  return <div className="sale-capture-layout mx-auto w-full min-w-0 max-w-[1760px] space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <BackArrowButton fallbackTo="/accounting/credit-notes" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50" />
      {note && <span className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700">
        Fecha: {note.fecha ? formatDate(note.fecha) : "-"} · Usuario: {note.usuario || "-"}
      </span>}
      {note && <div className="ml-auto"><ButtonComponent variant="outlined" size="small" icon={<FileDown className="h-4 w-4" />} onClick={() => void downloadPdf()} disabled={downloading}>
        {downloading ? "Generando..." : "Descargar PDF"}
      </ButtonComponent></div>}
    </div>
    {loading && <p className="text-sm text-slate-600">Cargando nota de crédito...</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {note && detail && <div className="grid min-w-0 gap-4 desktop:grid-cols-[minmax(0,1fr)_minmax(20rem,32%)] 2xl:grid-cols-[minmax(0,1fr)_440px] desktop:items-start">
      <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-4">
          <span className="inline-flex rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold uppercase text-red-700">Nota de crédito</span>
        </div>
        <div className="max-h-[46vh] overflow-auto">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-400">
              <tr>{["Código", "Descripción", "Cantidad", "Precio", "Importe"].map((label, index) => <th key={label} className={`border-b border-slate-100 px-4 py-2 font-medium ${index > 1 ? "text-right" : "text-left"}`}>{label}</th>)}</tr>
            </thead>
            <tbody>
              {detail.detalles.length === 0 ? <tr><td colSpan={5} className="px-5 py-14 text-center text-slate-400">Esta nota de crédito no tiene detalles registrados.</td></tr> :
                detail.detalles.map((item) => <tr key={item.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-500">{item.codigo || "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{item.descripcion || "-"}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{item.cantidad}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{creditNoteMoney(item.precio)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{creditNoteMoney(item.importe)}</td>
                </tr>)}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-sm">
          <span className="font-semibold text-slate-600">Items: {detail.detalles.length}</span>
          <div className="flex flex-wrap items-center gap-4 text-slate-600">
            <span>Sub total <strong>{creditNoteMoney(note.subtotal)}</strong></span>
            <span>IGV <strong>{creditNoteMoney(note.igv)}</strong></span>
            <span className="border-l border-slate-200 pl-4 font-semibold text-slate-900">Total S/ {creditNoteMoney(note.total)}</span>
          </div>
        </div>
      </section>
      <section className="min-w-0 space-y-5 rounded-lg border border-slate-200 bg-white p-4">
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase text-slate-400">Documento</h2>
          <DetailField label="Nota de crédito" value={creditNoteNumber(note)} />
          {detail.ventaNotaId && detail.ventaNotaId > 0 ? <div className="min-w-0">
            <p className="mb-1 text-xs text-slate-500">Nro. asociado</p>
            <Link to={`/sales/html_capture/${detail.ventaNotaId}`} state={{ creditNoteReturn: `/accounting/credit-notes/${note.id}`, creditNoteNumber: creditNoteNumber(note), relatedSaleNumber: note.referencia }} className="flex min-h-9 items-center break-words rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-blue-700 hover:underline">
              {note.referencia || "Ver venta asociada"}
            </Link>
          </div> : <DetailField label="Nro. asociado" value={note.referencia} />}
          <DetailField label="Concepto" value={note.concepto} />
          <div className="grid grid-cols-2 gap-2">
            <DetailField label="Estado" value={note.estado} />
            <DetailField label="Estado SUNAT" value={note.estadoSunat} />
          </div>
        </div>
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <h2 className="text-xs font-semibold uppercase text-slate-400">Cliente</h2>
          <DetailField label="Cliente" value={note.cliente} />
          <div className="grid grid-cols-2 gap-2">
            <DetailField label="DNI" value={note.dni} />
            <DetailField label="RUC" value={note.ruc} />
          </div>
        </div>
      </section>
    </div>}
  </div>;
}
