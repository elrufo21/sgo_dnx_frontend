import PurchanseCreate from "./pages/purchanseCreate";
import PurchanseEdit from "./pages/purchanseEdit";
import PurchanseList from "./pages/purchanseList";

export default [
  {
    path: "purchases",
    element: <PurchanseList />,
    handle: {
      breadcrumb: [{ label: "Compras" }],
    },
  },
  {
    path: "purchases/create",
    element: <PurchanseCreate />,
    handle: {
      breadcrumb: [
        { label: "Compras", to: "/purchases" },
        { label: "Registrar compra" },
      ],
    },
  },
  {
    path: "purchases/:id/edit",
    element: <PurchanseEdit />,
    handle: {
      breadcrumb: [
        { label: "Compras", to: "/purchases" },
        { label: "Editar compra" },
      ],
    },
  },
];
