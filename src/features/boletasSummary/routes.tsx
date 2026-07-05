import BoletasSummaryPage from "./pages/BoletasSummaryPage";

export default [
  {
    path: "sales/boletas_summary",
    element: <BoletasSummaryPage />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Resumen de boletas" },
      ],
    },
  },
];

