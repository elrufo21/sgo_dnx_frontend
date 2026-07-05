import SalesDashboard from "./pages/SalesDashboard";
import POSPage from "@/features/pos/pages/POSPage";
import PaymentPage from "@/features/pos/pages/PaymentPage";
import SendNoteList from "@/features/sendNote/pages/sendNoteList";
import SendNoteCreate from "@/features/sendNote/pages/sendNoteCreate";
import SendNoteEdit from "@/features/sendNote/pages/sendNoteEdit";
import OrderNotesList from "@/features/orderNotes/pages/orderNotesList";
import PurchanseList from "@/features/purchanses/pages/purchanseList";
import PurchanseCreate from "@/features/purchanses/pages/purchanseCreate";
import PurchanseEdit from "@/features/purchanses/pages/purchanseEdit";
import SmallCashPage from "./pages/SmallCashPage";
import HtmlCaptureSalePage from "./pages/HtmlCaptureSalePage";

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
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Ventas" },
      ],
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
    element: <HtmlCaptureSalePage />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Captura HTML" },
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
    element: <SmallCashPage />,
    handle: {
      breadcrumb: [
        { label: "Ventas", to: "/sales" },
        { label: "Caja chica" },
      ],
    },
  },
];
