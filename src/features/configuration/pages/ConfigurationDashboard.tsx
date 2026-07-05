import { ArrowRight, FileBadge2, Layers3 } from "lucide-react";
import { useNavigate } from "react-router";

export default function ConfigurationDashboard() {
  const navigate = useNavigate();

  const items = [
    {
      title: "Facturación",
      desc: "Configura certificado digital y credenciales SOL.",
      icon: <FileBadge2 className="w-10 h-10 text-[#B23636]" />,
      route: "/configuration/billing",
    },
    {
      title: "Envío de boletas",
      desc: "Define si la boleta se envía por lote o individual.",
      icon: <Layers3 className="w-10 h-10 text-[#B23636]" />,
      route: "/configuration/boleta-batch",
    },
  ];

  return (
    <div className="space-y-4 px-2 py-2 sm:px-1">
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Configuración
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Ajusta parametros clave de operacion y facturacion electronica.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-3">
        {items.map((item) => (
          <button
            type="button"
            key={item.title}
            onClick={() => navigate(item.route)}
            className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#B23636]/35 hover:shadow-md sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="shrink-0 rounded-xl bg-slate-50 p-2.5">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
                </div>
              </div>
              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-[#B23636]" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
