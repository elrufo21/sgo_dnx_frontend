import { create } from "zustand";
import type { ReactNode } from "react";
import type { DialogProps } from "@mui/material/Dialog";

type DialogOptions = {
  title?: string;
  content: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: (data?: unknown) => Promise<boolean | void> | boolean | void;
  onCancel?: () => void;
  maxWidth?: DialogProps["maxWidth"];
  fullWidth?: boolean;
  disableBackdropClose?: boolean;
  disableClose?: boolean;
  hideCancelButton?: boolean;
  mobileFullScreen?: boolean;
  mobileActions?: ReactNode;
};

const defaults = {
  open: false,
  title: "",
  content: null as ReactNode,
  confirmText: "Aceptar",
  cancelText: "Cancelar",
  onConfirm: undefined as DialogOptions["onConfirm"] | undefined,
  onCancel: undefined as DialogOptions["onCancel"] | undefined,
  fullWidth: true,
  maxWidth: "sm" as DialogProps["maxWidth"],
  disableBackdropClose: false,
  disableClose: false,
  hideCancelButton: false,
  mobileFullScreen: false,
  mobileActions: null as ReactNode,
  loading: false,
  data: null as unknown,
};

type DialogState = typeof defaults & {
  openDialog: (options: DialogOptions) => void;
  closeDialog: () => void;
  setLoading: (loading: boolean) => void;
  setData: (data: unknown | ((prevData: unknown) => unknown)) => void;
  setMobileActions: (mobileActions: ReactNode | null) => void;
};

export const useDialogStore = create<DialogState>((set) => ({
  ...defaults,
  openDialog: (options) => set({ ...defaults, ...options, open: true }),
  closeDialog: () => set(defaults),
  setLoading: (loading) => set({ loading }),
  setData: (data) =>
    set((state) => ({
      data:
        typeof data === "function"
          ? (data as (prevData: unknown) => unknown)(state.data)
          : data,
    })),
  setMobileActions: (mobileActions) => set({ mobileActions }),
}));
