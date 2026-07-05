import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/types/product";
import type { PosCartItem, PosTotals } from "@/types/pos";

const toNumber = (value: unknown, fallback = 0): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toNonNegative = (value: unknown): number => Math.max(toNumber(value, 0), 0);
const normalizeText = (value: unknown): string =>
  String(value ?? "").trim().toLowerCase();
const normalizeOptionalText = (value: unknown): string =>
  String(value ?? "").trim();
const getItemKey = (item: Pick<PosCartItem, "productId" | "detalleId">): number =>
  toNumber(item.detalleId, 0) || toNumber(item.productId, 0);

const EMPTY_TOTALS: PosTotals = { subTotal: 0, total: 0, itemCount: 0 };

const calculateTotals = (items: PosCartItem[]): PosTotals => {
  let subTotal = 0;
  let itemCount = 0;

  for (const item of items) {
    const cantidad = toNonNegative(item.cantidad);
    const precio = toNonNegative(item.precio);
    subTotal += precio * cantidad;
    itemCount += cantidad;
  }

  return {
    subTotal,
    total: subTotal,
    itemCount,
  };
};

interface PosState {
  items: PosCartItem[];
  totals: PosTotals;
  editingNotaId: number | null;
  serverItemsFromNota: PosCartItem[];
  isEditingMode: boolean;
  addProduct: (product: Product, quantity?: number) => void;
  setItems: (items: PosCartItem[]) => void;
  setEditingNota: (notaId: number | null) => void;
  setEditingMode: (isEditing: boolean) => void;
  setServerItemsFromNota: (items: PosCartItem[]) => void;
  clearEditingNota: () => void;
  updateQuantity: (productId: number, quantity: number) => void;
  updatePrice: (productId: number, price: number) => void;
  removeItem: (productId: number) => void;
  clearCart: () => void;
}

export const usePosStore = create<PosState>()(
  persist(
    (set) => ({
      items: [],
      totals: EMPTY_TOTALS,
      editingNotaId: null,
      serverItemsFromNota: [],
      isEditingMode: false,

      setItems: (items) =>
        set((state) => {
          let hasNormalizationChanges = false;
          const normalizedItems = items.map((item) => {
            const rawMinPrice = toNumber(item.precioMinimo ?? 0);
            const minPrice = toNonNegative(rawMinPrice);
            const safePrice = Math.max(toNonNegative(item.precio), minPrice);
            if (safePrice === item.precio && rawMinPrice === minPrice) {
              return item;
            }
            hasNormalizationChanges = true;
            return {
              ...item,
              precio: safePrice,
              precioMinimo: minPrice,
            };
          });

          const nextItems = hasNormalizationChanges ? normalizedItems : items;
          if (state.items === nextItems) return state;
          return { items: nextItems, totals: calculateTotals(nextItems) };
        }),

      setEditingNota: (notaId) =>
        set((state) => {
          if (state.editingNotaId === notaId) return state;
          return { editingNotaId: notaId };
        }),

      setEditingMode: (isEditing) =>
        set((state) => {
          if (state.isEditingMode === isEditing) return state;
          return { isEditingMode: isEditing };
        }),

      setServerItemsFromNota: (items) =>
        set((state) => {
          if (state.serverItemsFromNota === items) return state;
          return { serverItemsFromNota: items };
        }),

      clearEditingNota: () =>
        set((state) => {
          if (
            state.editingNotaId === null &&
            state.serverItemsFromNota.length === 0 &&
            state.isEditingMode === false
          ) {
            return state;
          }

          return {
            editingNotaId: null,
            serverItemsFromNota: [],
            isEditingMode: false,
          };
        }),

      addProduct: (product, quantity = 1) =>
        set((state) => {
          const basePrice =
            toNumber((product as any).preVenta ?? 0) ||
            toNumber((product as any).preVentaB ?? 0) ||
            0;
          const minPrice = Math.max(
            toNonNegative((product as any).preVentaB ?? 0),
            toNonNegative(basePrice)
          );
          const reductionValue = (() => {
            const raw = toNumber((product as any).valorUM, 1);
            return Number.isFinite(raw) && raw > 0 ? raw : 1;
          })();
          const productDetailId = toNumber((product as any).detalleId, 0);
          const productCodigoSunat = normalizeOptionalText(
            (product as any).codigoSunat,
          );
          const normalizedDetailId =
            Number.isFinite(productDetailId) && productDetailId !== 0
              ? productDetailId
              : undefined;
          const productUnit = normalizeText((product as any).unidadMedida);
          const existing = state.items.find(
            (item) =>
              item.productId === product.id &&
              (toNumber(item.detalleId, 0) || 0) ===
                (normalizedDetailId ?? 0) &&
              normalizeText(item.unidadMedida) === productUnit
          );
          const currentQty = toNonNegative(existing?.cantidad ?? 0);
          const desiredQty = currentQty + quantity;
          const nextQty = Math.max(desiredQty, 1);
          const currentPrice = toNonNegative(existing?.precio ?? basePrice);
          const nextPrice = Math.max(currentPrice, minPrice);

          if (nextQty <= 0) return state;

          if (
            existing &&
            nextQty === existing.cantidad &&
            existing.precio === nextPrice &&
            toNonNegative(existing.precioMinimo ?? 0) === minPrice
          ) {
            return state;
          }

          const nextItems = existing
            ? state.items.map((item) =>
                item.productId === product.id &&
                (toNumber(item.detalleId, 0) || 0) ===
                  (normalizedDetailId ?? 0) &&
                normalizeText(item.unidadMedida) === productUnit
                  ? {
                      ...item,
                      cantidad: nextQty,
                      precio: nextPrice,
                      precioMinimo: minPrice,
                      valorUM: reductionValue,
                      pv: toNumber((product as any).pv ?? 0),
                      sv: toNumber((product as any).sv ?? 0),
                      codigoSunat: item.codigoSunat || productCodigoSunat || undefined,
                    }
                  : item
              )
            : [
                ...state.items,
                {
                  productId: product.id,
                  codigo: product.codigo,
                  codigoSunat: productCodigoSunat || undefined,
                  nombre: product.nombre,
                  unidadMedida: product.unidadMedida,
                  detalleId: normalizedDetailId,
                  precio: Math.max(toNonNegative(basePrice), minPrice),
                  precioMinimo: minPrice,
                  cantidad: nextQty,
                  valorUM: reductionValue,
                  pv: toNumber((product as any).pv ?? 0),
                  sv: toNumber((product as any).sv ?? 0),
                  stock: toNumber(
                    (product as any).cantidad ?? (product as any).stock ?? 0
                  ),
                },
              ];

          return { items: nextItems, totals: calculateTotals(nextItems) };
        }),

      updateQuantity: (productId, quantity) =>
        set((state) => {
          let changed = false;
          const hasExactKey = state.items.some(
            (item) => getItemKey(item) === productId
          );
          const nextItems = state.items.map((item) => {
            const matches = hasExactKey
              ? getItemKey(item) === productId
              : item.productId === productId;
            if (!matches) return item;
            const cappedQty = toNonNegative(quantity);
            if (cappedQty === item.cantidad) return item;
            changed = true;
            return { ...item, cantidad: cappedQty };
          });

          if (!changed) return state;
          return { items: nextItems, totals: calculateTotals(nextItems) };
        }),

      updatePrice: (productId, price) =>
        set((state) => {
          let changed = false;
          const hasExactKey = state.items.some(
            (item) => getItemKey(item) === productId
          );
          const nextItems = state.items.map((item) => {
            const matches = hasExactKey
              ? getItemKey(item) === productId
              : item.productId === productId;
            if (!matches) return item;
            const minPrice = toNonNegative(item.precioMinimo ?? 0);
            const safePrice = Math.max(toNonNegative(price), minPrice);
            if (item.precio === safePrice) return item;
            changed = true;
            return { ...item, precio: safePrice };
          });

          if (!changed) return state;
          return { items: nextItems, totals: calculateTotals(nextItems) };
        }),

      removeItem: (productId) =>
        set((state) => {
          const hasExactKey = state.items.some(
            (item) => getItemKey(item) === productId
          );
          const nextItems = state.items.filter(
            (item) =>
              hasExactKey
                ? getItemKey(item) !== productId
                : item.productId !== productId
          );
          if (nextItems.length === state.items.length) return state;
          return { items: nextItems, totals: calculateTotals(nextItems) };
        }),

      clearCart: () =>
        set((state) => {
          if (state.items.length === 0 && state.totals.itemCount === 0) {
            return state;
          }
          return {
            items: [],
            totals: EMPTY_TOTALS,
          };
        }),
    }),
    {
      name: "pos-cart",
      partialize: (state) => {
        const shouldPersistForEditFlow =
          state.isEditingMode && Number(state.editingNotaId ?? 0) > 0;

        if (!shouldPersistForEditFlow) {
          return {
            items: [],
            totals: EMPTY_TOTALS,
            editingNotaId: null,
            serverItemsFromNota: [],
            isEditingMode: false,
          };
        }

        return {
          items: state.items,
          totals: state.totals,
          editingNotaId: state.editingNotaId,
          serverItemsFromNota: state.serverItemsFromNota,
          isEditingMode: state.isEditingMode,
        };
      },
    }
  )
);

export const selectTotals = (state: PosState) => state.totals;
