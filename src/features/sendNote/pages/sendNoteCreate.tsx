import { useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";
import SendNoteFormBase from "@/components/SendNoteFormBase";
import { useSendNoteStore } from "@/store/sendNote/sendNote.store";
import type { SendNote } from "@/types/sendNote";

const SendNoteCreate = () => {
  const { addNote } = useSendNoteStore();
  const navigate = useNavigate();

  const handleSave = (data: Omit<SendNote, "id">) => {
    addNote(data);
    toast.success("Nota de pedido creada");
    navigate("/send_note");
  };

  const handleNew = () => {
    // handled in form
  };

  return (
    <SendNoteFormBase mode="create" onSave={handleSave} onNew={handleNew} />
  );
};

export default SendNoteCreate;
