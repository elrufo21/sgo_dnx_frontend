import { CrudList } from "@/components/ListView";
import { usePurchasesStore } from "@/store/purchanses/purchase.store";

const PurchanseList = () => {
  const { purchases, fetchPurchases, deletePurchase } = usePurchasesStore();

  const columns = [
    { key: "id", header: "Id" },
    { key: "nombreRazon", header: "Nombre o Razon social" },
    { key: "celular", header: "Telefono" },
    { key: "email", header: "Email" },
  ];

  return (
    <CrudList
      data={purchases}
      fetchData={fetchPurchases}
      deleteItem={deletePurchase}
      columns={columns}
      basePath="/purchases"
      createLabel="Añadir"
      deleteMessage="¿Estás seguro de eliminar este elemento?"
    />
  );
};

export default PurchanseList;
