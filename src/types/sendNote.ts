export interface SendNoteItem {
  productId?: number | null;
  codigo?: string;
  nombre?: string;
  descripcion?: string;
  unidadMedida?: string;
  cantidad?: number;
  preCosto?: number;
  descuento?: number;
  importe?: number;
}

export interface SendNote {
  id: number;
  clienteId?: number;
  formaPago: string;
  entidad: string;
  opr: string;
  cliente: string;
  ruc: string;
  dni: string;
  direccionFiscal: string;
  direccionDespacho: string;
  telefono: string;
  concepto: string;
  tipoDocumento: string;
  buscarCodigo: string;
  radioOpcion: string;
  items: SendNoteItem[];
  usuarioResponsable?: string;
  atendidoPor?: string;
  estado?: string;
  fechaEmitido?: string;
  fechaPago?: string;
  notaCondicion?: string;
  notaDocu?: string;
}
