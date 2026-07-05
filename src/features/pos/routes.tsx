import POSPage from "./pages/POSPage";
import PaymentPage from "./pages/PaymentPage";

export default [
  {
    path: "pos",
    element: <POSPage />,
    handle: {
      breadcrumb: [{ label: "POS" }],
    },
  },
  {
    path: "pos/payment",
    element: <PaymentPage />,
    handle: {
      breadcrumb: [
        { label: "POS", to: "/pos" },
        { label: "Pago" },
      ],
    },
  },
  {
    path: "pos/payment/:notaId",
    element: <PaymentPage />,
    handle: {
      breadcrumb: [
        { label: "POS", to: "/pos" },
        { label: "Pago" },
      ],
    },
  },
];
