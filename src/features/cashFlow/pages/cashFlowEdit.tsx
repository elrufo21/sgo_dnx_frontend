import React, { useEffect, useState } from "react";
import CashFlowForm from "@/components/CashFlowForm";
import { useCashFlowStore } from "@/store/cashFlow/cashFlow.store";
import { useNavigate, useParams } from "react-router";
import { toast } from "@/shared/ui/toast";
import type { CashFlow } from "@/types/cashFlow";
import { useDialogStore } from "@/store/app/dialog.store";

const CashFlowEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const openDialog = useDialogStore((s) => s.openDialog);
  const { flows, fetchFlows, updateFlow, deleteFlow, getFlowById } =
    useCashFlowStore();
  const [flow, setFlow] = useState<CashFlow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFlow = async () => {
      if (flows.length === 0) {
        await fetchFlows();
      }

      const foundFlow = getFlowById(Number(id));
      if (foundFlow) {
        setFlow(foundFlow);
      } else {
        toast.error("Flujo de caja no encontrado");
        navigate("/cash_flow_control");
      }
      setLoading(false);
    };

    loadFlow();
  }, [id, flows.length, fetchFlows, getFlowById, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-gray-600">Cargando flujo de caja...</div>
      </div>
    );
  }

  if (!flow) {
    return null;
  }

  const handleSave = (data: Omit<CashFlow, "id">) => {
    updateFlow(Number(id), data);
    toast.success("Flujo de caja actualizado correctamente");
    navigate("/cash_flow_control");
  };

  const handleDelete = () => {
    if (!id) return;
    openDialog({
      title: "Eliminar",
      content: <p>Seguro que deseas eliminar este flujo de caja?</p>,
      onConfirm: async () => {
        try {
          const result = await deleteFlow(Number(id));
          if (result === false) {
            toast.error("No se pudo eliminar el flujo de caja.");
            return;
          }
          toast.success("Flujo de caja eliminado correctamente");
          navigate("/cash_flow_control");
        } catch (error) {
          console.error("Error eliminando flujo de caja", error);
          toast.error("Ocurrio un error al eliminar el flujo de caja.");
        }
      },
    });
  };

  const handleNew = () => {
    navigate("/cash_flow_control/create");
  };

  return (
    <CashFlowForm
      mode="edit"
      initialData={flow}
      onSave={handleSave}
      onDelete={handleDelete}
      onNew={handleNew}
    />
  );
};

export default CashFlowEdit;
