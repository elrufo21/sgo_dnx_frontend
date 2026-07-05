export interface Category {
  id?: string | number;
  idSubLinea?: number;
  nombreSublinea: string;
  codigoSunat: string;
  nombre?: string | null;
}

export interface Area {
  id: number;
  area: string;
}

export interface Computer {
  id: number;
  maquina: string;
  registro: string;
  serieFactura: string;
  serieNc: string;
  serieBoleta: string;
  ticketera: string;
  areaId: number;
}

export interface ProviderBankAccount {
  cuentaId?: number;
  proveedorId?: number;
  entidad: string;
  tipoCuenta: string;
  moneda: string;
  nroCuenta: string;
  action?: "i" | "u" | "d";
}

export interface Provider {
  id: number;
  razon: string;
  ruc: string;
  contacto: string;
  celular: string;
  telefono: string;
  correo: string;
  direccion: string;
  estado: string;
  imagen?: string | null;
  images?: string[];
  cuentasBancarias?: ProviderBankAccount[];
}

export interface Holiday {
  id: number;
  fecha: string;
  motivo: string;
}

export interface BankEntity {
  id: number;
  nombre: string;
}
