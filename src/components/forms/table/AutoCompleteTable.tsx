import React, { useEffect, useMemo, useState } from "react";
import { Autocomplete, TextField } from "@mui/material";

type Option = {
  label: string;
  value: string | number;
  data?: any;
};

const AutocompleteTableCell = ({ getValue, row, column, table }) => {
  const options: Option[] = column.columnDef.meta?.options || [];
  const focusAfterSelect = column.columnDef.meta?.onProductSelected;
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);
  const [inputValue, setInputValue] = useState("");

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value) ?? null,
    [options, value]
  );

  useEffect(() => {
    setValue(initialValue);
    const matched = options.find((opt) => opt.value === initialValue) ?? null;
    setInputValue(matched?.label ?? "");
  }, [initialValue, options]);

  const applyProductToRow = (option: Option | null) => {
    const updateRow = table.options.meta?.updateRow;
    const updateData = table.options.meta?.updateData;
    const product = option?.data ?? null;

    const fallbackUpdate = () => {
      const cantidadActual =
        (table?.options?.data?.[row.index]?.cantidad as number) ?? 1;
      const costo = Number(product?.preCosto ?? 0);
      const importe = Number((costo * (cantidadActual || 1)).toFixed(2));
      updateData?.(row.index, column.id, option?.value ?? null);
      updateData?.(row.index, "codigo", product?.codigo ?? "");
      updateData?.(row.index, "nombre", product?.nombre ?? "");
      updateData?.(row.index, "unidadMedida", product?.unidadMedida ?? "");
      updateData?.(row.index, "stock", Number(product?.cantidad ?? 0));
      updateData?.(row.index, "preCosto", costo);
      updateData?.(row.index, "preVenta", Number(product?.preVenta ?? 0));
      updateData?.(row.index, "importe", importe);
    };

    if (updateRow) {
      updateRow(row.index, (currentRow = {}) => {
        const cantidad =
          currentRow.cantidad !== undefined ? currentRow.cantidad : 1;
        const costo = Number(product?.preCosto ?? 0);
        const importe = Number((costo * (cantidad || 1)).toFixed(2));
        if (!option) {
          return {
            ...currentRow,
            productId: null,
            codigo: "",
            nombre: "",
            unidadMedida: "",
            stock: 0,
            preCosto: 0,
            preVenta: 0,
            cantidad,
            importe: 0,
          };
        }

        return {
          ...currentRow,
          productId: option.value,
          codigo: product?.codigo ?? "",
          nombre: product?.nombre ?? "",
          unidadMedida: product?.unidadMedida ?? "",
          stock: Number(product?.cantidad ?? 0),
          preCosto: costo,
          preVenta: Number(product?.preVenta ?? 0),
          cantidad,
          importe,
        };
      });
      return;
    }

    fallbackUpdate();
  };

  return (
    <Autocomplete
      size="small"
      fullWidth
      options={options}
      value={selectedOption}
      inputValue={inputValue}
      filterOptions={(opts, state) =>
        opts.filter((opt) =>
          opt.label
            .toLowerCase()
            .includes((state.inputValue ?? "").toLowerCase())
        )
      }
      getOptionLabel={(option) => option.label ?? ""}
      isOptionEqualToValue={(option, val) => option.value === val.value}
      onChange={(_, option) => {
        setValue(option?.value ?? "");
        setInputValue(option?.label ?? "");
        applyProductToRow(option ?? null);
        if (option && typeof focusAfterSelect === "function") {
          focusAfterSelect(row.index);
        }
      }}
      onInputChange={(_, newInputValue, reason) => {
        setInputValue(newInputValue);
        if (reason === "clear") {
          setValue("");
          applyProductToRow(null);
        }
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Buscar..."
          sx={{
            "& .MuiOutlinedInput-root": {
              minHeight: "2.25rem",
            },
            "& .MuiInputBase-input": {
              fontSize: "0.875rem",
              py: 0.5,
            },
          }}
        />
      )}
    />
  );
};

export default AutocompleteTableCell;
