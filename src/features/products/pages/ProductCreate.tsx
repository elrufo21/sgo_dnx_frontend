import { toast } from "@/shared/ui/toast";
import ProductFormBase from "@/components/ProductFormBase";
import { useProductsStore } from "@/store/products/products.store";
import type { Product } from "@/types/product";

const ProductCreate = () => {
  const { addProduct } = useProductsStore();

  const handleSave = async (data: Omit<Product, "id">) => {
    const result = await addProduct(data);
    if (result.ok) {
      toast.success("Producto creado correctamente");
      return true;
    } else {
      toast.error(result.error);
      return false;
    }
  };

  const handleNew = () => {
    // ProductFormBase ya resetea su propio estado
  };

  return (
    <ProductFormBase mode="create" onSave={handleSave} onNew={handleNew} />
  );
};

export default ProductCreate;
