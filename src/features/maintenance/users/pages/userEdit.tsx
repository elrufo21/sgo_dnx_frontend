import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "@/shared/ui/toast";
import { useDialogStore } from "@/store/app/dialog.store";
import UserFormBase from "@/components/UserFormBase";
import type { User } from "@/store/employees/employees.store";
import { useUsersStore } from "@/store/users/users.store";

const UserEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const openDialog = useDialogStore((s) => s.openDialog);

  const { users, updateUser, fetchUsers, deleteUser } = useUsersStore();

  const [form, setForm] = useState<Omit<User, "id"> | null>(null);

  useEffect(() => {
    if (users.length === 0) fetchUsers();
  }, [users, fetchUsers]);

  useEffect(() => {
    const user = users.find((e) => e.UsuarioID === Number(id));
    if (user) {
      const { id: _, ...rest } = user;
      setForm(rest);
    }
  }, [users, id]);

  if (!form) return <div>Cargando empleado...</div>;

  const handleSave = async (data: Omit<User, "id">) => {
    const updated = await updateUser(Number(id), data);
    console.log("updated", updated);
    if (!updated) {
      toast.error("No se pudo guardar el usuario.");
      return false;
    }

    toast.success("Empleado guardado correctamente");
    navigate("/maintenance/users");
    return true;
  };

  const handleDelete = () => {
    if (!id) return;
    openDialog({
      title: "Eliminar",
      content: <p>Seguro que deseas eliminar este usuario?</p>,
      onConfirm: async () => {
        try {
          const result = await deleteUser(Number(id));
          if (result === false) {
            toast.error("No se pudo eliminar el usuario.");
            return;
          }
          toast.success("Empleado eliminado correctamente");
          navigate("/maintenance/users");
        } catch (error) {
          console.error("Error eliminando usuario", error);
          toast.error("Ocurrio un error al eliminar el usuario.");
        }
      },
    });
  };

  const handleNew = () => navigate("/maintenance/users/create");

  return (
    <UserFormBase
      mode="edit"
      initialData={form}
      onSave={handleSave}
      onDelete={handleDelete}
      onNew={handleNew}
    />
  );
};

export default UserEdit;
