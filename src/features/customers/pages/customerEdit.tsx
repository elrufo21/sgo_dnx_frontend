import React, { useState, useEffect } from "react";
import CustomerFormBase from "@/components/CustomerFormBase";
import { useClientsStore } from "@/store/customers/customers.store";
import { useNavigate, useParams } from "react-router";
import { useDialogStore } from "@/store/app/dialog.store";
import { toast } from "@/shared/ui/toast";

const CustomerEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const openDialog = useDialogStore((s) => s.openDialog);
  const { clients, fetchClients, updateClient, deleteClient } =
    useClientsStore();

  const [form, setForm] = useState<Omit<any, "id">>({
    nombreRazon: "",
    ruc: "",
    dni: "",
    direccionFiscal: "",
    direccionDespacho: "",
    telefonoMovil: "",
    email: "",
    registradoPor: "",
    estado: "activo",
    fecha: null,
  });

  useEffect(() => {
    if (clients.length === 0) {
      fetchClients();
    }
  }, [clients, fetchClients]);

  useEffect(() => {
    const client = clients.find((c) => c.id === Number(id));
    if (client) {
      const { id, ...rest } = client;
      setForm(rest);
    }
  }, [clients, id]);

  if (!form) return <div>Cargando cliente...</div>;

  const handleSave = async (data: Omit<typeof form, "id">) => {
    const result = await updateClient(Number(id), data);
    if (result.ok) {
      toast.success("Cliente guardado correctamente");
      navigate("/customers");
    } else {
      toast.error(result.error ?? "El DNI o RUC ya existe.");
    }
    return result.ok;
  };

  const handleDelete = async () => {
    if (!id) return;
    openDialog({
      title: "Eliminar",
      content: <p>¿Seguro que deseas eliminar este cliente?</p>,
      onConfirm: async () => {
        try {
          const result = await deleteClient(Number(id));
          if (result === false) {
            toast.error("No se pudo eliminar el cliente.");
            return;
          }
          toast.success("Cliente eliminado correctamente");
          navigate("/customers");
        } catch (error) {
          console.error("Error al eliminar cliente", error);
          toast.error("Ocurrió un error al eliminar el cliente.");
        }
      },
    });
  };

  const handleNew = () => {
    navigate("/customers/create");
  };

  return (
    <CustomerFormBase
      mode="edit"
      initialData={form}
      onSave={handleSave}
      onDelete={handleDelete}
      onNew={handleNew}
    />
  );
};

export default CustomerEdit;
