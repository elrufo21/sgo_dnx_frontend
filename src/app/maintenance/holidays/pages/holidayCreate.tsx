import { useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";
import HolidayForm from "@/app/maintenance/holidays/components/HolidayForm";
import { useMaintenanceStore } from "@/app/maintenance/store/maintenance.store";
import type { Holiday } from "@/app/maintenance/types/maintenance";

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
