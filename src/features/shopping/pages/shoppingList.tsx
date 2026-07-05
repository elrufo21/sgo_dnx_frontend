import { CrudList } from "@/components/ListView";
import { useShoppingStore } from "@/store/shopping/shopping.store";
import type { Shopping } from "@/types/shopping";

const ShoppingList = () => {
  const { shoppings, fetchShoppings, deleteShopping } = useShoppingStore();

  const columns = [
    { key: "concepto", header: "Concepto" },
    { key: "proveedor", header: "Proveedor" },
    { key: "documento", header: "Documento" },
    {
      header: "Serie / Numero",
      id: "serie-numero",
      render: (row: Shopping) => `${row.serie}-${row.numero}`,
    },
    { key: "moneda", header: "Moneda" },
    { key: "tipoIgv", header: "Tipo IGV" },
  ];

  return (
    <CrudList
      data={shoppings}
      fetchData={fetchShoppings}
      deleteItem={deleteShopping}
      columns={columns}
      basePath="/shopping"
      createLabel="Crear compra"
      deleteMessage="Seguro que deseas eliminar esta compra?"
      filterKeys={["concepto", "proveedor", "documento", "ruc"]}
    />
  );
};

export default ShoppingList;
