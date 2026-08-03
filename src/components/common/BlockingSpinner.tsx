import { Loader2 } from "lucide-react";

type BlockingSpinnerProps = {
  show: boolean;
  text?: string;
};

export function BlockingSpinner({
  show,
  text = "Cargando...",
}: BlockingSpinnerProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/70 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-lg">
        <Loader2 className="h-5 w-5 animate-spin text-[#B23636]" />
        {text}
      </div>
    </div>
  );
}
