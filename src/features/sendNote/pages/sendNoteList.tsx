import { CrudList } from "@/components/ListView";
import { useSendNoteStore } from "@/store/sendNote/sendNote.store";

const SendNoteList = () => {
  const { notes, fetchNotes, deleteNote } = useSendNoteStore();

  const columns = [
    { key: "id", header: "ID" },
    { key: "cliente", header: "Cliente" },
    { key: "ruc", header: "RUC" },
    { key: "formaPago", header: "Forma de pago" },
  ];

  return (
    <CrudList
      data={notes}
      fetchData={fetchNotes}
      deleteItem={deleteNote}
      columns={columns}
      basePath="/send_note"
      createLabel="+ Nueva nota"
      deleteMessage="¿Seguro que deseas eliminar esta nota?"
    />
  );
};

export default SendNoteList;
