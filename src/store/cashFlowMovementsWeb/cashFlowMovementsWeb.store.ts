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
  const [gastosRaw = "~", ingresosRaw = "~", , iocRaw = "0|0"] = raw.split("[");
  const [iocImporte = "0", iocCantidad = "0"] = iocRaw.split("|");

  return {
    gastos: parseRows(gastosRaw),
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
}

export const useCashFlowMovementsWebStore = create<CashFlowMovementsWebState>((set) => ({
  ingresos: [],
  gastos: [],
  loading: false,
  fetchMovements: async (cajaId) => {
    if (cajaId <= 0) return { ingresos: [], gastos: [] };

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
}));
