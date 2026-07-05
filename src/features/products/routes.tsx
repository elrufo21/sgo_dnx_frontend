import ProductList from "./pages/ProductList";
import ProductCreate from "./pages/ProductCreate";
import ProductEdit from "./pages/ProductEdit";

export default [
  {
    path: "products",
    element: <ProductList />,
    handle: {
      breadcrumb: [{ label: "Productos" }],
    },
  },
  {
    path: "products/create",
    element: <ProductCreate />,
    handle: {
      breadcrumb: [
        { label: "Productos", to: "/products" },
        { label: "Crear producto" },
      ],
    },
  },
  {
    path: "products/:id/edit",
    element: <ProductEdit />,
    handle: {
      breadcrumb: [
        { label: "Productos", to: "/products" },
        { label: "Editar producto" },
      ],
    },
  },
];
