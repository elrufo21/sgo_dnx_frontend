import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";
import ProviderForm from "@/components/maintenance/ProviderForm";
import type { Provider } from "@/types/maintenance";
import { useMaintenanceStore } from "@/store/maintenance/maintenance.store";
import { useProvidersQuery } from "./useProvidersQuery";
import { useDialogStore } from "@/store/app/dialog.store";

export default function ProviderEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const openDialog = useDialogStore((s) => s.openDialog);

  const {
    updateProvider,
    deleteProvider,
    providers,
  } = useMaintenanceStore();
  const { data = [] } = useProvidersQuery();

  const [initialData, setInitialData] = useState<Provider | undefined>();

  useEffect(() => {
    const source = providers.length ? providers : data;
    const provider = source.find((p) => Number(p.id) === Number(id));
    if (provider) setInitialData(provider);
  }, [providers, data, id]);

  if (!initialData) return <div>Cargando proveedor...</div>;

  const handleSave = async (
    formData: Provider
  ) => {
    if (!id) return;
    const rs = await updateProvider(Number(id), formData);
    if (!rs) {
      return;
    }
    toast.success("Proveedor actualizado correctamente");
    navigate("/maintenance/providers");
  };

  const handleDelete = async () => {
    if (!id) return;
    openDialog({
      title: "Eliminar",
      content: <p>Seguro que deseas eliminar este proveedor?</p>,
      onConfirm: async () => {
        try {
          const result = await deleteProvider(Number(id));
          if (result === false) {
            toast.error("No se pudo eliminar el proveedor.");
            return;
          }
          toast.success("Proveedor eliminado");
          navigate("/maintenance/providers");
        } catch (error) {
          console.error("Error eliminando proveedor", error);
          toast.error("Ocurrio un error al eliminar el proveedor.");
        }
      },
    });
  };

  return (
    <ProviderForm
      mode="edit"
      initialData={initialData}
      onSave={handleSave}
      onNew={() => navigate("/maintenance/providers/create")}
      onDelete={handleDelete}
    />
  );
}
