import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, Search, Trash2 } from "lucide-react";

const EditableDataTable = ({
  columns: userColumns,
  data: initialData,
  onDataChange,
  enableActions = true,
  enablePagination = true,
  enableSorting = true,
  enableFiltering = true,
}) => {
  const [data, setData] = useState(initialData);
  const [globalFilter, setGlobalFilter] = useState("");
  const skipPropSyncRef = useRef(false);

  const normalizeText = useCallback((value: unknown) => {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }, []);

  const globalFilterFn = useCallback(
    (row, _columnId, filterValue) => {
      const term = normalizeText(filterValue);
      if (!term) return true;

      const original = row.original as Record<string, unknown>;
      return Object.values(original).some((value) =>
        normalizeText(value).includes(term)
      );
    },
    [normalizeText]
  );

  const createEmptyRow = useCallback(() => {
    return userColumns.reduce((acc, col) => {
      acc[col.accessorKey] = col.meta?.defaultValue ?? "";
      return acc;
    }, {});
  }, [userColumns]);

  const isRowEmpty = useCallback(
    (row) =>
      userColumns.every((col) => {
        const defVal = col.meta?.defaultValue ?? "";
        const current = row?.[col.accessorKey];
        return current === defVal || (current === undefined && defVal === "");
      }),
    [userColumns]
  );

  const ensureTrailingEmptyRow = useCallback(
    (rows) => {
      if (!rows || !rows.length) return [createEmptyRow()];
      const last = rows[rows.length - 1];
      if (isRowEmpty(last)) return rows;
      return [...rows, createEmptyRow()];
    },
    [createEmptyRow, isRowEmpty]
  );

  useEffect(() => {
    if (skipPropSyncRef.current) {
      // Evita re-sincronizar cuando el cambio viene de la propia tabla
      skipPropSyncRef.current = false;
      return;
    }
    setData(() => {
      const base =
        initialData && initialData.length ? initialData : [createEmptyRow()];
      return ensureTrailingEmptyRow(base);
    });
  }, [initialData, createEmptyRow, ensureTrailingEmptyRow]);

  const updateData = useCallback(
    (rowIndex, columnId, value) => {
      skipPropSyncRef.current = true;
      setData((old) => {
        const mapped = old.map((row, index) => {
          if (index === rowIndex) {
            return {
              ...old[rowIndex],
              [columnId]: value,
            };
          }
          return row;
        });
        const newData = ensureTrailingEmptyRow(mapped);
        onDataChange?.(newData);
        return newData;
      });
    },
    [onDataChange, ensureTrailingEmptyRow]
  );

  const updateRow = useCallback(
    (rowIndex, updater) => {
      skipPropSyncRef.current = true;
      setData((old) => {
        const mapped = old.map((row, index) => {
          if (index === rowIndex) {
            const nextRow =
              typeof updater === "function" ? updater(row) ?? row : updater;
            return { ...row, ...nextRow };
          }
          return row;
        });
        const newData = ensureTrailingEmptyRow(mapped);
        onDataChange?.(newData);
        return newData;
      });
    },
    [onDataChange, ensureTrailingEmptyRow]
  );

  const deleteRow = useCallback(
    (rowIndex) => {
      const newData = data.filter((_, index) => index !== rowIndex);
      const ensured = ensureTrailingEmptyRow(newData);
      setData(ensured);
      onDataChange?.(ensured);
    },
    [data, onDataChange, ensureTrailingEmptyRow]
  );

  const columns = useMemo(() => {
    const cols = [...userColumns];
    if (enableActions) {
      cols.push({
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => (
          <button
            onClick={() => deleteRow(row.index)}
            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
            title="Eliminar fila"
          >
            <Trash2 size={18} />
          </button>
        ),
      });
    }
    return cols;
  }, [userColumns, enableActions, deleteRow]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: enableFiltering ? getFilteredRowModel() : undefined,
    getPaginationRowModel: enablePagination
      ? getPaginationRowModel()
      : undefined,
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn,
    meta: {
      updateData,
      updateRow,
    },
  });

  const getColumnStyle = (column) => {
    const width = column.columnDef?.meta?.width;
    if (!width) return undefined;
    return { width, minWidth: width };
  };

  return (
    <div className="w-full space-y-4">
      {/* Barra de herramientas */}
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        {enableFiltering && (
          <div className="relative flex-1 max-w-full sm:max-w-md">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Buscar en toda la tabla..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {/* Tabla */}
      <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto overflow-y-auto max-h-[min(60vh,560px)] md:max-h-[min(58vh,540px)]">
          <table className="w-full min-w-[460px] sm:min-w-[640px]">
            <thead className="bg-gray-50 sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      style={getColumnStyle(header.column)}
                      className="px-2 sm:px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 border-b border-gray-200"
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`flex items-center gap-1 sm:gap-2 ${
                            header.column.getCanSort()
                              ? "cursor-pointer select-none"
                              : ""
                          }`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          {enableSorting && header.column.getCanSort() && (
                            <span className="text-gray-400">
                              {{
                                asc: <ChevronUp size={16} />,
                                desc: <ChevronDown size={16} />,
                              }[header.column.getIsSorted()] ?? (
                                <ChevronDown size={16} className="opacity-30" />
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={getColumnStyle(cell.column)}
                      className="px-2 sm:px-4 py-2 text-sm"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginación */}
      {enablePagination && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="text-center text-sm text-gray-600 sm:text-left">
            Mostrando {table.getRowModel().rows.length} de {data.length} filas
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              Anterior
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 sm:px-4 py-2 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditableDataTable;
