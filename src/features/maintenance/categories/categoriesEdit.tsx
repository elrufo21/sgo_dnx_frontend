import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";
import { useMaintenanceStore } from "@/store/maintenance/maintenance.store";
import type { Category } from "@/types/maintenance";
import CategoriaForm from "@/components/maintenance/CategoriaForm";
import { useDialogStore } from "@/store/app/dialog.store";

export default function CategoryEdit() {
  const openDialog = useDialogStore((s) => s.openDialog);
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { categories, fetchCategories, updateCategory, deleteCategory } =
    useMaintenanceStore();

  const [category, setCategory] = useState<Category | null>(null);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (categories.length > 0 && id) {
      const found = categories.find((c) => String(c.id) === id);
      if (found) setCategory(found);
    }
  }, [categories, id]);

  const handleSave = async (data: Category) => {
    if (!id) return;
    const res = await updateCategory(Number(id), data);
    if (!res) {
      return;
    }
    toast.success("Categoria actualizada");
    navigate("/maintenance/categories");
  };

  const handleNew = () => {
    navigate("/maintenance/categories/create");
  };

  const handleDelete = () => {
    if (!id) return;
    openDialog({
      title: "Eliminar",
      content: <p>Seguro que deseas eliminar esta categoria?</p>,
      onConfirm: async () => {
        try {
          const result = await deleteCategory(Number(id));
          if (result === false) {
            toast.error("No se pudo eliminar la categoria.");
            return;
          }
          toast.success("Elemento eliminado.");
          navigate("/maintenance/categories");
        } catch (error) {
          console.error("Error eliminando categoria", error);
          toast.error("Ocurrio un error al eliminar la categoria.");
        }
      },
    });
  };

  if (!category) {
    return <p className="p-4 sm:p-6">Cargando categoria...</p>;
  }

  return (
    <CategoriaForm
      mode="edit"
      initialData={category}
      onSave={handleSave}
      onNew={handleNew}
      onDelete={handleDelete}
    />
  );
}
