import type { ReactNode } from "react";
import {
  Toaster as SonnerToaster,
  toast as sonnerToast,
  type ExternalToast,
  type ToasterProps,
} from "sonner";
import { AppToast, type AppToastVariant } from "@/components/common/AppToast";

type ToastContent = ReactNode | (() => ReactNode);

const resolveContent = (content?: ToastContent): ReactNode => {
  if (typeof content === "function") {
    return content();
  }
  return content;
};

const createStyledToast = (
  variant: AppToastVariant,
  message: ToastContent,
  options?: ExternalToast,
) => {
  const { description, dismissible, closeButton, ...rest } = options ?? {};
  const showCloseButton = dismissible !== false && closeButton !== false;

  return sonnerToast.custom(
    (id) => (
      <AppToast
        variant={variant}
        title={resolveContent(message)}
        description={resolveContent(description)}
        onClose={() => sonnerToast.dismiss(id)}
        showCloseButton={showCloseButton}
      />
    ),
    {
      ...rest,
      unstyled: true,
    },
  );
};

const toast = ((message: ToastContent, data?: ExternalToast) =>
  createStyledToast("message", message, data)) as typeof sonnerToast;

toast.success = (message, data) => createStyledToast("success", message, data);
toast.error = (message, data) => createStyledToast("error", message, data);
toast.info = (message, data) => createStyledToast("info", message, data);
toast.warning = (message, data) => createStyledToast("warning", message, data);
toast.loading = (message, data) => createStyledToast("loading", message, data);
toast.message = (message, data) => createStyledToast("message", message, data);
toast.custom = sonnerToast.custom;
toast.dismiss = sonnerToast.dismiss;
toast.promise = sonnerToast.promise;
toast.getHistory = sonnerToast.getHistory;
toast.getToasts = sonnerToast.getToasts;

const toasterToastClass =
  "!bg-transparent !border-none !p-0 !m-0 !shadow-none !ring-0";

export function Toaster({ toastOptions, ...props }: ToasterProps) {
  return (
    <SonnerToaster
      {...props}
      closeButton={false}
      toastOptions={{
        ...toastOptions,
        unstyled: true,
        classNames: {
          ...toastOptions?.classNames,
          toast: `${toasterToastClass} ${toastOptions?.classNames?.toast ?? ""}`.trim(),
        },
      }}
    />
  );
}

export { toast };
export { useSonner } from "sonner";
