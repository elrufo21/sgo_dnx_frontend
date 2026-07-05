import { useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";
import HolidayForm from "@/components/maintenance/HolidayForm";
import { useMaintenanceStore } from "@/store/maintenance/maintenance.store";
import type { Holiday } from "@/types/maintenance";

export default function HolidayCreate() {
  const navigate = useNavigate();
  const { addHoliday } = useMaintenanceStore();

  const handleSave = async (data: Holiday) => {
    const rs = await addHoliday(data);
    if (!rs) return;
    toast.success("Feriado creado correctamente");
    navigate("/maintenance/holidays");
  };

  const handleNew = () => {
    navigate("/maintenance/holidays/create");
  };

  return <HolidayForm mode="create" onSave={handleSave} onNew={handleNew} />;
}
