import React, { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";
import { getLocalDateISO } from "@/shared/helpers/localDate";

import EmployeeFormBase from "@/components/EmployeeFormBase";
import { useEmployeesStore } from "@/store/employees/employees.store";
import type { Personal } from "@/types/employees";

const today = () => getLocalDateISO();

const EmployeeCreate = () => {
  const { addEmployee } = useEmployeesStore();
  const navigate = useNavigate();

  const [form, setForm] = useState<Partial<Personal>>({
    personalEstado: "ACTIVO",
    personalIngreso: today(),
  });

  const handleSave = async (
    data: Personal & { imageFile?: File | null; imageRemoved?: boolean }
  ) => {
    const { personalId, imageFile, imageRemoved, ...rest } = data;
    const created = await addEmployee({ ...rest, imageFile, imageRemoved });
    if (!created) {
      toast.error("El DNI ya existe");
      return;
    }
    toast.success("Empleado creado correctamente");
    navigate("/maintenance/employees/create");
    setForm({
      personalEstado: "ACTIVO",
      personalIngreso: today(),
      personalCodigo: "",
      personalNombres: "",
      personalApellidos: "",
      personalDni: "",
      personalTelefono: "",
      personalTelefonoAsi: "",
      personalEmail: "",
      personalDireccion: "",
      personalNacimiento: "",
      personalBajaFecha: "",
      personalRuc: "",
      personalLicencia: "",
      personalImagen: "",
      companiaId: null,
      areaId: null,
      personalSueldo: null,
      gerencia: null,
    });
  };

  const handleNew = () => {
    setForm({
      personalEstado: "ACTIVO",
      personalIngreso: today(),
      personalCodigo: "",
      personalNombres: "",
      personalApellidos: "",
      personalDni: "",
      personalTelefono: "",
      personalTelefonoAsi: "",
      personalEmail: "",
      personalDireccion: "",
      personalNacimiento: "",
      personalBajaFecha: "",
      personalRuc: "",
      personalLicencia: "",
      personalImagen: "",
      companiaId: null,
      areaId: null,
      personalSueldo: null,
      gerencia: null,
    });
  };

  return (
    <EmployeeFormBase
      mode="create"
      initialData={form}
      onSave={handleSave}
      onNew={handleNew}
    />
  );
};

export default EmployeeCreate;
