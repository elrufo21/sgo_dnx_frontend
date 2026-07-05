import React, { useState, useEffect } from "react";

const EditableTextCell = ({
  getValue,
  row,
  column,
  table,
  disabled = false,
}) => {
  const initialValue = getValue();
  const [value, setValue] = useState(initialValue);

  const columnDisabled = column?.columnDef?.meta?.disabled;
  const isDisabled =
    typeof columnDisabled === "function"
      ? columnDisabled(row?.original, row)
      : columnDisabled ?? disabled;

  const onBlur = () => {
    table.options.meta?.updateData(row.index, column.id, value);
  };

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <input
      value={value}
      disabled={isDisabled}
      onChange={(e) => setValue(e.target.value)}
      onBlur={onBlur}
      className="w-full min-w-[96px] px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
};

export default EditableTextCell;
