import type { ModuleListConfig } from "@/shared/config/listConfig";
import type { Category } from "@/types/maintenance";

export const categoryListConfig: ModuleListConfig<Category> = {
  basePath: "/maintenance/categories",
  idKey: "id",
  createLabel: "Anadir categoria",
  deleteMessage: "Seguro deseas eliminar esta categoria?",
  columns: [
    { key: "nombreSublinea", header: "Nombre sublinea" },
    { key: "codigoSunat", header: "Codigo SUNAT" },
  ],
  filterKeys: ["nombreSublinea"],
};
