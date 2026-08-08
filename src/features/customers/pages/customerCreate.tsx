import React, { useState } from "react";
import { BlockingSpinner } from "@/components/common/BlockingSpinner";
import CustomerFormBase from "@/components/CustomerFormBase";
import { useClientsStore } from "@/store/customers/customers.store";
import { useAuthStore } from "@/store/auth/auth.store";
import { useNavigate } from "react-router";
import { toast } from "@/shared/ui/toast";

const CustomerCreate = () => {
  const { addClient, loading } = useClientsStore();
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const username = authUser?.displayName || authUser?.username || "USUARIO";

  const [form, setForm] = useState({
    clienteCodigo: "",
    nombreRazon: "",
    ruc: "",
    dni: "",
    direccionFiscal: "",
    direccionDespacho: "",
    telefonoMovil: "",
    email: "",
    registradoPor: username,
    estado: "ACTIVO",
    fecha: null as string | null,
    documentoPredeterminado: "BOLETA" as "BOLETA" | "FACTURA",
  });

  const handleSave = async (data: Omit<typeof form, "id">) => {
    const result = await addClient({
      ...data,
      registradoPor: data.registradoPor || username,
    });
    if (result.ok) {
      toast.success("Cliente creado correctamente");
      navigate("/customers/create");
      setForm({
        clienteCodigo: "",
        nombreRazon: "",
        ruc: "",
        dni: "",
        direccionFiscal: "",
        direccionDespacho: "",
        telefonoMovil: "",
        email: "",
        registradoPor: username,
        estado: "ACTIVO",
        fecha: null as string | null,
        documentoPredeterminado: "BOLETA",
      });
    } else {
      toast.error(result.error ?? "El DNI o RUC ya existe.");
    }
    return result.ok;
  };

  const handleNew = () => {
    setForm({
      clienteCodigo: "",
      nombreRazon: "",
      ruc: "",
      dni: "",
      direccionFiscal: "",
      direccionDespacho: "",
      telefonoMovil: "",
      email: "",
      registradoPor: username,
      estado: "ACTIVO",
      fecha: null,
      documentoPredeterminado: "BOLETA",
    });
  };

  return (
    <>
      <BlockingSpinner show={loading} text="Guardando cliente..." />
      <CustomerFormBase
        mode="create"
        initialData={form}
        onSave={handleSave}
        onNew={handleNew}
      />
    </>
  );
};

export default CustomerCreate;
