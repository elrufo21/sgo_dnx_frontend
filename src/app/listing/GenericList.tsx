import { CrudList } from "@/components/ListView";
import { listRegistry, type ListModuleKey } from "./listRegistry";

interface GenericListProps {
  moduleKey: ListModuleKey;
}

export function GenericList({ moduleKey }: GenericListProps) {
  const entry = listRegistry[moduleKey];
  if (!entry) return null;

  const {
    data,
    fetchData,
    deleteItem,
    renderFilters,
    onCreate,
    onEdit,
  } = entry.useDeps() as any;

  return (
    <CrudList
      data={data}
      fetchData={fetchData}
      deleteItem={deleteItem as any}
      renderFilters={renderFilters ?? entry.config.renderFilters}
      onCreate={onCreate as any}
      onEdit={onEdit as any}
      {...entry.config}
    />
  );
}
