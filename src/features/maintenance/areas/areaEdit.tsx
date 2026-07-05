import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";
import { useMaintenanceStore } from "@/store/maintenance/maintenance.store";
import type { Area } from "@/types/maintenance";
import AreaForm from "@/components/maintenance/AreaForm";
import { useAreasQuery } from "./useAreasQuery";
import { useDialogStore } from "@/store/app/dialog.store";

export default function AreaEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const openDialog = useDialogStore((s) => s.openDialog);
  const { updateArea, deleteArea, areas } = useMaintenanceStore();
  const { data = [] } = useAreasQuery();

  const [initialData, setInitialData] = useState<Area | undefined>();

  useEffect(() => {
    const source = areas.length ? areas : data;
    const area = source.find((a) => Number(a.id) === Number(id));
    if (area) setInitialData(area);
  }, [areas, data, id]);

  if (!initialData) return <div>Cargando area...</div>;

  const handleSave = async (data: Area) => {
    if (!id) return;
    const updated = await updateArea(Number(id), data);
    if (!updated) {
      return;
    }
    toast.success("Area actualizada correctamente");
    navigate("/maintenance/areas");
  };

  const handleDelete = async () => {
    if (!id) return;
    openDialog({
      title: "Eliminar",
      content: <p>Seguro que deseas eliminar esta area?</p>,
      onConfirm: async () => {
        try {
          const result = await deleteArea(Number(id));
          if (result === false) {
            toast.error("No se pudo eliminar el area.");
            return;
          }
          toast.success("Area eliminada");
          navigate("/maintenance/areas");
        } catch (error) {
          console.error("Error eliminando area", error);
          toast.error("Ocurrio un error al eliminar el area.");
        }
      },
    });
  };

  return (
    <AreaForm
      mode="edit"
      initialData={initialData}
      onSave={handleSave}
      onNew={() => navigate("/maintenance/areas/create")}
      onDelete={handleDelete}
    />
  );
}
