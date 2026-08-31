import CashFlowCreate from "./pages/cashFlowCreate";
import CashFlowList from "./pages/cashFlowList";
import PettyCashMovementPage from "./pages/PettyCashMovementPage";
import CashFinalReportPage from "./pages/CashFinalReportPage";

export default [
  {
    path: "cash_flow_control",
    element: <CashFlowList />,
    handle: {
      breadcrumb: [{ label: "Control de Caja" }],
    },
  },
  {
    path: "cash_flow_control/create",
    element: <CashFlowCreate />,
    handle: {
      breadcrumb: [
        { label: "Control de Caja", to: "/cash_flow_control" },
        { label: "Apertura de caja" },
      ],
    },
  },
  {
    path: "cash-final-report",
    element: <CashFinalReportPage />,
    handle: {
      breadcrumb: [{ label: "Generar informe de caja final" }],
    },
  },
  {
    path: "petty-cash-movements",
    element: <PettyCashMovementPage />,
    handle: {
      breadcrumb: [{ label: "Movimiento de Caja Chica" }],
    },
  },
  {
    path: "cash_flow_control/view/:cajaId",
    element: <CashFlowCreate />,
    handle: {
      breadcrumb: [
        { label: "Control de Caja", to: "/cash_flow_control" },
        { label: "Caja" },
      ],
    },
  },
];
