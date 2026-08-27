import type { ModuleListConfig } from "@/shared/config/listConfig";
import type { Category } from "@/types/maintenance";

export const categoryListConfig: ModuleListConfig<Category> = {
  basePath: "/maintenance/categories",
  idKey: "id",
  createLabel: "Anadir sublinea",
  deleteMessage: "Seguro deseas eliminar esta sublinea?",
  columns: [
    { key: "id", header: "Id" },
    { key: "nombreSublinea", header: "Categoria" },
    { key: "codigoSunat", header: "CodigoSunat" },
  ],
  filterKeys: ["id", "idLinea", "nombreSublinea", "codigoSunat", "vista"],
};
