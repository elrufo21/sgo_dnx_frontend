import CashFlowForm from "@/components/CashFlowForm";
import { useParams } from "react-router";

export default function CashFlowCreate() {
  const { cajaId } = useParams();
  return <CashFlowForm key={cajaId ?? "new"} />;
}
