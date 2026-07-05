import { create } from "zustand";
import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import type { Product } from "@/types/product";
import type { ProductUnitOption } from "@/types/product";

interface ApiProduct {
  idProducto?: number;
  idSubLinea?: number | null;
  productoCodigo?: string | null;
  productoNombre?: string | null;
  productoTipoCambio?: number | null;
  productoCostoDolar?: number | null;
  productoUM?: string | null;
  productoCosto?: number | null;
  productoVenta?: number | null;
  productoVentaB?: number | null;
  productoCantidad?: number | null;
  productoObs?: string | null;
  productoEstado?: string | null;
  productoUsuario?: string | null;
  productoFecha?: string | null;
  productoImagen?: string | null;
  valorCritico?: number | null;
  aplicaTC?: string | null;
  productoPV?: number | null;
  productoSV?: number | null;
  fechaVencimiento?: string | null;
  aplicaFechaV?: boolean | null;
  aplicaINV?: string | null;
  cantidadANT?: number | null;
  fechaModCant?: string | null;
  unidadImagen?: string | null;
  UnidadImagen?: string | null;
}

interface ProductsState {
  products: Product[];
  loading: boolean;
  fetchProducts: (estado?: "ACTIVO" | "INACTIVO" | "") => Promise<void>;
  addProduct: (
    product: Omit<Product, "id"> & {
      imageFile?: File | null;
      imageRemoved?: boolean;
      unidadImagenAlternaFile?: File | null;
    },
  ) => Promise<boolean>;
  updateProduct: (
    id: number,
    data: Omit<Product, "id"> & {
      imageFile?: File | null;
      imageRemoved?: boolean;
      unidadImagenAlternaFile?: File | null;
    },
  ) => Promise<boolean>;
  deleteProduct: (id: number) => Promise<boolean>;
}

const toNumberValue = (value: unknown, fallback = 0) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }

  const raw = String(value ?? "").trim();
  if (!raw) return fallback;

  // Soporta formatos "1234.56", "1,234.56" y "1.234,56".
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return fallback;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized = cleaned;
  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = `${parts[0].replace(/\./g, "")}.${parts[1]}`;
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeSegment = (value: unknown) =>
  String(value ?? "")
    .replace(/[|;\[\]\r\n]/g, " ")
    .trim();
const normalizePersistedImageSegment = (value: unknown) => {
  const normalized = normalizeSegment(value);
  if (!normalized) return "";
  const lower = normalized.toLowerCase();
  if (lower.startsWith("blob:") || lower.startsWith("data:")) return "";
  return normalized;
};
const normalizeUpperSegment = (value: unknown) =>
  normalizeSegment(value).toLocaleUpperCase("es-PE");

const formatDecimal = (value: unknown, decimals: number) =>
  toNumberValue(value, 0).toFixed(decimals);

const resolveAplicaINV = (value: unknown) =>
  String(value ?? "").trim().toUpperCase() === "N" ||
  String(value ?? "").trim().toLowerCase() === "servicio"
    ? "N"
    : "S";

const parseScalarId = (value: unknown): number => {
  const raw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : value &&
            typeof value === "object" &&
            "id" in (value as Record<string, unknown>)
          ? Number((value as Record<string, unknown>).id)
          : NaN;
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
};

const hasExistsMessage = (value: unknown): boolean => {
  if (typeof value === "string") {
    return value.toLowerCase().includes("existe");
  }
  if (!value || typeof value !== "object") return false;
  return Object.values(value as Record<string, unknown>).some(
    (item) => typeof item === "string" && item.toLowerCase().includes("existe"),
  );
};

const isAxiosLikeError = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return Boolean(record.isAxiosError) || ("response" in record && "config" in record);
};

const normalizeEstado = (value: unknown): Product["estado"] => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "INACTIVO") return "INACTIVO";
  if (normalized === "archivado") return "archivado";
  return "ACTIVO";
};

const parseDelimitedProducts = (rawValue: string): ApiProduct[] => {
  const raw = String(rawValue ?? "").trim();
  if (!raw || raw === "~" || raw.toUpperCase() === "FORMATO_INVALIDO") {
    return [];
  }

  return raw
    .split("¬")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): ApiProduct | null => {
      const parts = chunk.split("|");
      const at = (index: number) => String(parts[index] ?? "").trim();

      const idProducto = toNumberValue(at(0), 0);
      if (!idProducto) return null;

      const idSubLineaRaw = at(1);
      return {
        idProducto,
        idSubLinea:
          idSubLineaRaw === "" ? null : toNumberValue(idSubLineaRaw, 0),
        productoCodigo: at(2),
        productoNombre: at(3),
        productoUM: at(4),
        productoCosto: toNumberValue(at(5), 0),
        productoVenta: toNumberValue(at(6), 0),
        productoVentaB: toNumberValue(at(7), 0),
        productoCantidad: toNumberValue(at(8), 0),
        productoEstado: at(9),
        productoUsuario: at(10),
        productoFecha: at(11),
        productoImagen: at(12),
        valorCritico: toNumberValue(at(13), 0),
        aplicaINV: at(14),
        productoPV: toNumberValue(at(15), 0),
        productoSV: toNumberValue(at(16), 0),
      };
    })
    .filter((item): item is ApiProduct => Boolean(item));
};

const parseProductsResponse = (payload: unknown): ApiProduct[] => {
  if (Array.isArray(payload)) {
    return payload as ApiProduct[];
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const arrayCandidate = Object.values(record).find(Array.isArray);
    if (Array.isArray(arrayCandidate)) {
      return arrayCandidate as ApiProduct[];
    }

    const stringCandidate = Object.values(record).find(
      (value) => typeof value === "string",
    );
    if (typeof stringCandidate === "string") {
      return parseDelimitedProducts(stringCandidate);
    }

    return [];
  }

  if (typeof payload === "string") {
    return parseDelimitedProducts(payload);
  }

  return [];
};

const mapApiToProduct = (item: ApiProduct): Product => ({
  id: item.idProducto ?? 0,
  codigo: item.productoCodigo ?? "",
  nombre: item.productoNombre ?? "",
  unidadMedida: item.productoUM ?? "",
  valorCritico: toNumberValue(item.valorCritico, 0),
  preCosto: toNumberValue(item.productoCosto, 0),
  preVenta: toNumberValue(item.productoVenta, 0),
  preVentaB: toNumberValue(item.productoVentaB, 0),
  aplicaINV: String(item.aplicaINV ?? "").toUpperCase() === "N" ? "N" : "S",
  cantidad: toNumberValue(item.productoCantidad, 0),
  pv: toNumberValue(item.productoPV, 0),
  sv: toNumberValue(item.productoSV, 0),
  usuario: item.productoUsuario ?? "",
  estado: normalizeEstado(item.productoEstado),
  images: item.productoImagen ? [item.productoImagen] : [],
  idSubLinea: item.idSubLinea,
});

const mapApiToUnitOption = (item: ApiProduct): ProductUnitOption => {
  const rawItem = item as Record<string, unknown>;
  const factorValue = toNumberValue(
    rawItem.valorUM ?? rawItem.factor ?? rawItem.ValorUM ?? rawItem.Factor,
    0,
  );
  const unidadImagen = String(
    rawItem.unidadImagen ??
      rawItem.UnidadImagen ??
      item.unidadImagen ??
      item.UnidadImagen ??
      item.productoImagen ??
      "",
  ).trim();

  return {
    unidadMedida: (item.productoUM ?? "").trim(),
    cantidad: toNumberValue(item.productoCantidad, 0),
    preCosto: toNumberValue(item.productoCosto, 0),
    preVenta: toNumberValue(item.productoVenta, 0),
    preVentaB: toNumberValue(item.productoVentaB, 0),
    factor: factorValue > 0 ? factorValue : undefined,
    valorUM: factorValue > 0 ? factorValue : undefined,
    unidadImagen: unidadImagen || undefined,
  };
};

const groupProductsByHeader = (items: ApiProduct[]): Product[] => {
  if (!items.length) return [];

  const grouped = new Map<number, ApiProduct[]>();
  const orderedIds: number[] = [];

  items.forEach((item) => {
    const id = toNumberValue(item.idProducto, 0);
    if (!id) return;
    if (!grouped.has(id)) {
      grouped.set(id, []);
      orderedIds.push(id);
    }
    grouped.get(id)!.push(item);
  });

  return orderedIds
    .map((id) => {
      const rows = grouped.get(id) ?? [];
      if (!rows.length) return null;

      // El SP devuelve primero la fila base (unidad principal), luego alternas.
      // Mantener ese orden evita invertir principal/secundaria cuando la alterna
      // tiene stock convertido mayor.
      const headerRow = rows[0];

      const header = mapApiToProduct(headerRow);
      const headerUm = (headerRow.productoUM ?? "").trim().toLowerCase();
      const headerQty = toNumberValue(headerRow.productoCantidad, 0);

      const alternativas = rows
        .filter((row) => row !== headerRow)
        .filter((row) => {
          const um = (row.productoUM ?? "").trim().toLowerCase();
          return um !== "" && um !== headerUm;
        })
        .map(mapApiToUnitOption)
        .map((row) => {
          const explicitFactor = toNumberValue(row.valorUM ?? row.factor, 0);
          if (explicitFactor > 0) {
            return {
              ...row,
              factor: Number(explicitFactor.toFixed(6)),
              valorUM: Number(explicitFactor.toFixed(6)),
            };
          }

          const altQty = toNumberValue(row.cantidad, 0);
          const derivedFactor =
            headerQty > 0 && altQty > 0 ? headerQty / altQty : 0;
          if (derivedFactor > 0) {
            return {
              ...row,
              factor: Number(derivedFactor.toFixed(6)),
              valorUM: Number(derivedFactor.toFixed(6)),
            };
          }

          return row;
        });

      const uniqueAlternativas = alternativas.filter((row, idx, list) => {
        const key = row.unidadMedida.trim().toLowerCase();
        return list.findIndex((x) => x.unidadMedida.trim().toLowerCase() === key) === idx;
      });

      if (uniqueAlternativas.length > 0) {
        header.unidadesAlternas = uniqueAlternativas;
      }

      return header;
    })
    .filter((item): item is Product => Boolean(item));
};

const mapProductToApi = (
  product: Partial<Product>,
  idOverride?: number,
): ApiProduct => ({
  idProducto: idOverride ?? product.id ?? 0,
  idSubLinea:
    product.idSubLinea === undefined || product.idSubLinea === null
      ? 0
      : Number(product.idSubLinea),
  productoCodigo: product.codigo ?? "",
  productoNombre: product.nombre ?? "",
  productoUM: normalizeUpperSegment(product.unidadMedida ?? ""),
  valorCritico: product.valorCritico ?? 0,
  productoCosto: product.preCosto ?? 0,
  productoVenta: product.preVenta ?? 0,
  // Precio de venta B deshabilitado en frontend; se fuerza 0 en todos los envios.
  productoVentaB: 0,
  productoCantidad: product.cantidad ?? 0,
  productoObs: "",
  productoEstado: product.estado ?? "BUENO",
  productoUsuario: product.usuario ?? "",
  productoFecha: new Date().toISOString(),
  productoImagen: product.images?.[0] ?? "",
  productoTipoCambio: 0,
  productoCostoDolar: 0,
  aplicaTC: null,
  fechaVencimiento: null,
  aplicaFechaV: false,
  aplicaINV:
    product.aplicaINV === "N" || product.aplicaINV === "servicio" ? "N" : "S",
  cantidadANT: product.cantidad ?? 0,
  fechaModCant: null,
});

const buildProductDataString = (
  product: Partial<Product> & {
    imageFile?: File | null;
    imageRemoved?: boolean;
    aplicaOtraUnidad?: boolean;
    unidadAlterna?: string;
    unidadImagenAlterna?: string;
    unidadImagenAlternaFile?: File | null;
    unidadesPorEmpaque?: number | null;
    preVentaUnidadAlterna?: number | null;
    valorUMUnidadAlterna?: number | null;
    unidadesAlternas?: Array<{
      unidad?: string;
      unidadMedida?: string;
      factor?: number;
      valorUM?: number;
      preVenta?: number;
      unidadImagen?: string;
    }>;
  },
  payload: ApiProduct,
) => {
  const hasUploadedImage = product.imageFile instanceof File;
  const imageFromPayload = product.imageRemoved
    ? ""
    : hasUploadedImage
      ? ""
      : normalizeSegment(payload.productoImagen ?? "");

  const header = [
    String(toNumberValue(payload.idProducto, 0)),
    String(toNumberValue(payload.idSubLinea, 0)),
    normalizeSegment(payload.productoCodigo ?? ""),
    normalizeSegment(payload.productoNombre ?? ""),
    normalizeSegment(payload.productoUM ?? ""),
    formatDecimal(payload.productoCosto, 4),
    formatDecimal(payload.productoVenta, 2),
    formatDecimal(payload.productoVentaB, 2),
    formatDecimal(payload.productoCantidad, 2),
    normalizeSegment(payload.productoEstado ?? "ACTIVO"),
    normalizeSegment(payload.productoUsuario ?? ""),
    imageFromPayload,
    formatDecimal(payload.valorCritico, 2),
    resolveAplicaINV(payload.aplicaINV),
  ].join("|");

  const fromArray = Array.isArray(product.unidadesAlternas)
    ? product.unidadesAlternas
        .map((row) => ({
          unidad: normalizeUpperSegment(row?.unidad ?? row?.unidadMedida ?? ""),
          factor: toNumberValue(row?.factor ?? row?.valorUM, 0),
          preVenta: toNumberValue(row?.preVenta, 0),
          unidadImagen: normalizePersistedImageSegment(row?.unidadImagen ?? ""),
        }))
        .filter((row) => row.unidad !== "" && row.factor > 0)
    : [];

  const fallbackUnidad = normalizeUpperSegment(product.unidadAlterna ?? "");
  const fallbackFactor = toNumberValue(product.valorUMUnidadAlterna, 0);
  const fallbackUnitsPerPackage = toNumberValue(product.unidadesPorEmpaque, 0);
  const fallbackPreVentaUnidadAlterna = toNumberValue(
    product.preVentaUnidadAlterna,
    0,
  );
  const fallbackUnidadImagenAlterna = normalizePersistedImageSegment(
    product.unidadImagenAlterna ?? "",
  );
  const fallbackUnidadNormalizada = fallbackUnidad || "UNIDAD";
  const resolveDivisor = (factor: number, explicitUnitsPerPackage = 0) => {
    if (explicitUnitsPerPackage > 0) return explicitUnitsPerPackage;
    if (factor > 1) return factor;
    if (factor > 0 && factor < 1) return 1 / factor;
    return 1;
  };

  const selectedUnit =
    fromArray[0] ??
    (fallbackFactor > 0
        ? {
            unidad: fallbackUnidadNormalizada,
            factor: fallbackFactor,
            divisor: resolveDivisor(fallbackFactor, fallbackUnitsPerPackage),
            preVenta: fallbackPreVentaUnidadAlterna,
            unidadImagen: fallbackUnidadImagenAlterna || imageFromPayload,
          }
      : null);

  if (!product.aplicaOtraUnidad || !selectedUnit) {
    return header;
  }

  // Detail row for UnidadMedida: precio de venta editable desde el modal.
  const unitDivisor = resolveDivisor(
    toNumberValue(selectedUnit.factor, 0),
    toNumberValue((selectedUnit as { divisor?: unknown }).divisor, 0),
  );
  const detailVenta =
    toNumberValue(selectedUnit.preVenta, 0) > 0
      ? toNumberValue(selectedUnit.preVenta, 0)
      : toNumberValue(payload.productoVenta, 0) / unitDivisor;
  const detailVentaB = toNumberValue(payload.productoVentaB, 0) / unitDivisor;
  const detailCosto = toNumberValue(payload.productoCosto, 0) / unitDivisor;
  const detailUnidadImagen = normalizePersistedImageSegment(
    (selectedUnit as { unidadImagen?: unknown }).unidadImagen ?? imageFromPayload,
  );

  const detail = [
    selectedUnit.unidad,
    formatDecimal(selectedUnit.factor, 2),
    formatDecimal(detailVenta, 2),
    formatDecimal(detailVentaB, 2),
    formatDecimal(detailCosto, 2),
    detailUnidadImagen,
  ].join("|");

  return `${header}[${detail}]`;
};

const baseUrl = `${API_BASE_URL}/Productos`;

const buildProductFormData = (
  product: Partial<Product> & {
    imageFile?: File | null;
    imageRemoved?: boolean;
    aplicaOtraUnidad?: boolean;
    unidadAlterna?: string;
    unidadImagenAlterna?: string;
    unidadImagenAlternaFile?: File | null;
    unidadesPorEmpaque?: number | null;
    preVentaUnidadAlterna?: number | null;
    valorUMUnidadAlterna?: number | null;
    unidadesAlternas?: Array<{
      unidad?: string;
      unidadMedida?: string;
      factor?: number;
      valorUM?: number;
      preVenta?: number;
      unidadImagen?: string;
    }>;
  },
  idOverride?: number,
) => {
  const payload = mapProductToApi(product, idOverride);
  const formData = new FormData();
  const dataSerialized = buildProductDataString(product, payload);

  formData.append("Data", dataSerialized);
  formData.append("data", dataSerialized);

  Object.entries(payload).forEach(([key, value]) => {
    // El backend asigna la imagen; no enviar productoImagen.
    if (key === "productoImagen") return;
    const normalized =
      value === undefined || value === null ? "" : (value as any).toString();
    formData.append(key, normalized);
  });

  if (product.imageFile instanceof File) {
    formData.append("imagen", product.imageFile);
  }
  if (product.unidadImagenAlternaFile instanceof File) {
    formData.append("imagenUnidad", product.unidadImagenAlternaFile);
  }
  if (product.imageRemoved) {
    formData.append("eliminarImagen", "true");
  }

  return { formData, payload };
};

const toSavedApiProduct = (
  response: unknown,
  payload: ApiProduct,
  idFallback = 0,
): ApiProduct => {
  if (response && typeof response === "object" && !Array.isArray(response)) {
    return response as ApiProduct;
  }

  const idFromResponse = parseScalarId(response);
  if (idFromResponse > 0) {
    return {
      ...payload,
      idProducto: idFromResponse,
    };
  }

  if ((payload.idProducto ?? 0) > 0) return payload;
  return { ...payload, idProducto: idFallback };
};

export const useProductsStore = create<ProductsState>((set, get) => ({
  products: [],
  loading: false,

  fetchProducts: async (estado = "ACTIVO") => {
    set({ loading: true });
    try {
      const query =
        estado && estado.trim() !== ""
          ? `?estado=${encodeURIComponent(estado)}`
          : "";
      const response = await apiRequest<unknown>({
        url: `${baseUrl}/list${query}`,
        method: "GET",
        fallback: [],
      });
      const data = parseProductsResponse(response);
      set({ products: groupProductsByHeader(data), loading: false });
    } catch (error) {
      console.error("Error loading products", error);
      set({ loading: false });
    }
  },

  addProduct: async (product) => {
    try {
      set({ loading: true });
      const { formData, payload } = buildProductFormData(product, 0);
      const created = await apiRequest<unknown>({
        url: `${baseUrl}/register`,
        method: "POST",
        data: formData,
        fallback: payload,
      });

      if (isAxiosLikeError(created)) {
        return false;
      }

      if (hasExistsMessage(created)) {
        return false;
      }

      const apiSaved = toSavedApiProduct(created, payload);
      const newItem = mapApiToProduct(apiSaved);
      set((state) => ({ products: [...state.products, newItem] }));
      return true;
    } catch (error) {
      console.error("Error creating product", error);
      return false;
    } finally {
      set({ loading: false });
    }
  },

  updateProduct: async (id, data) => {
    try {
      set({ loading: true });
      const { formData, payload } = buildProductFormData(data, id);
      const updated = await apiRequest<unknown>({
        url: `${baseUrl}/register`,
        method: "POST",
        data: formData,
        fallback: payload,
      });

      if (isAxiosLikeError(updated)) {
        return false;
      }

      if (hasExistsMessage(updated)) {
        return false;
      }

      const apiSaved = toSavedApiProduct(updated, payload, id);
      const updatedItem = mapApiToProduct(apiSaved);
      set((state) => ({
        products: state.products.map((p) => (p.id === id ? updatedItem : p)),
      }));
      return true;
    } catch (error) {
      console.error("Error updating product", error);
      return false;
    } finally {
      set({ loading: false });
    }
  },

  deleteProduct: async (id) => {
    try {
      const result = await apiRequest({
        url: `${baseUrl}/${id}`,
        method: "DELETE",
        config: { headers: { Accept: "*/*" } },
        fallback: true,
      });

      set((state) => ({
        products: state.products.filter((p) => p.id !== id),
      }));

      return result !== false;
    } catch (error) {
      console.error("Error deleting product", error);
      return false;
    }
  },
}));
