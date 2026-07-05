export interface ProductUnitOption {
  unidad?: string;
  unidadMedida: string;
  cantidad: number;
  preCosto: number;
  preVenta: number;
  preVentaB: number | string;
  factor?: number;
  valorUM?: number;
  unidadImagen?: string;
}

export interface Product {
  id: number;
  idSubLinea?: number | null;
  categoria?: string;
  codigo: string;
  nombre: string;
  unidadMedida: string;
  valorCritico: number;
  preCosto: number;
  preVenta: number;
  preVentaB: number | string;
  aplicaINV: "bien" | "servicio" | "S" | "N";
  cantidad: number;
  pv?: number;
  sv?: number;
  usuario: string;
  estado: "ACTIVO" | "INACTIVO" | "archivado";
  images?: string[];
  unidadesAlternas?: ProductUnitOption[];
}
