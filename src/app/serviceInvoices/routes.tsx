import ServiceInvoiceCreate from "./pages/ServiceInvoiceCreate";
import ServiceInvoiceList from "./pages/ServiceInvoiceList";

export default [
  {
    path: "service-invoices",
    element: <ServiceInvoiceList />,
    handle: { breadcrumb: [{ label: "Facturas de servicio" }] },
  },
  {
    path: "service-invoices/create",
    element: <ServiceInvoiceCreate />,
    handle: {
      breadcrumb: [
        { label: "Facturas de servicio", to: "/service-invoices" },
        { label: "Enviar" },
      ],
    },
  },
  {
    path: "service-invoices/:docuId",
    element: <ServiceInvoiceCreate />,
    handle: {
      breadcrumb: [
        { label: "Facturas de servicio", to: "/service-invoices" },
        { label: "Ver" },
      ],
    },
  },
];
