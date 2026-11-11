import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { DUPLICATE_PRODUCT_CODE_ERROR, useProductsStore } from "@/store/products/products.store";
import type { Product } from "@/types/product";
import ProductFormBase from "@/components/ProductFormBase";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
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
    if (!prod) return;
    let active = true;
    void apiRequest<unknown>({ url: buildApiUrl(`/Productos/${encodeURIComponent(id ?? "")}`) }).then((response) => {
      if (!active) return;
      const detail = response && typeof response === "object" ? response as Record<string, unknown> : {};
      const hasDate = "productoFecha" in detail || "ProductoFecha" in detail;
      const date = detail.productoFecha ?? detail.ProductoFecha;
      setForm({ ...prod, fechaRegistro: hasDate ? (typeof date === "string" ? date : "") : prod.fechaRegistro, images: prod.images || [] });
    });
    return () => { active = false; };
  }, [products, id]);

  if (!form || form.id !== Number(id)) return <div>Cargando producto...</div>;

  const handleSave = async (frm: Omit<Product, "id">) => {
    if (!id) return false;
    const result = await updateProduct(Number(id), frm);
    if (result.ok) {
      toast.success("Producto guardado correctamente");
      navigate("/maintenance/products");
      return true;
    } else {
      toast.error(result.error);
      return result.error === DUPLICATE_PRODUCT_CODE_ERROR
        ? "duplicate-code" as const
        : false;
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
          navigate("/maintenance/products");
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
        navigate("/maintenance/products/create");
      }}
      onDelete={handleDelete}
    />
  );
}
