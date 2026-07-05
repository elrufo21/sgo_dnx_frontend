import type { ModuleListConfig } from "@/shared/config/listConfig";
import type { Client } from "@/types/customer";

export const customerListConfig: ModuleListConfig<Client> = {
  basePath: "/customers",
  columns: [
    { key: "nombreRazon", header: "Nombre o Razon social" },
    { key: "ruc", header: "RUC" },
    { key: "dni", header: "DNI" },
    { key: "telefonoMovil", header: "Telefono" },
    { key: "email", header: "Email" },
  ],
  idKey: "id",
  createLabel: "+ Anadir cliente",
  deleteMessage: "Estas seguro de eliminar este cliente?",
};
