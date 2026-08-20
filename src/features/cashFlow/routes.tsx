import CashFlowCreate from "./pages/cashFlowCreate";
import CashFlowList from "./pages/cashFlowList";
import PettyCashMovementPage from "./pages/PettyCashMovementPage";

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
