import { useState } from "react";
import { toast } from "@/shared/ui/toast";

import type { Category } from "@/app/maintenance/types/maintenance";
import CategoriaForm from "@/app/maintenance/categories/components/CategoriaForm";
import { useMaintenanceStore } from "@/app/maintenance/store/maintenance.store";

export default function CategoryCreate() {
  const { addMaintenanceCategory } = useMaintenanceStore();

  const [form, setForm] = useState<Omit<Category, "id">>({
    idLinea: 0,
    nombreSublinea: "",
    codigoSunat: "",
    vista: "V",
  });

  const handleSave = async (data: Omit<Category, "id">) => {
    const created = await addMaintenanceCategory(data);
    if (!created) {
      return;
    }
    toast.success("Sublinea creada correctamente");
    setForm({
      idLinea: 0,
      nombreSublinea: "",
      codigoSunat: "",
      vista: "V",
    });
  };

  const handleNew = () => {
    setForm({
      nombreSublinea: "",
      codigoSunat: "",
    });
  };

  return (
    <CategoriaForm
      mode="create"
      initialData={form}
      onSave={handleSave}
      onNew={handleNew}
    />
  );
}
