import { useCallback, useEffect, useState } from "react";
import { CrudList } from "@/components/ListView";
import { employeeListConfig } from "./employee.list.config";
import { useEmployeesStore } from "@/store/employees/employees.store";

export default function EmployeeListPage() {
  const { employees, fetchEmployees, deleteEmployee } = useEmployeesStore();
  const [estadoFilter, setEstadoFilter] = useState<"ACTIVO" | "INACTIVO">(
    "ACTIVO"
  );

  const fetchFiltered = useCallback(
    () => fetchEmployees(estadoFilter),
    [fetchEmployees, estadoFilter]
  );

  useEffect(() => {
    fetchFiltered();
  }, [fetchFiltered]);

  return (
    <CrudList
      data={employees}
      fetchData={fetchFiltered}
      deleteItem={deleteEmployee}
      {...employeeListConfig}
      renderFilters={
        <div className="flex items-center gap-2">
          <select
            value={estadoFilter}
            onChange={(e) =>
              setEstadoFilter(e.target.value as "ACTIVO" | "INACTIVO")
            }
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="ACTIVO">Activos</option>
            <option value="INACTIVO">Inactivos</option>
          </select>
        </div>
      }
    />
  );
}
