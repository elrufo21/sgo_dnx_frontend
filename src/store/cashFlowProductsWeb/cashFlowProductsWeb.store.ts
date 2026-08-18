import { create } from "zustand";

import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";

export type CashFlowProductWeb = {
  codigo: string;
  descripcion: string;
  cantidad: number;
  unidadMedida: string;
  pvTotal: number;
  svTotal: number;
  importe: number;
};

const amount = (value: string) => Number(value.replace(/,/g, "")) || 0;

const parseProducts = (rawValue: string): CashFlowProductWeb[] => {
  const separator = rawValue.indexOf("[");
  if (separator < 0) return [];

  return rawValue
    .slice(separator + 1)
    .split("¬")
    .slice(3)
    .map((row) => row.trim().split("|"))
    .filter((row) => row[0] && row[0] !== "~")
    .map(([codigo, descripcion, cantidad, unidadMedida, pvTotal, svTotal, importe]) => ({
      codigo,
      descripcion,
      cantidad: amount(cantidad),
      unidadMedida,
      pvTotal: amount(pvTotal),
      svTotal: amount(svTotal),
      importe: amount(importe),
    }));
};

interface CashFlowProductsWebState {
  products: CashFlowProductWeb[];
  loading: boolean;
  fetchProducts: (cajaId: number) => Promise<void>;
}

export const useCashFlowProductsWebStore = create<CashFlowProductsWebState>((set) => ({
  products: [],
  loading: false,
  fetchProducts: async (cajaId) => {
    if (cajaId <= 0) {
      set({ products: [] });
      return;
    }

    set({ loading: true });
    try {
      const response = await apiRequest<unknown>({
        url: `${API_BASE_URL}/CashFlow/${cajaId}/products`,
        method: "GET",
        fallback: "~",
      });
      set({ products: parseProducts(typeof response === "string" ? response : "~") });
    } finally {
      set({ loading: false });
    }
  },
}));
