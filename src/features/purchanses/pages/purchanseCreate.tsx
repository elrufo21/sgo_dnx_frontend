import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";
import PurchaseFormBase from "@/components/PurchaseFormBase";
import { usePurchasesStore } from "@/store/purchanses/purchase.store";

const PurchanseCreate = () => {
  const { addPurchase } = usePurchasesStore();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nombreRazon: "",
    ruc: "",
    dni: "",
    direccionFiscal: "",
    direccionDespacho: "",
    telefonoMovil: "",
    email: "",
    registradoPor: "Admin",
    estado: "ACTIVO",
  });

  const handleSave = (data: Omit<typeof form, "id">) => {
    addPurchase(data);
    toast.success("Se creo correctamente");
    navigate("/purchases");
  };

  const handleNew = () => {
    setForm({
      nombreRazon: "",
      ruc: "",
      dni: "",
      direccionFiscal: "",
      direccionDespacho: "",
      telefonoMovil: "",
      email: "",
      registradoPor: "Admin",
      estado: "ACTIVO",
    });
  };

  return (
    <PurchaseFormBase
      mode="create"
      initialData={form}
      onSave={handleSave}
      onNew={handleNew}
    />
  );
};

export default PurchanseCreate;
