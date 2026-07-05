export interface OrderNoteApiItem {
  notaId?: string | number | null;
  NotaId?: string | number | null;
  documento?: string | null;
  notaDocu?: string | null;
  NotaDocu?: string | null;
  notaSerie?: string | null;
  NotaSerie?: string | null;
  notaNumero?: string | number | null;
  NotaNumero?: string | number | null;
  fecha?: string | null;
  notaFecha?: string | null;
  NotaFecha?: string | null;
  cliente?: string | null;
  clienteId?: string | number | null;
  ClienteId?: string | number | null;
  clienteRazon?: string | null;
  ClienteRazon?: string | null;
  formaPago?: string | null;
  notaFormaPago?: string | null;
  NotaFormaPago?: string | null;
  total?: string | number | null;
  notaTotal?: string | number | null;
  NotaTotal?: string | number | null;
  acuenta?: string | number | null;
  notaAcuenta?: string | number | null;
  NotaAcuenta?: string | number | null;
  saldo?: string | number | null;
  notaSaldo?: string | number | null;
  NotaSaldo?: string | number | null;
  usuario?: string | null;
  notaUsuario?: string | null;
  NotaUsuario?: string | null;
  estado?: string | null;
  notaEstado?: string | null;
  NotaEstado?: string | null;
  estadoSunat?: string | null;
  EstadoSunat?: string | null;
  notaEstadoSunat?: string | null;
  NotaEstadoSunat?: string | null;
}

export interface OrderNote {
  id: number;
  notaId: string;
  documento: string;
  fecha: string;
  cliente: string;
  formaPago: string;
  total: string;
  acuenta: string;
  saldo: string;
  usuario: string;
  estado: string;
  estadoSunat?: string;
}
