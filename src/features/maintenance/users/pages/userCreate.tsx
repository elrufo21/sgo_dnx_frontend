import { useState } from "react";
import { toast } from "@/shared/ui/toast";

import UserFormBase from "@/components/UserFormBase";
import { useUsersStore } from "@/store/users/users.store";
import type { User } from "@/store/users/users.store";

const UserCreate = () => {
  const { addMaintenanceUser } = useUsersStore();

  const [form, setForm] = useState<Omit<User, "UsuarioID">>({
    PersonalId: 0,
    UsuarioAlias: "",
    UsuarioClave: "",
    UsuarioFechaReg: new Date().toISOString(),
    UsuarioEstado: "ACTIVO",
    UsuarioSerie: "B001",
    EnviaBoleta: 1,
    EnviarFactura: 1,
    EnviaNC: 1,
    EnviaND: 1,
    Administrador: 1,
  });

  const handleSave = async (data: Omit<User, "UsuarioID">) => {
    const created = await addMaintenanceUser(data);

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
      EnviaBoleta: 1,
      EnviarFactura: 1,
      EnviaNC: 1,
      EnviaND: 1,
      Administrador: 1,
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
      EnviaBoleta: 1,
      EnviarFactura: 1,
      EnviaNC: 1,
      EnviaND: 1,
      Administrador: 1,
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
