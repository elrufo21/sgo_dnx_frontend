import type { Purchase } from "@/types/customer";
import { create } from "zustand";

interface PurchasesState {
  purchases: Purchase[];
  loading: boolean;
  fetchPurchases: () => Promise<void>;
  addPurchase: (purchase: Omit<Purchase, "id">) => void;
  updatePurchase: (id: number, data: Partial<Purchase>) => void;
  deletePurchase: (id: number) => void;
}

export const usePurchasesStore = create<PurchasesState>((set, get) => ({
  purchases: [],
  loading: false,

  fetchPurchases: async () => {
    if (get().purchases.length > 0) return;

    set({ loading: true });

    try {
      const response: Purchase[] = await new Promise((resolve) =>
        setTimeout(
          () =>
            resolve([
              {
                id: 1,
                nombreRazon: "Distribuciones Lima SAC",
                ruc: "20567891234",
                contacto: "Juan Pérez",
                celular: "987654321",
                email: "contacto@distribucioneslima.com",
                direccion: "Av. Lima 123",
                estado: "ACTIVO",
                cuentasBancarias: [
                  {
                    entidadBancaria: "BCP",
                    moneda: "PEN",
                    tipoCuenta: "Ahorros",
                    numeroCuenta: "1234567890",
                  },
                  {
                    entidadBancaria: "Interbank",
                    moneda: "USD",
                    tipoCuenta: "Corriente",
                    numeroCuenta: "9876543210",
                  },
                ],
              },
              {
                id: 2,
                nombreRazon: "Soluciones Tech EIRL",
                ruc: "20678912345",
                contacto: "María Gómez",
                celular: "987123456",
                email: "info@solucionestech.com",
                direccion: "Calle Tech 456",
                estado: "ACTIVO",
                cuentasBancarias: [
                  {
                    entidadBancaria: "Scotiabank",
                    moneda: "USD",
                    tipoCuenta: "Corriente",
                    numeroCuenta: "1122334455",
                  },
                ],
              },
            ]),
          600,
        ),
      );

      set({ purchases: response, loading: false });
    } catch (error) {
      console.error("Error loading purchases", error);
      set({ loading: false });
    }
  },

  addPurchase: (purchase) =>
    set((state) => {
      const newId =
        state.purchases.length > 0
          ? Math.max(...state.purchases.map((p) => p.id)) + 1
          : 1;
      return { purchases: [...state.purchases, { ...purchase, id: newId }] };
    }),

  updatePurchase: (id, data) =>
    set((state) => ({
      purchases: state.purchases.map((p) =>
        p.id === id ? { ...p, ...data } : p,
      ),
    })),

  deletePurchase: (id) =>
    set((state) => ({
      purchases: state.purchases.filter((p) => p.id !== id),
    })),
}));
