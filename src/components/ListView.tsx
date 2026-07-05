import { type ReactNode, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import DataTable from "@/components/DataTable";
import { Pencil, PlusIcon, Trash2 } from "lucide-react";
import { toast } from "@/shared/ui/toast";
import { createColumnHelper } from "@tanstack/react-table";
import { useDialogStore } from "@/store/app/dialog.store";
import { BackArrowButton } from "@/components/common/BackArrowButton";

interface ColumnConfig<T> {
  key?: keyof T;
  header: string;
  id?: string;
  render?: (row: T) => ReactNode;
  tdClassName?: string | ((row: T) => string | undefined);
}

export interface CrudListConfig<T> {
  basePath: string;
  columns: ColumnConfig<T>[];
  idKey?: keyof T & string;
  createLabel?: string;
  deleteMessage?: string;
  filterKeys?: (keyof T & string)[];
  renderFilters?: React.ReactNode;
  footerContent?: React.ReactNode;
  onFilteredDataChange?: (rows: T[]) => void;
  onCreate?: () => void;
  onEdit?: (row: T, id: number) => void;
}

interface CrudListProps<T> {
  data: T[];
  fetchData: () => Promise<unknown> | void;
  deleteItem: (id: number) => Promise<boolean | void> | boolean | void;
  basePath: string;
  columns: ColumnConfig<T>[];
  idKey?: keyof T & string;
  createLabel?: string;
  deleteMessage?: string;
  filterKeys?: (keyof T & string)[];
  renderFilters?: React.ReactNode;
  footerContent?: React.ReactNode;
  onFilteredDataChange?: (rows: T[]) => void;
  onCreate?: () => void;
  onEdit?: (row: T, id: number) => void;
}

export function CrudList<T>(props: CrudListProps<T>) {
  const {
    data,
    fetchData,
    deleteItem,
    basePath,
    columns,
    idKey = "id",
    createLabel = "Nuevo",
    deleteMessage = "¿Seguro que deseas eliminar este elemento?",
    filterKeys,
    renderFilters,
    footerContent,
    onFilteredDataChange,
    onCreate,
    onEdit,
  } = props;

  const openDialog = useDialogStore((s) => s.openDialog);
  const navigate = useNavigate();
  const columnHelper = createColumnHelper<T>();
  const isMaintenanceList = basePath.startsWith("/maintenance/");
  const maintenanceSegment = basePath.split("/").filter(Boolean)[1] ?? "";
  const maintenanceTitleBySegment: Record<string, string> = {
    categories: "Categorías",
    areas: "Áreas",
    providers: "Proveedores",
    holidays: "Feriados",
    computers: "Computadoras",
    employees: "Empleados",
    users: "Usuarios",
  };
  const maintenanceTitle =
    maintenanceTitleBySegment[maintenanceSegment] ?? "Mantenimiento";
  const maintenanceFallbackTo = basePath.startsWith("/maintenance")
    ? "/maintenance"
    : undefined;

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tableColumns = [
    ...columns.map((col) => {
      if (col.render) {
        return columnHelper.display({
          id: col.id ?? col.header,
          header: col.header,
          cell: ({ row }) => col.render!(row.original),
          meta: { tdClassName: col.tdClassName },
        });
      }

      if (col.key) {
        const accessorKey = col.key;
        return columnHelper.accessor((row) => row[accessorKey], {
          id: col.id ?? String(accessorKey),
          header: col.header,
          cell: (info) => info.getValue() as ReactNode,
          meta: { tdClassName: col.tdClassName },
        });
      }

      return columnHelper.display({
        id: col.id ?? col.header,
        header: col.header,
        cell: () => null,
        meta: { tdClassName: col.tdClassName },
      });
    }),

    columnHelper.display({
      id: "acciones",
      header: "Acciones",
      cell: ({ row }) => {
        const rowData = row.original as Record<string, unknown>;
        const rawId = rowData[idKey];
        const id =
          typeof rawId === "number"
            ? rawId
            : typeof rawId === "string"
              ? Number(rawId)
              : undefined;
        if (typeof id !== "number" || Number.isNaN(id)) return null;

        const askDelete = () =>
          openDialog({
            title: "Eliminar",
            content: <p>{deleteMessage}</p>,
            onConfirm: async () => {
              try {
                const result = await deleteItem(id);
                if (result === false) {
                  toast.error("No se pudo eliminar el registro.");
                  return;
                }
                toast.success("Elemento eliminado.");
              } catch (error) {
                console.error("Error deleting item", error);
                toast.error("Ocurrió un error al eliminar.");
              }
            },
          });

        return (
          <div className="flex flex-wrap justify-end gap-2">
            {onEdit ? (
              <button
                type="button"
                onClick={() => onEdit(row.original, id)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100"
                title="Editar"
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </button>
            ) : (
              <Link
                to={`${basePath}/${id}/edit`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100"
                title="Editar"
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            )}

            <button
              type="button"
              onClick={askDelete}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition-colors hover:bg-red-100"
              title="Eliminar"
              aria-label="Eliminar"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        );
      },
    }),
  ];

  return (
    <div>
      {isMaintenanceList ? (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm sm:px-4 sm:py-4">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <BackArrowButton
              fallbackTo={maintenanceFallbackTo}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors"
            />
            <div className="leading-tight">
              <p className="text-xs font-semibold tracking-wide uppercase text-[#B23636]">
                Mantenimiento
              </p>
              <div className="flex items-end gap-2">
                <h1 className="text-xl font-semibold text-[#0f2748] sm:text-3xl lg:text-4xl">
                  {maintenanceTitle}
                </h1>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-1" />
      )}

      <DataTable
        data={data}
        columns={tableColumns}
        filterKeys={filterKeys}
        toolbarLeading={
          !isMaintenanceList ? (
            <BackArrowButton
              fallbackTo={maintenanceFallbackTo}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors"
            />
          ) : undefined
        }
        renderFilters={renderFilters}
        footerContent={footerContent}
        onFilteredDataChange={onFilteredDataChange}
        toolbarAction={
          <button
            type="button"
            onClick={() =>
              onCreate ? onCreate() : navigate(`${basePath}/create`)
            }
            title={createLabel}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#B23636] px-3 text-white transition-colors shadow-sm hover:bg-[#96312a] sm:w-11 sm:px-0"
          >
            <PlusIcon className="h-5 w-5" />
            <span className="text-sm font-semibold sm:hidden">Nuevo</span>
          </button>
        }
      />
    </div>
  );
}
