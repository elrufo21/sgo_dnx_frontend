import {
  ArrowRight,
  DollarSign,
  FileInput,
  LucideDollarSign,
  NotebookPen,
  ReceiptText,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useAuthStore } from "@/store/auth/auth.store";

const cards = [
  {
    title: "Punto de venta",
    desc: "Accede al POS para registrar ventas rápidas.",
    icon: <LucideDollarSign className="w-10 h-10 text-emerald-600" />,
    route: "/sales/pos",
  },
  {
    title: "Captura HTML",
    desc: "Carga la venta desde el comprobante HTML de DXN.",
    icon: <FileInput className="w-10 h-10 text-sky-600" />,
    route: "/sales/html_capture",
  },
  {
    title: "Lista pedidos",
    desc: "Consulta el listado de pedidos.",
    icon: <NotebookPen className="w-10 h-10 text-amber-600" />,
    route: "/sales/order_notes",
  },
  {
    title: "Caja chica",
    desc: "Gestiona los movimientos de caja chica.",
    icon: <DollarSign className="w-10 h-10 text-blue-600" />,
    route: "/sales/small_cash",
  },
  {
    title: "Resumen de boletas",
    desc: "Visualiza y exporta boletas por rango de fechas.",
    icon: <ReceiptText className="w-10 h-10 text-violet-600" />,
    route: "/sales/boletas_summary",
  },
];

export default function SalesDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const visibleCards = useMemo(() => {
    if (user?.boletaPorLote === false) {
      return cards.filter((card) => card.route !== "/sales/boletas_summary");
    }
    return cards;
  }, [user?.boletaPorLote]);

  return (
    <div className="space-y-4 px-2 py-2 sm:px-1">
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
          Ventas
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Accede rapidamente a los modulos mas usados de ventas.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-3">
        {visibleCards.map((card) => (
          <button
            type="button"
            key={card.title}
            onClick={() => navigate(card.route)}
            className="group rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#B23636]/35 hover:shadow-md sm:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="shrink-0 rounded-xl bg-slate-50 p-2.5">
                  {card.icon}
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
                    {card.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">{card.desc}</p>
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
