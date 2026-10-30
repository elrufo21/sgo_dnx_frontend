import type { ModuleListConfig } from "@/shared/config/listConfig";
import type { User } from "@/store/users/users.store";

export const userListConfig: ModuleListConfig<User> = {
  basePath: "/maintenance/users",
  idKey: "UsuarioID",
  createLabel: "Anadir usuario",
  deleteMessage: "Seguro que deseas eliminar este usuario?",
  columns: [
    { key: "Nombre", header: "Personal" },
    { key: "UsuarioAlias", header: "Usuario" },
    { key: "area", header: "Area" },
    { key: "UsuarioEstado", header: "Estado" },
  ],
  filterKeys: ["Nombre", "UsuarioAlias", "area", "UsuarioEstado"],
};
