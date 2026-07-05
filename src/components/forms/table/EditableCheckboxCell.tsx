import React from "react";

const EditableCheckboxCell = ({ getValue, row, column, table }) => {
  const initialValue = getValue();

  const onChange = (e) => {
    table.options.meta?.updateData(row.index, column.id, e.target.checked);
  };

  return (
    <div className="flex justify-center">
      <input
        type="checkbox"
        checked={initialValue}
        onChange={onChange}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
};

export default EditableCheckboxCell;
