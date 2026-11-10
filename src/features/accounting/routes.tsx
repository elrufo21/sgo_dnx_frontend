import AccountingDashboard from "./pages/AccountingDashboard";
import BoletasSummaryPage from "@/features/boletasSummary/pages/BoletasSummaryPage";
import InvoiceDispatchPage from "./pages/InvoiceDispatchPage";
import PdtCompanyPage from "./pages/PdtCompanyPage";
import SireVentasPage from "./pages/SireVentasPage";
import SireComprasPage from "./pages/SireComprasPage";
import CreditNotesPage from "./pages/CreditNotesPage";
import CreditNoteDetailPage from "./pages/CreditNoteDetailPage";
import ValuedInventoryPage from "./pages/ValuedInventoryPage";
import InventoryPreviewPage from "./pages/InventoryPreviewPage";

export default [
  {
    path: "accounting",
    element: <AccountingDashboard />,
    handle: {
      breadcrumb: [{ label: "Contabilidad" }],
    },
  },
  {
    path: "accounting/inventario-valorizado/vista-previa",
    element: <InventoryPreviewPage />,
    handle: { breadcrumb: [{ label: "Contabilidad", to: "/accounting" }, { label: "Inventario permanente valorizado", to: "/accounting/inventario-valorizado" }, { label: "Vista previa" }] },
  },
  {
    path: "accounting/inventario-valorizado",
    element: <ValuedInventoryPage />,
    handle: { breadcrumb: [{ label: "Contabilidad", to: "/accounting" }, { label: "Inventario permanente valorizado" }] },
  },
  {
    path: "accounting/credit-notes",
    element: <CreditNotesPage />,
    handle: { breadcrumb: [{ label: "Contabilidad", to: "/accounting" }, { label: "Notas de crédito" }] },
  },
  {
    path: "accounting/credit-notes/:id",
    element: <CreditNoteDetailPage />,
    handle: { breadcrumb: [{ label: "Contabilidad", to: "/accounting" }, { label: "Notas de crédito", to: "/accounting/credit-notes" }, { label: "Detalle" }] },
  },
  {
    path: "accounting/pdt-company",
    element: <PdtCompanyPage />,
    handle: {
      breadcrumb: [
        { label: "Contabilidad", to: "/accounting" },
        { label: "PDT Empresa" },
      ],
    },
  },
  {
    path: "accounting/invoice-dispatch",
    element: <InvoiceDispatchPage />,
    handle: {
      breadcrumb: [
        { label: "Contabilidad", to: "/accounting" },
        { label: "Envio de facturas" },
      ],
    },
  },
  {
    path: "accounting/sire-ventas",
    element: <SireVentasPage />,
    handle: { breadcrumb: [{ label: "Contabilidad", to: "/accounting" }, { label: "SIRE ventas" }] },
  },
  {
    path: "accounting/sire-compras",
    element: <SireComprasPage />,
    handle: { breadcrumb: [{ label: "Contabilidad", to: "/accounting" }, { label: "SIRE compras" }] },
  },
  {
    path: "accounting/boletas_summary",
    element: <BoletasSummaryPage />,
    handle: {
      breadcrumb: [
        { label: "Contabilidad", to: "/accounting" },
        { label: "Resumen de boletas" },
      ],
    },
  },
];
