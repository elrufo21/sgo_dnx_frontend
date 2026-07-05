import CashFlowCreate from "./pages/cashFlowCreate";
import CashFlowEdit from "./pages/cashFlowEdit";
import CashFlowList from "./pages/cashFlowList";

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
        { label: "Registrar Movimiento" },
      ],
    },
  },
  {
    path: "cash_flow_control/:id/edit",
    element: <CashFlowEdit />,
    handle: {
      breadcrumb: [
        { label: "Control de Caja", to: "/cash_flow_control" },
        { label: "Editar Movimiento" },
      ],
    },
  },
];
