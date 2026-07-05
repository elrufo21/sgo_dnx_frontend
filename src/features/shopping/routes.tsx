import ShoppingList from "./pages/shoppingList";
import ShoppingCreate from "./pages/shoppingCreate";
import ShoppingEdit from "./pages/shoppingEdit";

export default [
  {
    path: "shopping",
    element: <ShoppingList />,
    handle: { breadcrumb: [{ label: "Compras" }] },
  },
  {
    path: "shopping/create",
    element: <ShoppingCreate />,
    handle: {
      breadcrumb: [
        { label: "Compras", to: "/shopping" },
        { label: "Crear compra" },
      ],
    },
  },
  {
    path: "shopping/:id/edit",
    element: <ShoppingEdit />,
    handle: {
      breadcrumb: [
        { label: "Compras", to: "/shopping" },
        { label: "Editar compra" },
      ],
    },
  },
];
