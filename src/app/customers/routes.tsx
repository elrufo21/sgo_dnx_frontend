import CustomerCreate from "./pages/customerCreate";
import CustomerEdit from "./pages/customerEdit";
import CustomerList from "./pages/customerList";

export default [
  {
    path: "customers",
    element: <CustomerList />,
    handle: {
      breadcrumb: [{ label: "Clientes" }],
    },
  },
  {
    path: "customers/create",
    element: <CustomerCreate />,
    handle: {
      breadcrumb: [
        { label: "Clientes", to: "/customers" },
        { label: "Crear cliente" },
      ],
    },
  },
  {
    path: "customers/:id/edit",
    element: <CustomerEdit />,
    handle: {
      breadcrumb: [
        { label: "Clientes", to: "/customers" },
        { label: "Editar cliente" },
      ],
    },
  },
];
