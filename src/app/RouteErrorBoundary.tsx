import { isRouteErrorResponse, useNavigate, useRouteError } from "react-router";

const asMessage = (value: unknown): string => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value instanceof Error && value.message.trim()) return value.message.trim();
  if (value && typeof value === "object") {
    const maybeMessage = (value as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage.trim();
    }
  }
  return "Ocurrio un error inesperado en la vista.";
};

export function RouteErrorBoundary() {
  const navigate = useNavigate();
  const error = useRouteError();

  const title = isRouteErrorResponse(error)
    ? `Error ${error.status}`
    : "Algo salio mal";
  const message = isRouteErrorResponse(error)
    ? error.statusText || "No se pudo cargar la pagina."
    : asMessage(error);

  return (
    <div className="min-h-[60vh] w-full px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-3 text-sm text-slate-700 break-words">{message}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-900"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-50"
          >
            Recargar
          </button>
        </div>
      </div>
    </div>
  );
}
