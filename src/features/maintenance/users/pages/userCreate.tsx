import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";

import UserFormBase from "@/components/UserFormBase";
import { useUsersStore } from "@/store/users/users.store";
import type { User } from "@/store/users/users.store";

const UserCreate = () => {
  const { addUser } = useUsersStore();
  const navigate = useNavigate();

  const [form, setForm] = useState<Omit<User, "UsuarioID">>({
    PersonalId: 0,
    UsuarioAlias: "",
    UsuarioClave: "",
    UsuarioFechaReg: new Date().toISOString(),
    UsuarioEstado: "ACTIVO",
    UsuarioSerie: "B001",
    EnviaBoleta: 0,
    EnviarFactura: 0,
    EnviaNC: 0,
    EnviaND: 0,
    Administrador: 0,
  });

  const handleSave = async (data: Omit<User, "UsuarioID">) => {
    const created = await addUser(data);

    if (!created) {
      //  toast.error("No se pudo crear el usuario.");
      return false;
    }

    toast.success("Usuario creado correctamente");
    setForm({
      PersonalId: 0,
      UsuarioAlias: "",
      UsuarioClave: "",
      UsuarioFechaReg: new Date().toISOString(),
      UsuarioEstado: "ACTIVO",
      UsuarioSerie: "B001",
      EnviaBoleta: 0,
      EnviarFactura: 0,
      EnviaNC: 0,
      EnviaND: 0,
      Administrador: 0,
    });
    return true;
  };

  const handleNew = () => {
    setForm({
      PersonalId: 0,
      UsuarioAlias: "",
      UsuarioClave: "",
      UsuarioFechaReg: new Date().toISOString(),
      UsuarioEstado: "ACTIVO",
      UsuarioSerie: "B001",
      EnviaBoleta: 0,
      EnviarFactura: 0,
      EnviaNC: 0,
      EnviaND: 0,
      Administrador: 0,
    });
  };

  return (
    <UserFormBase
      mode="create"
      initialData={form}
      onSave={handleSave}
      onNew={handleNew}
    />
  );
};

export default UserCreate;
