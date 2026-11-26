import { useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";
import ShoppingFormBase from "@/app/shopping/components/ShoppingFormBase";
import { useShoppingStore } from "@/app/shopping/store/shopping.store";
import type { ShoppingFormData } from "@/app/shopping/types/shopping";

const ShoppingCreate = () => {
  const { addShopping } = useShoppingStore();
  const navigate = useNavigate();

  const handleSave = async (data: ShoppingFormData) => {
    await addShopping(data);
    toast.success("Compra registrada localmente");
    navigate("/shopping");
  };

  return <ShoppingFormBase mode="create" onSave={handleSave} />;
};

export default ShoppingCreate;
