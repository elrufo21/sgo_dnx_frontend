export interface CashFlow {
  id: number;
  caja: string;
  encargado: string;
  sencillo: number;
  estado: "ABIERTA" | "CERRADA";
  fechaApertura: string;
  fechaCierre?: string;
  conteoMonedas: ConteoMoneda[];
  ingresos: Movement[];
  gastos: Movement[];
  observaciones?: string;
  ventaTotal: VentaTotal;
}

export interface ConteoMoneda {
  cantidad: number;
  denominacion: number;
}

export interface Movement {
  id: number;
  descripcion: string;
  importe: number;
}

export interface VentaTotal {
  efectivo: number;
  tarjeta: number;
  deposito: number;
}

export interface CashFlowCalculated extends CashFlow {
  totalEfectivo: number;
  totalIngresos: number;
  totalGastos: number;
  efectivoCaja: number;
  ventasBO_FA: number;
  diferencial: number;
  total: number;
}
