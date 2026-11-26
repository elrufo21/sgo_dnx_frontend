export interface Shopping {
  id: number;
  providerId?: number | null;
  concepto: string;
  proveedor: string;
  descripcion: string;
  ruc: string;
  fechaEmision: string;
  documento: string;
  serie: string;
  numero: string;
  condicion: string;
  moneda: string;
  diasPlazo: number;
  fechaPago: string;
  tipoIgv: string;
  tipoCambio: number;
  items?: ShoppingItem[];
}

export interface ShoppingItem {
  productId: number | null;
  codigo?: string;
  nombre?: string;
  unidadMedida?: string;
  stock?: number;
  preCosto?: number;
  preVenta?: number;
  cantidad: number;
  descuento?: number;
  importe?: number;
}

export type ShoppingFormData = Omit<Shopping, "id">;
