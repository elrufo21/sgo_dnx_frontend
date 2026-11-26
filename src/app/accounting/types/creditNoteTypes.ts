export type CreditNote = {
  id: number;
  serie: string;
  numero: string;
  comprobante?: string;
  fecha: string | null;
  referencia: string;
  concepto: string;
  estado: string;
  estadoSunat: string;
  usuario: string;
  cliente: string;
  ruc: string;
  dni: string;
  subtotal: number;
  igv: number;
  total: number;
};

export type CreditNoteItem = {
  id: number;
  codigo: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  importe: number;
};

export const creditNoteMoney = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const creditNoteNumber = (note: CreditNote) => [note.serie, note.numero].filter(Boolean).join("-") || "-";
