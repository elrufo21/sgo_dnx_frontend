import { useEffect, useState, useCallback } from "react";
import { CrudList } from "@/components/ListView";
import { useClientsStore } from "@/store/customers/customers.store";

const CustomerList = () => {
  const { clients, fetchClients, deleteClient } = useClientsStore();
  const [estadoFilter, setEstadoFilter] = useState<"ACTIVO" | "INACTIVO">(
    "ACTIVO"
  );

  const fetchFiltered = useCallback(
    () => fetchClients(estadoFilter),
    [fetchClients, estadoFilter]
  );

  useEffect(() => {
    fetchFiltered();
  }, [fetchFiltered]);

  const columns = [
    { key: "nombreRazon", header: "Nombre o Razón social" },
    { key: "ruc", header: "RUC" },
    { key: "dni", header: "DNI" },
    { key: "telefonoMovil", header: "Teléfono" },
    { key: "email", header: "Email" },
  ];

  return (
    <CrudList
      data={clients}
      fetchData={fetchFiltered}
      deleteItem={deleteClient}
      columns={columns}
      basePath="/customers"
      createLabel="Añadir cliente"
      deleteMessage="¿Estás seguro de eliminar este cliente?"
      filterKeys={["nombreRazon", "ruc", "dni", "email"]}
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
};

export default CustomerList;
