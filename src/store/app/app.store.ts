import { create } from "zustand";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface AppStore {
  breadcrumb: BreadcrumbItem[];
  setBreadcrumb: (items: BreadcrumbItem[]) => void;
  addBreadcrumbItem: (item: BreadcrumbItem) => void;
  resetBreadcrumb: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  breadcrumb: [],
  setBreadcrumb: (items) => set({ breadcrumb: items }),
  addBreadcrumbItem: (item) =>
    set((state) => ({ breadcrumb: [...state.breadcrumb, item] })),
  resetBreadcrumb: () => set({ breadcrumb: [] }),
}));