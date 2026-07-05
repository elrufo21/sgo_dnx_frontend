import AccountingDashboard from "./pages/AccountingDashboard";
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
];
