import { create } from "zustand";
import type { SendNote } from "@/types/sendNote";

interface SendNoteState {
  notes: SendNote[];
  loading: boolean;
  fetchNotes: () => Promise<void>;
  addNote: (data: Omit<SendNote, "id">) => void;
  updateNote: (id: number, data: Partial<SendNote>) => void;
  deleteNote: (id: number) => void;
}

export const useSendNoteStore = create<SendNoteState>((set, get) => ({
  notes: [],
  loading: false,

  fetchNotes: async () => {
    if (get().notes.length) return;
    set({ loading: true });
    const mock: SendNote[] = await new Promise((resolve) =>
      setTimeout(
        () =>
          resolve([
            {
              id: 1,
              formaPago: "efectivo",
              entidad: "Entidad Demo",
              opr: "OPR-001",
              cliente: "Cliente Demo",
              ruc: "20123456789",
              dni: "12345678",
              direccionFiscal: "Av. Principal 123",
              direccionDespacho: "Calle Secundaria 456",
              telefono: "999999999",
              concepto: "Servicio",
              tipoDocumento: "Factura",
              buscarCodigo: "",
              radioOpcion: "opcion1",
              items: [
                { codigo: "COD-1", descripcion: "Producto demo", cantidad: 1 },
              ],
            },
          ]),
        300
      )
    );
    set({ notes: mock, loading: false });
  },

  addNote: (data) =>
    set((state) => {
      const newId =
        state.notes.length > 0
          ? Math.max(...state.notes.map((n) => n.id)) + 1
          : 1;
      return { notes: [...state.notes, { ...data, id: newId }] };
    }),

  updateNote: (id, data) =>
    set((state) => ({
      notes: state.notes.map((n) => (n.id === id ? { ...n, ...data } : n)),
    })),

  deleteNote: (id) =>
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
    })),
}));
