import type { CashFlow } from "@/types/cashFlow";
import { create } from "zustand";

interface CashFlowState {
  flows: CashFlow[];
  loading: boolean;
  fetchFlows: () => Promise<void>;
  addFlow: (flow: Omit<CashFlow, "id">) => void;
  updateFlow: (id: number, flow: Partial<CashFlow>) => void;
  deleteFlow: (id: number) => void;
  getFlowById: (id: number) => CashFlow | undefined;
}

export const useCashFlowStore = create<CashFlowState>((set, get) => ({
  flows: [],
  loading: false,

  fetchFlows: async () => {
    const { flows } = get();
    if (flows.length > 0) {
      // Ya hay datos, no hacemos fetch
      return;
    }

    set({ loading: true });
    try {
      // Simula una llamada a API
      const response: CashFlow[] = await new Promise((resolve) =>
        setTimeout(
          () =>
            resolve([
              {
                id: 1,
                caja: "377",
                encargado: "RODRIGO ESPINOZA",
                sencillo: 20,
                estado: "CERRADA",
                fechaApertura: "2025-12-01T10:49:49",
                fechaCierre: "2025-12-01T15:58:26",
                conteoMonedas: [
                  { cantidad: 4, denominacion: 200.0 },
                  { cantidad: 2, denominacion: 100.0 },
                  { cantidad: 0, denominacion: 50.0 },
                  { cantidad: 3, denominacion: 20.0 },
                  { cantidad: 0, denominacion: 10.0 },
                  { cantidad: 1, denominacion: 5.0 },
                  { cantidad: 2, denominacion: 2.0 },
                  { cantidad: 0, denominacion: 1.0 },
                  { cantidad: 0, denominacion: 0.5 },
                  { cantidad: 0, denominacion: 0.2 },
                  { cantidad: 0, denominacion: 0.1 },
                ],
                ingresos: [
                  { id: 1, descripcion: "VENTA EFECTIVO", importe: 1049 },
                ],
                gastos: [],
                observaciones: "Cierre normal del día",
                ventaTotal: { efectivo: 1049, tarjeta: 0, deposito: 0 },
              },
              {
                id: 2,
                caja: "378",
                encargado: "MARIA GONZALES",
                sencillo: 30,
                estado: "ABIERTA",
                fechaApertura: "2025-12-05T09:00:00",
                fechaCierre: "",
                conteoMonedas: [
                  { cantidad: 2, denominacion: 200.0 },
                  { cantidad: 3, denominacion: 100.0 },
                  { cantidad: 1, denominacion: 50.0 },
                  { cantidad: 5, denominacion: 20.0 },
                  { cantidad: 2, denominacion: 10.0 },
                  { cantidad: 4, denominacion: 5.0 },
                  { cantidad: 5, denominacion: 2.0 },
                  { cantidad: 3, denominacion: 1.0 },
                  { cantidad: 2, denominacion: 0.5 },
                  { cantidad: 5, denominacion: 0.2 },
                  { cantidad: 3, denominacion: 0.1 },
                ],
                ingresos: [
                  { id: 1, descripcion: "VENTA MATUTINA", importe: 450 },
                ],
                gastos: [{ id: 1, descripcion: "COMPRA INSUMOS", importe: 80 }],
                observaciones: "",
                ventaTotal: { efectivo: 450, tarjeta: 120, deposito: 80 },
              },
            ]),
          600
        )
      );
      set({ flows: response, loading: false });
    } catch (err) {
      console.error(err);
      set({ loading: false });
    }
  },

  addFlow: (flow) => {
    const newFlow: CashFlow = {
      ...flow,
      id: Date.now(),
    };
    set((state) => ({ flows: [...state.flows, newFlow] }));
  },

  updateFlow: (id, flow) =>
    set((state) => ({
      flows: state.flows.map((f) => (f.id === id ? { ...f, ...flow } : f)),
    })),

  deleteFlow: (id) =>
    set((state) => ({ flows: state.flows.filter((f) => f.id !== id) })),

  getFlowById: (id) => {
    return get().flows.find((f) => f.id === id);
  },
}));
