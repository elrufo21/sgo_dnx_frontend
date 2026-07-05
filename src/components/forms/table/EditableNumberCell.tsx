import React, { useState, useEffect } from "react";

const EditableNumberCell = ({ getValue, row, column, table }) => {
  const initialValue = getValue();
  const [value, setValue] = useState(
    initialValue?.toString ? initialValue.toString() : initialValue ?? ""
  );
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (isFocused) return;
    setValue(initialValue?.toString ? initialValue.toString() : initialValue ?? "");
  }, [initialValue, isFocused]);

  const applyChange = (next) => {
    const numeric = Number(next) || 0;
    table.options.meta?.updateData(row.index, column.id, numeric);
  };

  const handleChange = (e) => {
    const next = e.target.value;
    setValue(next);
    applyChange(next);
  };

  const handleBlur = () => {
    setIsFocused(false);
    applyChange(value);
  };

  return (
    <input
      type="number"
      value={value}
      onFocus={() => setIsFocused(true)}
      onChange={handleChange}
      onBlur={handleBlur}
      className="w-full min-w-[84px] px-2 py-1 border border-gray-300 text-right rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  );
};
export default EditableNumberCell;
