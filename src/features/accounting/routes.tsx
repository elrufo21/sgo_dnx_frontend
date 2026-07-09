import AccountingDashboard from "./pages/AccountingDashboard";
import BoletasSummaryPage from "@/features/boletasSummary/pages/BoletasSummaryPage";
import PdtCompanyPage from "./pages/PdtCompanyPage";

export default [
  {
    path: "accounting",
    element: <AccountingDashboard />,
    handle: {
      breadcrumb: [{ label: "Contabilidad" }],
    },
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
