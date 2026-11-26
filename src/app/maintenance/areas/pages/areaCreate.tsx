import { useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";
import AreaForm from "@/app/maintenance/areas/components/AreaForm";
import { useMaintenanceStore } from "@/app/maintenance/store/maintenance.store";

export default function AreaCreate() {
  const navigate = useNavigate();
  const { addArea } = useMaintenanceStore();

  const handleSave = async (data: any) => {
    const rs = await addArea(data);
    if (!rs) return;
    toast.success("Área creada correctamente");
    navigate("/maintenance/areas/create");
  };

  const handleNew = () => {
    navigate("/maintenance/areas/create");
  };

  return <AreaForm mode="create" onSave={handleSave} onNew={handleNew} />;
}
