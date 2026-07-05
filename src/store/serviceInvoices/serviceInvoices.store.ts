import { create } from "zustand";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import type {
  ServiceInvoiceFilters,
  ServiceInvoiceCorrelative,
  ServiceProduct,
  ServiceProductFilters,
  ServiceInvoiceListDetail,
  ServiceInvoiceListItem,
  ServiceInvoicePayloadDetail,
  ServiceInvoiceSendPayload,
  ServiceInvoiceCreditNotePayload,
} from "@/types/serviceInvoice";

interface ServiceInvoicesState {
  invoices: ServiceInvoiceListItem[];
  loading: boolean;
  sending: boolean;
  correlativeLoading: boolean;
  serviceProducts: ServiceProduct[];
  serviceProductsLoading: boolean;
  error: string | null;
  fetchInvoices: (filters?: ServiceInvoiceFilters) => Promise<void>;
  fetchInvoiceById: (docuId: number) => Promise<ServiceInvoiceListItem | null>;
  fetchCorrelative: (
    companiaId: number,
    serie?: string,
  ) => Promise<ServiceInvoiceCorrelative | null>;
  fetchServiceProducts: (filters?: ServiceProductFilters) => Promise<void>;
  sendInvoice: (payload: ServiceInvoiceSendPayload) => Promise<unknown>;
  sendCreditNote: (
    payload: ServiceInvoiceCreditNotePayload,
  ) => Promise<unknown>;
}

const safeText = (value: unknown, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const safeNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeDateOnly = (value: unknown) => {
  const text = safeText(value);
  return text.includes("T") ? text.split("T")[0] : text;
};

const mapApiDetail = (item: unknown): ServiceInvoiceListDetail => {
  const row = (item ?? {}) as Record<string, unknown>;
  const cantidad = safeNumber(
    row.detalleCant ?? row.DetalleCant ?? row.cantidad,
  );
  const importe = safeNumber(row.importe ?? row.Importe);
  const precioConIgv = safeNumber(
    row.precio ??
      row.Precio ??
      row.detallePrecio ??
      row.DetallePrecio ??
      row.precioConIgv ??
      row.PrecioConIgv,
  );
  const precioSinImpuesto = safeNumber(
    row.precioSinImpuesto ?? row.PrecioSinImpuesto,
  );

  return {
    detalleCompraId: safeNumber(
      row.detalleCompraId ??
        row.DetalleCompraId ??
        row.detalleId ??
        row.DetalleId,
    ),
    compraId: safeNumber(
      row.compraId ?? row.CompraId ?? row.docuId ?? row.DocuId,
    ),
    productId:
      row.idProducto === null || row.IdProducto === null
        ? null
        : safeNumber(row.idProducto ?? row.IdProducto),
    codigoProducto: safeText(row.codigoProducto ?? row.CodigoProducto),
    codigoSunat: safeText(row.codigoSunat ?? row.CodigoSunat),
    unidadMedida: safeText(row.unidadMedida ?? row.UnidadMedida),
    detalleDesc: safeText(
      row.detalleDesc ??
        row.DetalleDesc ??
        row.descripcion ??
        row.Descripcion ??
        row.productoNombre ??
        row.ProductoNombre,
    ),
    detalleCant: cantidad,
    detallePrecio:
      precioConIgv ||
      (precioSinImpuesto ? Number((precioSinImpuesto * 1.18).toFixed(2)) : 0) ||
      (cantidad > 0 && importe > 0
        ? Number(((importe * 1.18) / cantidad).toFixed(2))
        : 0),
    importe,
  };
};

const parseArrayResponse = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const record = payload as Record<string, unknown>;
  const candidate = Object.values(record).find(Array.isArray);
  return Array.isArray(candidate) ? candidate : [];
};

const mapApiServiceProduct = (item: unknown): ServiceProduct => {
  const row = (item ?? {}) as Record<string, unknown>;

  return {
    id: safeNumber(row.idProducto ?? row.IdProducto ?? row.id ?? row.Id),
    idSubLinea:
      row.idSubLinea === null || row.IdSubLinea === null
        ? null
        : safeNumber(row.idSubLinea ?? row.IdSubLinea),
    codigo: safeText(row.productoCodigo ?? row.ProductoCodigo),
    nombre: safeText(row.productoNombre ?? row.ProductoNombre),
    unidadMedida: safeText(row.productoUM ?? row.ProductoUM, "ZZ"),
    costo: safeNumber(row.productoCosto ?? row.ProductoCosto),
    venta: safeNumber(row.productoVenta ?? row.ProductoVenta),
    estado: safeText(row.productoEstado ?? row.ProductoEstado, "ACTIVO"),
    aplicaINV: safeText(row.aplicaINV ?? row.AplicaINV, "N"),
    codigoSunat: safeText(
      row.codigoSunat ??
        row.CodigoSunat ??
        row.codSunat ??
        row.CodSunat ??
        row.productoCodigoSunat ??
        row.ProductoCodigoSunat,
    ),
  };
};

const mapApiItem = (item: unknown): ServiceInvoiceListItem => {
  const row = (item ?? {}) as Record<string, unknown>;
  const compra = (row.cabecera ??
    row.Cabecera ??
    row.compra ??
    row.Compra ??
    {}) as Record<string, unknown>;
  const detallesRaw = row.detalles ?? row.Detalles;
  const source = Object.keys(compra).length ? compra : row;

  return {
    compra: {
      compraId: safeNumber(
        source.compraId ?? source.CompraId ?? source.docuId ?? source.DocuId,
      ),
      notaId:
        source.notaId === null || source.NotaId === null
          ? null
          : safeNumber(source.notaId ?? source.NotaId),
      companiaId: safeNumber(source.companiaId ?? source.CompaniaId),
      documento: safeText(source.documento ?? source.Documento),
      tipoCodigo: safeText(source.tipoCodigo ?? source.TipoCodigo),
      compraConcepto: safeText(
        source.compraConcepto ?? source.CompraConcepto ?? source.concepto,
      ),
      serie: safeText(source.serie ?? source.compraSerie ?? source.CompraSerie),
      numero: safeText(
        source.numero ?? source.compraNumero ?? source.CompraNumero,
      ),
      nroComprobante: safeText(source.nroComprobante ?? source.NroComprobante),
      fechaEmision: normalizeDateOnly(
        source.fechaEmision ?? source.FechaEmision,
      ),
      fechaVto: normalizeDateOnly(
        source.fechaVto ??
          source.FechaVto ??
          source.fechaVencimiento ??
          source.FechaVencimiento ??
          source.fechaVenc ??
          source.FechaVenc,
      ),
      fechaVencimiento: normalizeDateOnly(
        source.fechaVencimiento ??
          source.FechaVencimiento ??
          source.fechaVto ??
          source.FechaVto ??
          source.fechaVenc ??
          source.FechaVenc,
      ),
      fechaRegistro: safeText(
        source.fechaRegistro ??
          source.FechaRegistro ??
          source.docuFechaRegistro ??
          source.DocuFechaRegistro,
      ),
      clienteId: safeNumber(source.clienteId ?? source.ClienteId),
      clienteRazon: safeText(source.clienteRazon ?? source.ClienteRazon),
      clienteRuc: safeText(source.clienteRuc ?? source.ClienteRuc),
      clienteDni: safeText(source.clienteDni ?? source.ClienteDni),
      direccionFiscal: safeText(
        source.direccionFiscal ?? source.DireccionFiscal,
      ),
      subTotal: safeNumber(
        source.subTotal ?? source.SubTotal ?? source.compraSubTotal,
      ),
      igv: safeNumber(source.igv ?? source.Igv ?? source.IGV),
      total: safeNumber(
        source.total ?? source.compraTotal ?? source.CompraTotal,
      ),
      saldo: safeNumber(source.saldo ?? source.Saldo),
      montoDetraccion: safeNumber(
        source.montoDetraccion ?? source.MontoDetraccion,
      ),
      letras: safeText(source.letras ?? source.Letras),
      estado: safeText(
        source.estado ??
          source.compraEstado ??
          source.CompraEstado ??
          source.docuEstado ??
          source.DocuEstado,
      ),
      estadoSunat: safeText(source.estadoSunat ?? source.EstadoSunat),
      codigoSunat: safeText(source.codigoSunat ?? source.CodigoSunat),
      mensajeSunat: safeText(source.mensajeSunat ?? source.MensajeSunat),
      anuladoPorDocuNumero: safeText(
        source.anuladoPorDocuNumero ??
          source.AnuladoPorDocuNumero ??
          row.anuladoPorDocuNumero ??
          row.AnuladoPorDocuNumero,
      ),
      anuladoPorNroComprobante: safeText(
        source.anuladoPorNroComprobante ??
          source.AnuladoPorNroComprobante ??
          row.anuladoPorNroComprobante ??
          row.AnuladoPorNroComprobante,
      ),
      docuHash: safeText(
        source.docuHash ?? source.DocuHash ?? source.hashCpe ?? source.HashCpe,
      ),
      formaPago: safeText(source.formaPago ?? source.FormaPago),
      condicion: safeText(source.condicion ?? source.Condicion),
      origenModulo: safeText(source.origenModulo ?? source.OrigenModulo),
      totalDetalles: safeNumber(source.totalDetalles ?? source.TotalDetalles),
      xmlUrl: safeText(source.xmlUrl ?? source.XmlUrl),
      pdfUrl: safeText(source.pdfUrl ?? source.PdfUrl),
      cdrUrl: safeText(source.cdrUrl ?? source.CdrUrl),
    },
    detalles: Array.isArray(detallesRaw) ? detallesRaw.map(mapApiDetail) : [],
  };
};

const isAxiosLikeError = (value: unknown) =>
  Boolean(
    value &&
    typeof value === "object" &&
    "isAxiosError" in (value as Record<string, unknown>),
  );

const buildQuery = (filters?: ServiceInvoiceFilters) => {
  const params = new URLSearchParams();
  const estado = safeText(filters?.estado);
  const fechaInicio = safeText(filters?.fechaInicio);
  const fechaFin = safeText(filters?.fechaFin);
  const page = Number(filters?.page ?? 1);
  const pageSize = Number(filters?.pageSize ?? 50);

  if (estado) params.set("estado", estado);
  if (fechaInicio) params.set("fechaInicio", fechaInicio);
  if (fechaFin) params.set("fechaFin", fechaFin);
  if (Number.isFinite(page) && page > 0) params.set("page", String(page));
  if (Number.isFinite(pageSize) && pageSize > 0) {
    params.set("pageSize", String(pageSize));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
};

const buildCorrelativeQuery = (companiaId: number, serie?: string) => {
  const params = new URLSearchParams();
  params.set("companiaId", String(companiaId || 1));

  const normalizedSerie = safeText(serie).toUpperCase();
  if (normalizedSerie) params.set("serie", normalizedSerie);

  return `?${params.toString()}`;
};

const buildServiceProductsQuery = (filters?: ServiceProductFilters) => {
  const params = new URLSearchParams();
  const estado = safeText(filters?.estado, "ACTIVO");
  const nombre = safeText(filters?.nombre);
  const page = Number(filters?.page ?? 1);
  const pageSize = Number(filters?.pageSize ?? 100);

  if (estado) params.set("estado", estado);
  if (nombre) params.set("nombre", nombre);
  if (Number.isFinite(page) && page > 0) params.set("page", String(page));
  if (Number.isFinite(pageSize) && pageSize > 0) {
    params.set("pageSize", String(pageSize));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
};

const sortInvoicesByIdDesc = (
  invoices: ServiceInvoiceListItem[],
): ServiceInvoiceListItem[] =>
  [...invoices].sort(
    (left, right) => right.compra.compraId - left.compra.compraId,
  );

const mapCorrelative = (payload: unknown): ServiceInvoiceCorrelative | null => {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  const nroComprobante = safeText(row.nroComprobante ?? row.NroComprobante);
  if (!nroComprobante) return null;

  return {
    ok:
      row.ok === true ||
      safeText(row.ok ?? row.Ok)
        .toLowerCase()
        .includes("true"),
    companiaId: safeNumber(row.companiaId ?? row.CompaniaId),
    serie: safeText(row.serie ?? row.Serie),
    ultimoNumero: safeText(row.ultimoNumero ?? row.UltimoNumero),
    numero: safeText(row.numero ?? row.Numero),
    nroComprobante,
  };
};

export const summarizeServiceInvoiceDetail = (
  detail: ServiceInvoicePayloadDetail[],
) => {
  const subTotal = detail.reduce((sum, item) => sum + item.importe, 0);
  const igv = detail.reduce((sum, item) => sum + item.igv, 0);
  const total = subTotal + igv;

  return {
    subTotal: Number(subTotal.toFixed(2)),
    igv: Number(igv.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
};

export const useServiceInvoicesStore = create<ServiceInvoicesState>((set) => ({
  invoices: [],
  loading: false,
  sending: false,
  correlativeLoading: false,
  serviceProducts: [],
  serviceProductsLoading: false,
  error: null,

  fetchInvoices: async (filters) => {
    set({ loading: true, error: null });
    try {
      const response = await apiRequest<unknown>({
        url: buildApiUrl(`/Nota/facturas-servicio${buildQuery(filters)}`),
        method: "GET",
        config: { timeout: 15000 },
        fallback: [],
      });

      if (isAxiosLikeError(response)) {
        const error = response as {
          message?: string;
          response?: { status?: number; data?: unknown };
        };
        const status = error.response?.status;
        const message =
          status === 401
            ? "Sesion expirada o no autorizada para listar facturas de servicio."
            : status
              ? `El API respondio con estado ${status}.`
              : error.message ||
                "No hubo respuesta del API de facturas de servicio.";

        set({ invoices: [], loading: false, error: message });
        return;
      }

      const data = parseArrayResponse(response);
      set({
        invoices: sortInvoicesByIdDesc(data.map(mapApiItem)),
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error loading service invoices", error);
      set({
        loading: false,
        error: "No se pudo listar las facturas de servicio.",
      });
    }
  },

  fetchInvoiceById: async (docuId) => {
    if (!Number.isFinite(docuId) || docuId <= 0) return null;

    try {
      const response = await apiRequest<unknown>({
        url: buildApiUrl(`/Nota/facturas-servicio/${docuId}`),
        method: "GET",
        config: { timeout: 15000 },
        fallback: null,
      });

      if (isAxiosLikeError(response) || !response) return null;

      return mapApiItem(response);
    } catch (error) {
      console.error("Error loading service invoice", error);
      return null;
    }
  },

  fetchCorrelative: async (companiaId, serie) => {
    set({ correlativeLoading: true });
    try {
      const response = await apiRequest<unknown>({
        url: buildApiUrl(
          `/Nota/factura-servicio/correlativo${buildCorrelativeQuery(
            companiaId,
            serie,
          )}`,
        ),
        method: "GET",
        config: { timeout: 15000 },
        fallback: null,
      });

      if (isAxiosLikeError(response)) return null;

      return mapCorrelative(response);
    } catch (error) {
      console.error("Error loading service invoice correlative", error);
      return null;
    } finally {
      set({ correlativeLoading: false });
    }
  },

  fetchServiceProducts: async (filters) => {
    set({ serviceProductsLoading: true });
    try {
      const response = await apiRequest<unknown>({
        url: buildApiUrl(
          `/Productos/servicios${buildServiceProductsQuery(filters)}`,
        ),
        method: "GET",
        config: { timeout: 15000 },
        fallback: [],
      });

      if (isAxiosLikeError(response)) {
        set({ serviceProducts: [], serviceProductsLoading: false });
        return;
      }

      set({
        serviceProducts: parseArrayResponse(response)
          .map(mapApiServiceProduct)
          .filter((item) => item.id > 0 || item.codigo || item.nombre),
        serviceProductsLoading: false,
      });
    } catch (error) {
      console.error("Error loading service products", error);
      set({ serviceProducts: [], serviceProductsLoading: false });
    }
  },

  sendInvoice: async (payload) => {
    set({ sending: true });
    try {
      const response = await apiRequest<unknown>({
        url: buildApiUrl("/Nota/factura-servicio/enviar-ose"),
        method: "POST",
        data: payload,
        config: {
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
          },
        },
        fallback: null,
      });

      if (isAxiosLikeError(response)) {
        throw response;
      }

      return response;
    } finally {
      set({ sending: false });
    }
  },

  sendCreditNote: async (payload) => {
    set({ sending: true });
    try {
      const source = payload as ServiceInvoiceCreditNotePayload & {
        docuId?: number;
        docu_id?: number;
      };
      const docuIdValue = Number(
        source.DOCU_ID ?? source.docu_id ?? source.docuId ?? 0,
      );
      const { docuId: _docuId, docu_id: _docu_id, ...rest } = source;

      const requestBody: ServiceInvoiceCreditNotePayload = {
        ...rest,
        DOCU_ID: docuIdValue,
      };

      const response = await apiRequest<unknown>({
        url: buildApiUrl("/factura-servicio/credito/enviar"),
        method: "POST",
        data: requestBody,
        config: {
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
          },
        },
        fallback: null,
      });

      if (isAxiosLikeError(response)) {
        throw response;
      }

      return response;
    } finally {
      set({ sending: false });
    }
  },
}));
