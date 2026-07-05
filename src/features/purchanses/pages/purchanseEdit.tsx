import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "@/shared/ui/toast";
import PurchaseFormBase from "@/components/PurchaseFormBase";
import { usePurchasesStore } from "@/store/purchanses/purchase.store";
import { useDialogStore } from "@/store/app/dialog.store";

const PurchanseEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const openDialog = useDialogStore((s) => s.openDialog);
  const { purchases, fetchPurchases, updatePurchase, deletePurchase } =
    usePurchasesStore();

  const [form, setForm] = useState<Omit<any, "id">>({
    nombreRazon: "",
    ruc: "",
    dni: "",
    direccionFiscal: "",
    direccionDespacho: "",
    telefonoMovil: "",
    email: "",
    registradoPor: "",
    estado: "ACTIVO",
  });

  useEffect(() => {
    if (purchases.length === 0) fetchPurchases();
  }, [purchases, fetchPurchases]);

  useEffect(() => {
    const purchase = purchases.find((c) => c.id === Number(id));
    if (purchase) {
      const { id: _, ...rest } = purchase;
      setForm(rest);
    }
  }, [purchases, id]);

  if (!form) return <div>Cargando cliente...</div>;

  const handleSave = (data: Omit<typeof form, "id">) => {
    updatePurchase(Number(id), data);
    toast.success("Cliente guardado correctamente");
    navigate("/purchases");
  };

  const handleDelete = () => {
    if (!id) return;
    openDialog({
      title: "Eliminar",
      content: <p>Seguro que deseas eliminar este registro?</p>,
      onConfirm: async () => {
        try {
          const result = await deletePurchase(Number(id));
          if (result === false) {
            toast.error("No se pudo eliminar el registro.");
            return;
          }
          toast.success("Cliente eliminado correctamente");
          navigate("/purchases");
        } catch (error) {
          console.error("Error eliminando compra", error);
          toast.error("Ocurrio un error al eliminar el registro.");
        }
      },
    });
  };

  const handleNew = () => {
    navigate("/purchases/create");
  };

  return (
    <PurchaseFormBase
      mode="edit"
      initialData={form}
      onSave={handleSave}
      onDelete={handleDelete}
      onNew={handleNew}
    />
  );
};

export default PurchanseEdit;
