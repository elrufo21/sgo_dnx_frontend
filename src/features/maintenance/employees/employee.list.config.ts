import type { ModuleListConfig } from "@/shared/config/listConfig";
import type { Employee } from "@/types/employees";
import { formatDate } from "@/shared/helpers/formatDate";

export const employeeListConfig: ModuleListConfig<Employee> = {
  basePath: "/maintenance/employees",
  idKey: "personalId",
  createLabel: "Anadir empleado",
  deleteMessage: "Seguro que deseas eliminar este empleado?",
  columns: [
    {
      id: "nombreCompleto",
      header: "Nombres",
      render: (row) =>
        `${row.personalNombres ?? ""} ${row.personalApellidos ?? ""}`.trim(),
    },
    { key: "personalTelefono", header: "Telefono" },
    { key: "personalEmail", header: "Email" },
    {
      key: "personalNacimiento",
      header: "F. nacimiento",
      render: (row) => formatDate(row.personalNacimiento),
    },
    { key: "personalDni", header: "DNI" },
  ],
  filterKeys: [
    "personalNombres",
    "personalApellidos",
    "personalDni",
    "personalEmail",
  ],
};
