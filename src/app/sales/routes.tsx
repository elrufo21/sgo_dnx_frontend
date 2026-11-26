import SalesDashboard from "./pages/SalesDashboard";
import POSPage from "@/app/pos/pages/POSPage";
import PaymentPage from "@/app/pos/pages/PaymentPage";
import SendNoteList from "@/app/sendNote/pages/sendNoteList";
import SendNoteCreate from "@/app/sendNote/pages/sendNoteCreate";
import SendNoteEdit from "@/app/sendNote/pages/sendNoteEdit";
import OrderNotesList from "@/app/orderNotes/pages/orderNotesList";
import PurchanseList from "@/app/purchases/pages/purchanseList";
import PurchanseCreate from "@/app/purchases/pages/purchanseCreate";
import PurchanseEdit from "@/app/purchases/pages/purchanseEdit";
import HtmlCaptureSalePage from "./pages/HtmlCaptureSalePage";
import ObsCashierCapturePage from "./pages/ObsCashierCapturePage";
import DeliveryGuidePage from "./pages/DeliveryGuidePage";
import { Navigate } from "react-router";

export default [
  {
    path: "sales",
    element: <SalesDashboard />,
    handle: {
      breadcrumb: [{ label: "Ventas" }],
    },
  },
  // Ventas (listado, crear, editar)
  {
    path: "sales/purchases",
    element: <PurchanseList />,
    handle: {
      breadcrumb: [{ label: "Ventas", to: "/sales" }, { label: "Ventas" }],
    },
  },
  {
    path: "sales/purchases/create",
    element: <PurchanseCreate />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Ventas", to: "/sales/purchases" },
        { label: "Registrar venta" },
      ],
    },
  },
  {
    path: "sales/purchases/:id/edit",
    element: <PurchanseEdit />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Ventas", to: "/sales/purchases" },
        { label: "Editar venta" },
      ],
    },
  },

  // Punto de venta
  {
    path: "sales/pos",
    element: <POSPage />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Punto de venta" },
      ],
    },
  },
  {
    path: "sales/html_capture",
    element: <Navigate to="/sales/html_capture/new" replace />,
  },
  {
    path: "sales/html_capture/new",
    element: <HtmlCaptureSalePage />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Captura HTML" },
      ],
    },
  },
  {
    path: "sales/html_capture/:id",
    element: <HtmlCaptureSalePage />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Captura HTML" },
      ],
    },
  },
  {
    path: "sales/obs_capture",
    element: <ObsCashierCapturePage />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Extraer Ventas OBS" },
      ],
    },
  },
  {
    path: "sales/delivery-guide",
    element: <DeliveryGuidePage />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Guía de remisión" },
      ],
    },
  },
  {
    path: "sales/pos/payment",
    element: <PaymentPage />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Punto de venta", to: "/sales/pos" },
        { label: "Pago" },
      ],
    },
  },

  // Nota de pedido
  {
    path: "sales/send_note",
    element: <SendNoteList />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Nota de pedido" },
      ],
    },
  },
  {
    path: "sales/send_note/create",
    element: <SendNoteCreate />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Nota de pedido", to: "/sales/send_note" },
        { label: "Crear" },
      ],
    },
  },
  {
    path: "sales/send_note/:id/edit",
    element: <SendNoteEdit />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Nota de pedido", to: "/sales/send_note" },
        { label: "Editar" },
      ],
    },
  },

  // Nota pedidos
  {
    path: "sales/order_notes",
    element: <OrderNotesList />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Nota pedidos" },
      ],
    },
  },
  {
    path: "sales/pos/payment/:notaId",
    element: <PaymentPage />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Punto de venta", to: "/sales/pos" },
        { label: "Pago" },
      ],
    },
  },
  {
    path: "sales/order_notes/:notaId/view",
    element: <PaymentPage />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Nota pedidos", to: "/sales/order_notes" },
        { label: "Ver" },
      ],
    },
  },
  {
    path: "sales/order_notes/:notaId/edit",
    element: <PaymentPage />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Nota pedidos", to: "/sales/order_notes" },
        { label: "Editar" },
      ],
    },
  },

  // Caja chica
  {
    path: "sales/small_cash",
    element: <Navigate to="/petty-cash-movements" replace />,
    handle: {
      breadcrumb: [{ label: "Ventas", to: "/sales" }, { label: "Caja chica" }],
    },
  },
];
