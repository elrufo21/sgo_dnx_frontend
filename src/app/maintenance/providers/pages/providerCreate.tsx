import { useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";
import ProviderForm from "@/app/maintenance/providers/components/ProviderForm";
import { useMaintenanceStore } from "@/app/maintenance/store/maintenance.store";
import type { Provider } from "@/app/maintenance/types/maintenance";

export default function ProviderCreate() {
  const navigate = useNavigate();
  const { addProvider } = useMaintenanceStore();

  const handleSave = async (
    data: Provider
  ) => {
    const rs = await addProvider(data);
    if (!rs) {
      return;
    }
    toast.success("Proveedor creado correctamente");
  };

  const handleNew = () => {
    navigate("/maintenance/providers/create");
  };

  return <ProviderForm mode="create" onSave={handleSave} onNew={handleNew} />;
}
