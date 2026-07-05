import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { useProductsStore } from "@/store/products/products.store";
import type { Product } from "@/types/product";
import ProductFormBase from "@/components/ProductFormBase";
import { toast } from "@/shared/ui/toast";
import { useDialogStore } from "@/store/app/dialog.store";

export default function ProductEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const openDialog = useDialogStore((s) => s.openDialog);
  const { products, fetchProducts, updateProduct, deleteProduct } =
    useProductsStore();

  const [form, setForm] = useState<Product | null>(null);

  useEffect(() => {
    if (products.length === 0) fetchProducts();
  }, [products.length, fetchProducts]);

  useEffect(() => {
    const prod = products.find((p) => p.id === Number(id));
    if (prod) {
      setForm({ ...prod, images: prod.images || [] });
    }
  }, [products, id]);

  if (!form) return <div>Cargando producto...</div>;

  const handleSave = async (frm) => {
    if (!id) return;
    const ok = await updateProduct(Number(id), frm);
    if (ok) {
      toast.success("Producto guardado correctamente");
      navigate("/products");
    } else {
      toast.error("El codigo de producto ya existe.");
    }
  };

  const handleDelete = () => {
    if (!id) return;
    openDialog({
      title: "Eliminar",
      content: <p>Seguro que deseas eliminar este producto?</p>,
      onConfirm: async () => {
        try {
          const result = await deleteProduct(Number(id));
          if (result === false) {
            toast.error("No se pudo eliminar el producto.");
            return;
          }
          toast.success("Producto eliminado correctamente");
          navigate("/products");
        } catch (error) {
          console.error("Error eliminando producto", error);
          toast.error("Ocurrio un error al eliminar el producto.");
        }
      },
    });
  };

  return (
    <ProductFormBase
      mode="edit"
      initialData={form}
      onSave={handleSave}
      onArchive={() => {}}
      onNew={() => {
        navigate("/products/create");
      }}
      onDelete={handleDelete}
    />
  );
}
