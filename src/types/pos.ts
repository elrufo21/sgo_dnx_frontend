export interface PosCartItem {
  productId: number;
  codigo: string;
  codigoSunat?: string;
  nombre: string;
  unidadMedida?: string;
  precio: number;
  precioMinimo?: number;
  cantidad: number;
  valorUM?: number;
  pv?: number;
  sv?: number;
  stock?: number;
  detalleId?: number;
}

export interface PosTotals {
  subTotal: number;
  total: number;
  itemCount: number;
}
