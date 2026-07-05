import type { ModuleListConfig } from "@/shared/config/listConfig";
import type { Provider } from "@/types/maintenance";

export const providerListConfig: ModuleListConfig<Provider> = {
  basePath: "/maintenance/providers",
  columns: [
    { key: "razon", header: "Razon social" },
    { key: "ruc", header: "RUC" },
    { key: "contacto", header: "Contacto" },
    { key: "telefono", header: "Telefono" },
    { key: "correo", header: "Correo" },
    { key: "estado", header: "Estado" },
  ],
  idKey: "id",
  createLabel: "Añadir proveedor",
  deleteMessage: "Seguro que deseas eliminar este proveedor?",
};
