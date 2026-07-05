import type { ModuleListConfig } from "@/shared/config/listConfig";
import type { Holiday } from "@/types/maintenance";
import { formatDate } from "@/shared/helpers/formatDate";

export const holidaysListConfig: ModuleListConfig<Holiday> = {
  basePath: "/maintenance/holidays",
  columns: [
    {
      key: "fecha",
      header: "Fecha",
      render: (row) => formatDate(row.fecha),
    },
    { key: "motivo", header: "Motivo" },
  ],
  idKey: "id",
  createLabel: "Añadir feriado",
  deleteMessage: "Seguro que deseas eliminar este feriado?",
};
