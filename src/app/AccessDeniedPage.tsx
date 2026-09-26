import { ShieldAlert } from "lucide-react";

export function AccessDeniedPage() {
  return (
    <div className="mx-auto mt-12 max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
      <ShieldAlert className="mx-auto h-10 w-10 text-amber-700" />
      <h1 className="mt-3 text-lg font-semibold text-slate-900">Sin acceso a este módulo</h1>
      <p className="mt-1 text-sm text-slate-600">Solicita a Gerencia y Administración el permiso correspondiente.</p>
    </div>
  );
}
