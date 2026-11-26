import { toast } from "@/shared/ui/toast";
import ProductFormBase from "@/app/products/components/ProductFormBase";
import { DUPLICATE_PRODUCT_CODE_ERROR, useProductsStore } from "@/app/products/store/products.store";
import type { Product } from "@/app/products/types/product";

const ProductCreate = () => {
  const { addProduct } = useProductsStore();

  const handleSave = async (data: Omit<Product, "id">) => {
    const result = await addProduct(data);
    if (result.ok) {
      toast.success("Producto creado correctamente");
      return true;
    } else {
      toast.error(result.error);
      return result.error === DUPLICATE_PRODUCT_CODE_ERROR
        ? "duplicate-code" as const
        : false;
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
