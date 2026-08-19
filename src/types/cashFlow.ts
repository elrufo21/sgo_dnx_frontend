export interface CashFlow {
  id: number;
  fechaApertura: string;
  fechaCierre: string;
  montoInicial: number;
  ingresos: number;
  salidas: number;
  diferencia: number;
  encargado: string;
  usuario: string;
  estado: string;
  observacion: string;
}

export interface OpenCashFlow {
  usuarioId: number;
  encargado: string;
  usuario: string;
  montoInicial: number;
  observacion?: string;
}

export interface CashCount {
  denominacion: number;
  cantidad: number;
}

export interface ActiveCashFlow {
  id: number;
  fechaApertura: string;
  montoInicial: number;
  encargado: string;
  usuario: string;
  observacion: string;
  ventasEfectivo: number;
  ventasTarjeta: number;
  ventasDeposito: number;
  salidas: number;
  efectivoEsperado: number;
  monedas: CashCount[];
  estado: string;
  fechaCierre: string;
}

export interface CloseCashFlow {
  usuarioId: number;
  montoInicial?: number;
  observacion?: string;
  monedas: CashCount[];
}

export interface UpdateCashFlowState {
  estado: string;
  montoInicial?: number;
  observacion?: string;
}
