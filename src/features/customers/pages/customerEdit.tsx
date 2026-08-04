import React, { useState, useEffect } from "react";
import { BlockingSpinner } from "@/components/common/BlockingSpinner";
import CustomerFormBase from "@/components/CustomerFormBase";
import { useClientsStore } from "@/store/customers/customers.store";
import { useNavigate, useParams } from "react-router";
import { useDialogStore } from "@/store/app/dialog.store";
import { toast } from "@/shared/ui/toast";
import type { Client } from "@/types/customer";

const CustomerEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const openDialog = useDialogStore((s) => s.openDialog);
  const { fetchClientById, updateClient, deleteClient, loading } =
    useClientsStore();

  const [form, setForm] = useState<Omit<Client, "id">>({
    clienteCodigo: "",
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
    if (!id) return;
    void fetchClientById(Number(id)).then((client) => {
      if (!client) return;
      setForm({
        clienteCodigo: client.clienteCodigo,
        nombreRazon: client.nombreRazon,
        ruc: client.ruc,
        dni: client.dni,
        direccionFiscal: client.direccionFiscal,
        direccionDespacho: client.direccionDespacho,
        telefonoMovil: client.telefonoMovil,
        email: client.email,
        registradoPor: client.registradoPor,
        estado: client.estado,
        fecha: client.fecha,
      });
    });
  }, [fetchClientById, id]);

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
            toast.error("No se puede eliminar: el cliente tiene relacion con otros modulos.");
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
    <>
      <BlockingSpinner show={loading} text="Cargando cliente..." />
      <CustomerFormBase
        mode="edit"
        initialData={form}
        onSave={handleSave}
        onDelete={handleDelete}
        onNew={handleNew}
      />
    </>
  );
};

export default CustomerEdit;
