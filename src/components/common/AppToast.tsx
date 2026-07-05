import type { ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  TriangleAlert,
  X,
} from "lucide-react";

export type AppToastVariant =
  | "success"
  | "error"
  | "info"
  | "warning"
  | "loading"
  | "message";

type AppToastProps = {
  variant: AppToastVariant;
  title?: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  showCloseButton?: boolean;
};

const variantClasses: Record<
  AppToastVariant,
  { accent: string; iconContainer: string; iconClass: string }
> = {
  success: {
    accent: "from-emerald-500 via-emerald-400 to-lime-300",
    iconContainer: "bg-emerald-100",
    iconClass: "text-emerald-700",
  },
  error: {
    accent: "from-rose-500 via-red-500 to-orange-300",
    iconContainer: "bg-rose-100",
    iconClass: "text-rose-700",
  },
  info: {
    accent: "from-sky-500 via-cyan-500 to-blue-400",
    iconContainer: "bg-sky-100",
    iconClass: "text-sky-700",
  },
  warning: {
    accent: "from-amber-500 via-orange-500 to-yellow-300",
    iconContainer: "bg-amber-100",
    iconClass: "text-amber-700",
  },
  loading: {
    accent: "from-slate-500 via-slate-400 to-slate-300",
    iconContainer: "bg-slate-200",
    iconClass: "text-slate-700",
  },
  message: {
    accent: "from-indigo-500 via-blue-500 to-cyan-400",
    iconContainer: "bg-indigo-100",
    iconClass: "text-indigo-700",
  },
};

const variantIcon: Record<AppToastVariant, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
  warning: <TriangleAlert className="h-4 w-4" />,
  loading: <Loader2 className="h-4 w-4 animate-spin" />,
  message: <Info className="h-4 w-4" />,
};

export function AppToast({
  variant,
  title,
  description,
  onClose,
  showCloseButton = true,
}: AppToastProps) {
  const styles = variantClasses[variant];

  return (
    <div className="pointer-events-auto relative w-[min(26rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_24px_50px_-28px_rgba(15,23,42,0.75)] backdrop-blur">
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${styles.accent}`} />
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${styles.iconContainer} ${styles.iconClass}`}
        >
          {variantIcon[variant]}
        </div>
        <div className="min-w-0 flex-1">
          {title ? (
            <div className="break-words pr-2 text-sm font-semibold leading-5 text-slate-900">
              {title}
            </div>
          ) : null}
          {description ? (
            <div className="mt-1 break-words pr-2 text-xs leading-5 text-slate-600">
              {description}
            </div>
          ) : null}
        </div>
        {showCloseButton ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Cerrar notificacion"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
