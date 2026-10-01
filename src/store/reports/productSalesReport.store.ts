import { create } from "zustand";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";

export type ProductSalesMonth = {
  month: number;
  monthName: string;
  quantity: number;
  amount: number;
}

export interface ProductSalesReport {
  year: number;
  productId: number;
  productName: string;
  productUnit: string;
  totalQuantity: number;
  totalSales: number;
  months: ProductSalesMonth[];
}

interface ProductSalesReportState {
  report: ProductSalesReport | null;
  loading: boolean;
  error: string | null;
  fetchReport: (year: number, productId: number) => Promise<void>;
}

export const useProductSalesReportStore = create<ProductSalesReportState>((set) => ({
  report: null,
  loading: false,
  error: null,

  fetchReport: async (year, productId) => {
    set({ loading: true, error: null, report: null });
    try {
      const response = await apiRequest<ProductSalesReport, unknown, null>({
        url: buildApiUrl(`/SalesReport/products/monthly?year=${year}&productId=${productId}`),
        fallback: null,
      });
      if (!response || !Array.isArray(response.months)) {
        throw new Error("No se pudo cargar el reporte de productos.");
      }
      set({ report: response });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "No se pudo cargar el reporte de productos." });
    } finally {
      set({ loading: false });
    }
  },
}));
