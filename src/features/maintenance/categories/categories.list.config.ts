import type { ModuleListConfig } from "@/shared/config/listConfig";
import type { Category } from "@/types/maintenance";

export const categoryListConfig: ModuleListConfig<Category> = {
  basePath: "/maintenance/categories",
  idKey: "id",
  createLabel: "Anadir sublinea",
  deleteMessage: "Seguro deseas eliminar esta sublinea?",
  columns: [
    { key: "id", header: "Id" },
    { key: "idLinea", header: "Id linea" },
    { key: "nombreSublinea", header: "SubLinea" },
    { key: "codigoSunat", header: "CodigoSunat" },
    { key: "vista", header: "Vista" },
  ],
  filterKeys: ["id", "idLinea", "nombreSublinea", "codigoSunat", "vista"],
};
