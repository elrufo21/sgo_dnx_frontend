import SendNoteList from "./pages/sendNoteList";
import SendNoteCreate from "./pages/sendNoteCreate";
import SendNoteEdit from "./pages/sendNoteEdit";

export default [
  {
    path: "send_note",
    element: <SendNoteList />,
    handle: {
      breadcrumb: [{ label: "Nota de pedido" }],
    },
  },
  {
    path: "send_note/create",
    element: <SendNoteCreate />,
    handle: {
      breadcrumb: [
        { label: "Nota de pedido", to: "/send_note" },
        { label: "Crear" },
      ],
    },
  },
  {
    path: "send_note/:id/edit",
    element: <SendNoteEdit />,
    handle: {
      breadcrumb: [
        { label: "Nota de pedido", to: "/send_note" },
        { label: "Editar" },
      ],
    },
  },
];
