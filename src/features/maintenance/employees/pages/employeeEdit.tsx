import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "@/shared/ui/toast";

import EmployeeFormBase from "@/components/EmployeeFormBase";
import { useEmployeesStore } from "@/store/employees/employees.store";
import type { Personal } from "@/types/employees";
import { useDialogStore } from "@/store/app/dialog.store";

const EmployeeEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const openDialog = useDialogStore((s) => s.openDialog);

  const { employees, fetchEmployees, updateEmployee, deleteEmployee } =
    useEmployeesStore();

  const [form, setForm] = useState<Personal | null>(null);

  useEffect(() => {
    if (employees.length === 0) fetchEmployees();
  }, [employees, fetchEmployees]);

  useEffect(() => {
    const employee = employees.find(
      (e) => String(e.personalId) === String(id)
    );
    if (employee) {
      setForm(employee);
    }
  }, [employees, id]);

  if (!form) return <div>Cargando empleado...</div>;

  const handleSave = async (
    data: Personal & { imageFile?: File | null; imageRemoved?: boolean }
  ) => {
    const updated = await updateEmployee(Number(id), data);
    if (!updated) {
      toast.error("El DNI ya existe");
      return;
    }
    toast.success("Empleado guardado correctamente");
    navigate("/maintenance/employees");
  };

  const handleDelete = async () => {
    if (!id) return;
    openDialog({
      title: "Eliminar",
      content: <p>Seguro que deseas eliminar este empleado?</p>,
      onConfirm: async () => {
        try {
          const result = await deleteEmployee(Number(id));
          if (result === false) {
            toast.error("No se pudo eliminar el empleado.");
            return;
          }
          toast.success("Empleado eliminado correctamente");
          navigate("/maintenance/employees");
        } catch (error) {
          console.error("Error eliminando empleado", error);
          toast.error("Ocurrió un error al eliminar el empleado.");
        }
      },
    });
  };

  const handleNew = () => navigate("/maintenance/employees/create");

  return (
    <EmployeeFormBase
      mode="edit"
      initialData={form}
      onSave={handleSave}
      onDelete={handleDelete}
      onNew={handleNew}
    />
  );
};

export default EmployeeEdit;
