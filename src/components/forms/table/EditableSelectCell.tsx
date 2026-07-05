import React from "react";

const EditableSelectCell = ({ getValue, row, column, table }) => {
  const initialValue = getValue();
  const options = column.columnDef.meta?.options || [];

  const onChange = (e) => {
    table.options.meta?.updateData(row.index, column.id, e.target.value);
  };

  return (
    <select
      value={initialValue}
      onChange={onChange}
      className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};
export default EditableSelectCell;
