import { create } from "zustand";

import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";

export type CashFlowMovementWeb = {
  id: number;
  descripcion: string;
  importe: number;
  estado: string;
};

type CashFlowMovements = {
  ingresos: CashFlowMovementWeb[];
  gastos: CashFlowMovementWeb[];
  sistemaObs: number;
};

const amount = (value: string) => Number(value.replace(/,/g, "")) || 0;

const parseRows = (raw: string): CashFlowMovementWeb[] =>
  raw === "~"
    ? []
    : raw
        .split("¬")
        .map((row) => row.split("|"))
        .filter((row) => row[0])
        .map(([descripcion, importe, estado, id]) => ({
          id: Number(id) || 0,
          descripcion,
          importe: amount(importe),
          estado,
        }));

const parseMovements = (raw: string): CashFlowMovements => {
  const [gastosRaw = "~", ingresosRaw = "~", obsRaw = "0", iocRaw = "0|0"] =
    raw.split("[");
  const [iocImporte = "0", iocCantidad = "0"] = iocRaw.split("|");

  return {
    gastos: parseRows(gastosRaw),
    sistemaObs: amount(obsRaw),
    ingresos: parseRows(ingresosRaw).map((item) =>
      item.descripcion === "IOC"
        ? {
            ...item,
            descripcion: `IOC (${iocCantidad || "0"})`,
            importe: amount(iocImporte),
          }
        : item,
    ),
  };
};

interface CashFlowMovementsWebState extends CashFlowMovements {
  loading: boolean;
  fetchMovements: (cajaId: number) => Promise<CashFlowMovements>;
  fetchObsTotal: (cajaId: number) => Promise<number>;
  updateManualIngresos: (
    cajaId: number,
    movimientos: Array<Pick<CashFlowMovementWeb, "id" | "importe">>,
  ) => Promise<{ ok: boolean; mensaje: string }>;
}

export const useCashFlowMovementsWebStore = create<CashFlowMovementsWebState>((set) => ({
  ingresos: [],
  gastos: [],
  sistemaObs: 0,
  loading: false,
  fetchMovements: async (cajaId) => {
    if (cajaId <= 0) return { ingresos: [], gastos: [], sistemaObs: 0 };

    set({ loading: true });
    try {
      const response = await apiRequest<unknown>({
        url: `${API_BASE_URL}/CashFlow/${cajaId}/movements`,
        method: "GET",
        fallback: "~[~[~[~",
      });
      const movements = parseMovements(
        typeof response === "string" ? response : "~[~[~[~",
      );
      set(movements);
      return movements;
    } finally {
      set({ loading: false });
    }
  },
  fetchObsTotal: async (cajaId) => {
    if (cajaId <= 0) return 0;

    set({ loading: true });
    try {
      const response = await apiRequest<{ total?: number }>({
        url: `${API_BASE_URL}/CashFlow/${cajaId}/obs-total`,
        method: "GET",
        fallback: { total: 0 },
      });
      return Number(response?.total || 0);
    } finally {
      set({ loading: false });
    }
  },
  updateManualIngresos: async (cajaId, movimientos) => {
    const response = await apiRequest<{ ok?: boolean; mensaje?: string }>({
      url: `${API_BASE_URL}/CashFlow/${cajaId}/manual-income`,
      method: "PUT",
      data: { movimientos },
      fallback: { ok: false, mensaje: "No se pudo actualizar los ingresos." },
    });
    return {
      ok: response?.ok === true,
      mensaje: response?.mensaje || "No se pudo actualizar los ingresos.",
    };
  },
}));
