import {
  ArrowRight,
  Layers,
  Laptop,
  Grid3X3,
  Users2,
  UserCheck2Icon,
  Building2,
  CalendarDays,
  ReceiptText,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/store/auth/auth.store";

export default function MaintenanceDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const items = useMemo(() => {
    const baseItems = [
      {
        title: "Categorías",
        desc: "Gestiona categorías y códigos SUNAT.",
        icon: <Grid3X3 className="w-10 h-10 text-blue-600" />,
        route: "/maintenance/categories",
      },
      {
        title: "Áreas",
        desc: "Organiza las áreas de la empresa.",
        icon: <Layers className="w-10 h-10 text-green-600" />,
        route: "/maintenance/areas",
      },
      {
        title: "Computadoras",
        desc: "Registra y controla los equipos.",
        icon: <Laptop className="w-10 h-10 text-purple-600" />,
        route: "/maintenance/computers",
      },
      {
        title: "Empleados",
        desc: "Registra y controla los empleados",
        icon: <Users2 className="w-10 h-10 text-slate-700" />,
        route: "/maintenance/employees",
      },
      {
        title: "Usuarios",
        desc: "Registra y controla los usuarios",
        icon: <UserCheck2Icon className="w-10 h-10 text-rose-600" />,
        route: "/maintenance/users",
      },
      {
        title: "Proveedores",
        desc: "Gestiona proveedores y contactos.",
        icon: <Building2 className="w-10 h-10 text-amber-600" />,
        route: "/maintenance/providers",
      },
      {
        title: "Feriados",
        desc: "Administra días feriados y motivos.",
        icon: <CalendarDays className="w-10 h-10 text-red-500" />,
        route: "/maintenance/holidays",
      },
    ];

    if (user?.boletaPorLote === false) {
      baseItems.push({
        title: "Resumen de boletas",
        desc: "Visualiza y exporta boletas por rango de fechas.",
        icon: <ReceiptText className="w-10 h-10 text-violet-600" />,
        route: "/maintenance/boletas_summary",
      });
    }

    return baseItems;
  }, [user?.boletaPorLote]);

  return (
    <div className="space-y-4 px-2 py-2 sm:px-1">
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Mantenimiento
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Gestiona configuraciones operativas y catalogos del sistema.
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
