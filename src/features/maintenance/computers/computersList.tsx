import { useCallback } from "react";
import { CrudList } from "@/components/ListView";
import { useMaintenanceStore } from "@/store/maintenance/maintenance.store";
import type { Computer, Area } from "@/types/maintenance";

const ComputerList = () => {
  const { computers, areas, fetchComputers, fetchAreas, deleteComputer } =
    useMaintenanceStore();

  const fetchData = useCallback(() => {
    fetchComputers();
    fetchAreas();
  }, [fetchComputers, fetchAreas]);

  const computerColumns = [
    { key: "maquina", header: "Máquina" },
    { key: "registro", header: "Registro" },
    {
      key: "serieFactura",
      header: "Serie Factura",
      render: (row: Computer) => row.serieFactura || "-",
    },
    {
      key: "serieNc",
      header: "Serie NC",
      render: (row: Computer) => row.serieNc || "-",
    },
    {
      key: "serieBoleta",
      header: "Serie Boleta",
      render: (row: Computer) => row.serieBoleta || "-",
    },
    {
      key: "ticketera",
      header: "Ticketera",
      render: (row: Computer) => row.ticketera || "-",
    },
  ];

  return (
    <CrudList
      data={computers}
      fetchData={fetchData}
      deleteItem={deleteComputer}
      columns={computerColumns}
      basePath="/maintenance/computers"
      createLabel="Añadir computadora"
      deleteMessage="¿Estás seguro de eliminar esta computadora?"
      filterKeys={[
        "maquina",
        "serieFactura",
        "serieNc",
        "serieBoleta",
        "ticketera",
      ]}
    />
  );
};

export default ComputerList;
