import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import type { ActiveCashFlow, CashFlow, CloseCashFlow, OpenCashFlow } from "@/types/cashFlow";
import { create } from "zustand";

type ApiRow = Record<string, unknown>;

const asRecord = (value: unknown): ApiRow =>
  value && typeof value === "object" ? (value as ApiRow) : {};

const asString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
  }
  return "";
};

const asNumber = (...values: unknown[]) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
};

const mapCashFlow = (value: unknown): CashFlow => {
  const row = asRecord(value);
  return {
    id: asNumber(row.cajaId, row.CajaId),
    fechaApertura: asString(row.fechaApertura, row.FechaApertura),
    fechaCierre: asString(row.fechaCierre, row.FechaCierre),
    montoInicial: asNumber(row.montoInicial, row.MontoInicial),
    encargado: asString(row.encargado, row.Encargado),
    usuario: asString(row.usuario, row.Usuario),
    estado: asString(row.estado, row.Estado),
    observacion: asString(row.observacion, row.Observacion),
  };
};

const mapActiveCashFlow = (value: unknown): ActiveCashFlow | null => {
  if (!value || typeof value !== "object") return null;
  const row = asRecord(value);
  const monedas = Array.isArray(row.monedas ?? row.Monedas)
    ? (row.monedas ?? row.Monedas) as unknown[]
    : [];
  return {
    id: asNumber(row.cajaId, row.CajaId),
    fechaApertura: asString(row.fechaApertura, row.FechaApertura),
    montoInicial: asNumber(row.montoInicial, row.MontoInicial),
    encargado: asString(row.encargado, row.Encargado),
    usuario: asString(row.usuario, row.Usuario),
    observacion: asString(row.observacion, row.Observacion),
    ventasEfectivo: asNumber(row.ventasEfectivo, row.VentasEfectivo),
    ventasTarjeta: asNumber(row.ventasTarjeta, row.VentasTarjeta),
    ventasDeposito: asNumber(row.ventasDeposito, row.VentasDeposito),
    salidas: asNumber(row.salidas, row.Salidas),
    efectivoEsperado: asNumber(row.efectivoEsperado, row.EfectivoEsperado),
    monedas: monedas.map((item) => {
      const moneda = asRecord(item);
      return {
        denominacion: asNumber(moneda.billete, moneda.Billete),
        cantidad: asNumber(moneda.cantidad, moneda.Cantidad),
      };
    }),
  };
};

interface CashFlowState {
  flows: CashFlow[];
  loading: boolean;
  selectedCashId: number | null;
  selectCashForClosing: (cajaId: number | null) => void;
  fetchFlows: () => Promise<void>;
  openCashFlow: (flow: OpenCashFlow) => Promise<{ ok: boolean; mensaje: string }>;
  getActiveCashFlow: (usuarioId: number) => Promise<ActiveCashFlow | null>;
  closeCashFlow: (cajaId: number, flow: CloseCashFlow) => Promise<{ ok: boolean; mensaje: string; diferencia: number }>;
}

export const useCashFlowStore = create<CashFlowState>((set, get) => ({
  flows: [],
  loading: false,
  selectedCashId: null,
  selectCashForClosing: (cajaId) => set({ selectedCashId: cajaId }),

  fetchFlows: async () => {
    set({ loading: true });
    try {
      const response = await apiRequest<unknown[]>({
        url: `${API_BASE_URL}/CashFlow`,
        method: "GET",
        fallback: [],
      });
      set({ flows: Array.isArray(response) ? response.map(mapCashFlow) : [] });
    } finally {
      set({ loading: false });
    }
  },

  openCashFlow: async (flow) => {
    const response = await apiRequest<unknown>({
      url: `${API_BASE_URL}/CashFlow/open`,
      method: "POST",
      data: flow,
    });
    const result = asRecord(response);
    const error = asRecord(asRecord(result.response).data);
    const ok = result.ok === true;
    const mensaje = asString(
      result.mensaje,
      result.message,
      error.mensaje,
      error.message,
    );

    if (ok) await get().fetchFlows();
    return { ok, mensaje: mensaje || "No se pudo abrir la caja." };
  },

  getActiveCashFlow: async (usuarioId) => {
    const response = await apiRequest<unknown>({
      url: `${API_BASE_URL}/CashFlow/active/${usuarioId}`,
      method: "GET",
      fallback: null,
    });
    return mapActiveCashFlow(response);
  },

  closeCashFlow: async (cajaId, flow) => {
    const response = await apiRequest<unknown>({
      url: `${API_BASE_URL}/CashFlow/${cajaId}/close`,
      method: "POST",
      data: flow,
    });
    const result = asRecord(response);
    const error = asRecord(asRecord(result.response).data);
    const ok = result.ok === true;
    const mensaje = asString(result.mensaje, result.message, error.mensaje, error.message);
    const diferencia = asNumber(result.diferencia, result.Diferencia);

    if (ok) await get().fetchFlows();
    return { ok, mensaje: mensaje || "No se pudo cerrar la caja.", diferencia };
  },
}));
