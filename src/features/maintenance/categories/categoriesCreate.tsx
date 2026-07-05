import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";

import type { Category } from "@/types/maintenance";
import CategoriaForm from "@/components/maintenance/CategoriaForm";
import { useMaintenanceStore } from "@/store/maintenance/maintenance.store";

export default function CategoryCreate() {
  const navigate = useNavigate();
  const { addCategory } = useMaintenanceStore();

  const [form, setForm] = useState<Omit<Category, "id">>({
    nombreSublinea: "",
    codigoSunat: "",
  });

  const handleSave = async (data: Omit<Category, "id">) => {
    const created = await addCategory(data);
    if (!created) {
      return;
    }
    toast.success("Categoria creada correctamente");
    setForm({
      nombreSublinea: "",
      codigoSunat: "",
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
