export interface Client {
  id: number;
  clienteCodigo: string;
  nombreRazon: string;
  ruc: string;
  dni: string;
  direccionFiscal: string;
  direccionDespacho: string;
  telefonoMovil: string;
  email: string;
  registradoPor: string;
  estado: string;
  fecha?: string | null;
}

export interface ApiClient {
  clienteId: number;
  clienteCodigo?: string;
  clienteRazon: string;
  clienteRuc: string;
  clienteDni: string;
  clienteDireccion: string;
  clienteTelefono: string;
  clienteCorreo: string;
  clienteEstado: string;
  clienteDespacho: string;
  clienteUsuario: string;
  clienteFecha: string | null;
}

export interface CuentaBancaria {
  entidadBancaria: string;
  moneda: string;
  tipoCuenta: string;
  numeroCuenta: string;
}

export interface Purchase {
  id: number;
  nombreRazon: string;
  ruc: string;
  contacto: string;
  celular: string;
  email: string;
  direccion: string;
  estado: "ACTIVO" | "INACTIVO";
  cuentasBancarias?: CuentaBancaria[];
}
