import { useNavigate, useParams } from "react-router";
import { toast } from "@/shared/ui/toast";
import SendNoteFormBase from "@/components/SendNoteFormBase";
import { useSendNoteStore } from "@/store/sendNote/sendNote.store";
import type { SendNote } from "@/types/sendNote";

const SendNoteEdit = () => {
  const { id } = useParams<{ id: string }>();
  const { notes, updateNote, deleteNote } = useSendNoteStore();
  const navigate = useNavigate();

  const current = notes.find((n) => String(n.id) === String(id));

  const handleSave = (data: Omit<SendNote, "id">) => {
    if (!id) return;
    updateNote(Number(id), data);
    toast.success("Nota de pedido actualizada");
    navigate("/send_note");
  };

  const handleDelete = () => {
    if (!id) return;
    deleteNote(Number(id));
    toast.success("Nota de pedido eliminada");
    navigate("/send_note");
  };

  if (!current) {
    return <div className="p-4 sm:p-6">Cargando nota...</div>;
  }

  return (
    <SendNoteFormBase
      mode="edit"
      initialData={current}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  );
};

export default SendNoteEdit;
