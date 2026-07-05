import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Shopping, ShoppingFormData, ShoppingItem } from "@/types/shopping";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { addDaysToLocalDateISO, getLocalDateISO } from "@/shared/helpers/localDate";
import { API_BASE_URL, buildApiUrl } from "@/config";

interface ShoppingState {
  shoppings: Shopping[];
  draftItems: ShoppingItem[];
  loading: boolean;
  fetchShoppings: () => Promise<void>;
  fetchShoppingDetails: (id: number) => Promise<ShoppingItem[]>;
  addShopping: (data: ShoppingFormData) => Promise<Shopping>;
  updateShopping: (id: number, data: ShoppingFormData) => Promise<Shopping>;
  deleteShopping: (id: number) => Promise<boolean>;
  setDraftItems: (items: ShoppingItem[]) => void;
  clearDraftItems: () => void;
}

type DocTypeCode = "01" | "03" | "00";

const docTypeConfig: Record<
  DocTypeCode,
  { docu: string; serie: string; label: string; tipoCodigo: string }
> = {
  "03": { docu: "BOLETA", serie: "BA01", label: "Boleta", tipoCodigo: "03" },
  "01": { docu: "FACTURA", serie: "FA01", label: "Factura", tipoCodigo: "01" },
  "00": {
    docu: "NOTA DE VENTA",
    serie: "NV01",
    label: "Nota de venta",
    tipoCodigo: "101",
  },
};

const safeTrim = (value: string | null | undefined) => (value ?? "").trim();

const parseLocalSession = () => {
  if (typeof window === "undefined") {
    return { companyId: 1, username: "USUARIO", cajaId: 1 };
  }

  let parsedSession: any = null;
  const sessionRaw = localStorage.getItem("sgo.auth.session");
  if (sessionRaw) {
    try {
      parsedSession = JSON.parse(sessionRaw);
    } catch {
      parsedSession = null;
    }
  }

  const companyIdRaw =
    parsedSession?.user?.companyId ?? localStorage.getItem("companiaId");
  const companyIdNum = Number(companyIdRaw);
  const safeCompanyId =
    Number.isFinite(companyIdNum) && companyIdNum > 0 ? companyIdNum : 1;

  const username =
    parsedSession?.user?.username ||
    parsedSession?.user?.displayName ||
    parsedSession?.user?.id ||
    "USUARIO";

  const cajaIdRaw = localStorage.getItem("cajaId");
  const cajaIdNum = Number(cajaIdRaw);
  const cajaId =
    Number.isFinite(cajaIdNum) && cajaIdNum > 0
      ? cajaIdNum
      : parsedSession?.user?.cajaId ?? 1;

  return { companyId: safeCompanyId, username, cajaId };
};

const igvMappings: Record<string, string> = {
  "1": "INCLUIDO",
  "2": "INCLUIDO",
  "3": "SIN IGV",
};

const mapApiToShopping = (item: any): Shopping => {
  return {
    id: Number(item?.compraId ?? 0),
    providerId: item?.proveedorId ?? null,
    concepto: item?.compraConcepto ?? "",
    proveedor: item?.proveedorNombre ?? "",
    descripcion: item?.compraObs ?? "",
    ruc: item?.proveedorRuc ?? "",
    fechaEmision: item?.compraEmision ?? "",
    documento: item?.tipoCodigo ?? "",
    serie: item?.compraSerie ?? "",
    numero: item?.compraNumero ?? "",
    condicion: item?.compraCondicion ?? "",
    moneda: item?.compraMoneda ?? "",
    diasPlazo: Number(item?.compraDias ?? 0) || 0,
    fechaPago: item?.compraFechaPago ?? "",
    tipoIgv: item?.compraTipoIgv ?? "",
    tipoCambio: Number(item?.compraTipoCambio ?? 0) || 0,
    items: [],
  };
};

const mapApiToDetail = (item: any): ShoppingItem => ({
  productId: item?.idProducto ?? null,
  codigo: item?.detalleCodigo ?? "",
  nombre: item?.descripcion ?? "",
  unidadMedida: item?.detalleUm ?? "",
  cantidad: Number(item?.detalleCantidad ?? 0) || 0,
  preCosto: Number(item?.precioCosto ?? 0) || 0,
  importe: Number(item?.detalleImporte ?? 0) || 0,
  descuento: Number(item?.detalleDescuento ?? 0) || 0,
});

const buildCompraPayload = (
  data: ShoppingFormData,
  detalles: ShoppingItem[]
) => {
  const { companyId, username, cajaId } = parseLocalSession();
  const docCode = (safeTrim(data.documento) as DocTypeCode) || "03";
  const docConfig = docTypeConfig[docCode] ?? docTypeConfig["03"];
  const now = new Date();
  const today = safeTrim(data.fechaEmision) || getLocalDateISO(now);
  const condicion = safeTrim(data.condicion).toUpperCase();
  const isCredito = condicion === "CREDITO";
  const serieNumero = safeTrim(data.numero);
  const [serieRaw = "", numeroRaw = ""] = serieNumero.split("-");
  const serie = serieRaw || docConfig.serie;
  const numero = numeroRaw || "00000000";
  const tipoIgv =
    igvMappings[String(data.tipoIgv ?? "")] ||
    (safeTrim((data as any).tipoIgvLabel) || "GRAVADO");

  const mappedDetalles = detalles.map((item) => {
    const idProducto = Number(item.productId ?? 0) || 0;
    const cantidad = Number(item.cantidad ?? 0) || 0;
    const costo = Number(item.preCosto ?? 0) || 0;
    const importe = Number(
      (Number(item.importe ?? 0) || cantidad * costo).toFixed(2)
    );

    return {
      detalleId: 0,
      compraId: 0,
      idProducto,
      detalleCodigo: item.codigo ?? "",
      descripcion: item.nombre ?? "",
      detalleUm: item.unidadMedida ?? "UND",
      detalleCantidad: cantidad,
      precioCosto: costo,
      detalleImporte: importe,
      detalleDescuento: Number(item.descuento ?? 0) || 0,
      detalleEstado: "ACTIVO",
      descuentoB: 0,
      estadoB: "E",
      valorUM: 1,
    };
  });

  const total = mappedDetalles.reduce(
    (sum, item) => sum + Number(item.detalleImporte ?? 0),
    0
  );
  const base = total / 1.18;
  const igv = total - base;
  const condicionLabel = isCredito ? "CREDITO" : "ALCONTADO";
  const compraEstado = isCredito ? "PENDIENTE DE PAGO" : "TOTALMENTE PAGADO";
  const compraMoneda =
    safeTrim(data.moneda).toUpperCase() === "USD" ? "DOLARES" : "SOLES";

  return {
    compra: {
      compraId: 0,
      compraCorrelativo: `${serie}${numero}`,
      proveedorId:
        Number(
          (data as any).providerId ??
            (data as any).proveedorId ??
            data.providerId ??
            0
        ) || 0,
      compraRegistro: now.toISOString(),
      compraEmision: today,
      compraComputo: today,
      tipoCodigo: docConfig.tipoCodigo,
      compraSerie: serie.replace(/\D/g, "") || "01",
      compraNumero: numero.replace(/\D/g, "").padStart(6, "0").slice(-8) || "000000",
      compraCondicion: condicionLabel,
      compraMoneda: compraMoneda,
      compraTipoCambio: Number(data.tipoCambio ?? 0) || 0,
      compraDias: Number(data.diasPlazo ?? 0) || 0,
      compraFechaPago:
        safeTrim(data.fechaPago) ||
        addDaysToLocalDateISO(today, 1) ||
        today,
      compraUsuario: username,
      compraTipoIgv: tipoIgv,
      compraValorVenta: Number(total.toFixed(2)),
      compraDescuento: 0,
      compraSubtotal: Number(base.toFixed(2)),
      compraIgv: Number(igv.toFixed(2)),
      compraTotal: Number(total.toFixed(2)),
      compraEstado: compraEstado,
      compraAsociado: "N",
      compraSaldo: isCredito ? Number(total.toFixed(2)) : 0,
      compraObs: safeTrim(data.descripcion) || "",
      compraTipoSunat: 0,
      compraConcepto: safeTrim(data.concepto) || "MERCADERIA",
      compraPercepcion: 0,
    },
    detalles: mappedDetalles,
    companiaId: companyId,
    cajaId,
  };
};

const mockData: Shopping[] = [
  {
    id: 1,
    concepto: "Compra local",
    proveedor: "Proveedor A",
    descripcion: "Compra de insumos varios",
    ruc: "20123456789",
    fechaEmision: "2024-12-01",
    documento: "Factura",
    serie: "F001",
    numero: "000123",
    condicion: "Crédito",
    moneda: "PEN",
    diasPlazo: 30,
    fechaPago: "2024-12-31",
    tipoIgv: "Gravado",
    tipoCambio: 3.78,
    items: [],
  },
  {
    id: 2,
    concepto: "Servicio técnico",
    proveedor: "Servicios SRL",
    descripcion: "Mantenimiento de equipos",
    ruc: "20654321987",
    fechaEmision: "2024-12-05",
    documento: "Boleta",
    serie: "B002",
    numero: "000567",
    condicion: "Contado",
    moneda: "USD",
    diasPlazo: 0,
    fechaPago: "2024-12-05",
    tipoIgv: "Exonerado",
    tipoCambio: 3.82,
    items: [],
  },
];

export const useShoppingStore = create<ShoppingState>()(
  persist(
    (set, get) => ({
      shoppings: [],
      draftItems: [],
      loading: false,

      fetchShoppings: async () => {
        set({ loading: true });
        try {
          const response = await apiRequest<any[]>({
            url: `${API_BASE_URL}/Compra/list`,
            method: "GET",
            fallback: [],
          });
          const data = Array.isArray(response) ? response : [];
          set({ shoppings: data.map(mapApiToShopping), loading: false });
        } catch (error) {
          console.error("Error loading purchases", error);
          set({ loading: false });
        }
      },

      fetchShoppingDetails: async (id: number) => {
        try {
          const response = await apiRequest<any[]>({
            url: `${API_BASE_URL}/Compra/${id}/detalles`,
            method: "GET",
            fallback: [],
          });
          const data = Array.isArray(response) ? response : [];
          return data.map(mapApiToDetail);
        } catch (error) {
          console.error("Error loading purchase details", error);
          return [];
        }
      },

      addShopping: async (data) => {
        const detalle =
          data.items
            ?.filter((i) => {
              const idNum = Number(i.productId ?? 0);
              const hasProduct = Number.isFinite(idNum) && idNum > 0;
              const hasName = safeTrim((i as any).nombre) || safeTrim((i as any).codigo);
              const hasQty = Number(i.cantidad ?? 0) > 0;
              return hasProduct && hasQty && hasName;
            }) ?? [];
        const payload = buildCompraPayload(data, detalle);

        const result = await apiRequest<any>({
          url: buildApiUrl("/Compra/register-with-detail"),
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

        const nextId =
          get().shoppings.length > 0
            ? Math.max(...get().shoppings.map((s) => s.id)) + 1
            : 1;
        const generatedId =
          (result as any)?.nota?.notaId ??
          (result as any)?.notaId ??
          (result as any)?.id ??
          nextId;

        const newItem: Shopping = { ...data, id: generatedId };
        set((state) => ({ shoppings: [...state.shoppings, newItem] }));
        return newItem;
      },

      updateShopping: async (id, data) => {
        const updated: Shopping = { ...data, id };
        set((state) => ({
          shoppings: state.shoppings.map((s) => (s.id === id ? updated : s)),
        }));
        return updated;
      },

      deleteShopping: async (id) => {
        set((state) => ({
          shoppings: state.shoppings.filter((s) => s.id !== id),
        }));
        return true;
      },

      setDraftItems: (items) => set({ draftItems: items }),
      clearDraftItems: () => set({ draftItems: [] }),
    }),
    {
      name: "shopping-store",
      partialize: (state) => ({ draftItems: state.draftItems }),
    }
  )
);
