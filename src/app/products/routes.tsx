import ProductList from "./pages/ProductList";
import ProductCreate from "./pages/ProductCreate";
import ProductEdit from "./pages/ProductEdit";
import { Navigate } from "react-router";

export default [
  {
    path: "products/*",
    element: <Navigate to="/maintenance/products" replace />,
  },
  {
    path: "maintenance/products",
    element: <ProductList />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Productos" },
      ],
    },
  },
  {
    path: "maintenance/products/create",
    element: <ProductCreate />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Productos", to: "/maintenance/products" },
        { label: "Crear producto" },
      ],
    },
  },
  {
    path: "maintenance/products/:id/edit",
    element: <ProductEdit />,
    handle: {
      breadcrumb: [
        { label: "Mantenimiento", to: "/maintenance" },
        { label: "Productos", to: "/maintenance/products" },
        { label: "Editar producto" },
      ],
    },
  },
];
