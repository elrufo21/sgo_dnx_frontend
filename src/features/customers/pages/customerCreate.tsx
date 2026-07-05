import React, { useState } from "react";
import CustomerFormBase from "@/components/CustomerFormBase";
import { useClientsStore } from "@/store/customers/customers.store";
import { useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";

const CustomerCreate = () => {
  const { addClient } = useClientsStore();
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
    fecha: null as string | null,
  });

  const handleSave = async (data: Omit<typeof form, "id">) => {
    const result = await addClient(data);
    if (result.ok) {
      toast.success("Cliente creado correctamente");
      navigate("/customers/create");
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
        fecha: null as string | null,
      });
    } else {
      toast.error(result.error ?? "El DNI o RUC ya existe.");
    }
    return result.ok;
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
      fecha: null,
    });
  };

  return (
    <CustomerFormBase
      mode="create"
      initialData={form}
      onSave={handleSave}
      onNew={handleNew}
    />
  );
};

export default CustomerCreate;
