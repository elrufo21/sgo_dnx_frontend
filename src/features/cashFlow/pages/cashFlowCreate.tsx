import React from "react";
import CashFlowForm from "@/components/CashFlowForm";
import { useCashFlowStore } from "@/store/cashFlow/cashFlow.store";
import { useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";
import type { CashFlow } from "@/types/cashFlow";

const CashFlowCreate = () => {
  const { addFlow } = useCashFlowStore();
  const navigate = useNavigate();

  const handleSave = (data: Omit<CashFlow, "id">) => {
    addFlow(data);
    toast.success("Flujo de caja creado correctamente");
    navigate("/cash_flow_control");
  };

  return <CashFlowForm mode="create" onSave={handleSave} />;
};

export default CashFlowCreate;
