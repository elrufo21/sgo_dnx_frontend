export interface BoletaSummaryDocument {
  id: number;
  docuId: number;
  companiaId: number;
  notaId: number;
  fechaEmision: string;
  docuDocumento: string;
  serieNumero: string;
  cliente: string;
  clienteDni: string;
  subTotal: string;
  igv: string;
  icbper: string;
  total: string;
  usuario: string;
  estadoSunat: string;
}

export interface BoletaSummarySentRecord {
  id: number;
  resumenId: number;
  companiaId: number;
  fechaEmision: string;
  fechaEnvio: string;
  serie: string;
  secuencia?: string;
  rangoNumeros: string;
  subTotal: string;
  igv: string;
  icbper: string;
  total: string;
  ticket: string;
  codigoSunat: string;
  hashCdr: string;
  cdr?: string;
  tieneCdr?: string;
  mensaje: string;
  usuario: string;
  ruc?: string;
  usuarioSolEmpresa?: string;
  passSolEmpresa?: string;
  tipoDocumento?: string;
  tipoProceso?: number;
  intentos?: number;
  estado: string;
}

export interface BoletaSummarySendDetailPayload {
  item: number;
  tipoComprobante: string;
  nroComprobante: string;
  tipoDocumento: string;
  nroDocumento: string;
  tipoComprobanteRef?: string;
  nroComprobanteRef?: string;
  statu: string;
  codMoneda: string;
  total: number;
  icbper: number;
  gravada: number;
  isc?: number;
  igv: number;
  otros?: number;
  cargoXAsignacion?: number;
  montoCargoXAsig?: number;
  exonerado?: number;
  inafecto?: number;
  exportacion?: number;
  gratuitas?: number;
  docuId: number;
  notaId?: number;
}

export interface BoletaSummarySendBajaDetailPayload {
  item: number;
  tipoComprobante: string;
  nroComprobante: string;
  descripcion: string;
  docuId: number;
  notaId?: number;
}

interface BoletaSummaryBasePayload {
  NRO_DOCUMENTO_EMPRESA: string;
  RAZON_SOCIAL: string;
  USUARIO?: string;
  Usuario?: string;
  usuario?: string;
  USUARIO_REGISTRO?: string;
  TIPO_DOCUMENTO: string;
  CODIGO: string;
  SERIE: string;
  SECUENCIA: string;
  FECHA_REFERENCIA: string;
  FECHA_DOCUMENTO: string;
  TIPO_PROCESO: string | number;
  CONTRA_FIRMA: string;
  USUARIO_SOL_EMPRESA: string;
  PASS_SOL_EMPRESA: string;
  RUTA_PFX: string;
  COMPANIA_ID: number;
}

export interface BoletaSummarySendPayload extends BoletaSummaryBasePayload {
  detalle: BoletaSummarySendDetailPayload[];
  RANGO_NUMEROS: string;
  SUBTOTAL: number;
  IGV: number;
  ICBPER: number;
  TOTAL: number;
}

export interface BoletaSummarySendBajaPayload
  extends BoletaSummaryBasePayload {
  detalle: BoletaSummarySendBajaDetailPayload[];
}

export interface BoletaSummarySendResponse {
  ok: boolean;
  flg_rta: string;
  aceptado: boolean | null;
  http_status: number | null;
  mensaje: string;
  cod_sunat: string;
  msj_sunat: string;
  hash_cpe: string;
  hash_cdr: string;
  ticket: string;
  entorno_usado: string;
  tipo_proceso_usado: number | null;
  registro_bd: {
    ok: boolean;
    mensaje: string;
    resultado: string;
    accion_bd?: string;
    cod_sunat?: string;
    msj_sunat?: string;
  };
}

export interface BoletaSummaryConsultPayload {
  RESUMEN_ID: number;
  TICKET: string;
  CODIGO_SUNAT: string;
  MENSAJE_SUNAT: string;
  ESTADO: string;
  SECUENCIA: string;
  RUC: string;
  USUARIO_SOL_EMPRESA: string;
  PASS_SOL_EMPRESA: string;
  TIPO_DOCUMENTO: string;
  TIPO_PROCESO: number;
  INTENTOS: number;
}

export interface BoletaSummaryConsultResponse {
  ok: boolean;
  accion: string;
  mensaje: string;
  intentos: number | null;
  cod_sunat: string;
  msj_sunat: string;
  hash_cdr: string;
  hash_cpe: string;
  cdr_recibido: boolean;
  cdr_base64: string;
  requiere_reenvio: boolean;
}
