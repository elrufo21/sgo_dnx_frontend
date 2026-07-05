import React from "react";
import { FormRenderer } from "../FormRenderer";
import { simpleFormConfig } from "./simpleForm.config";

export function SimpleFormDemo() {
  return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl shadow p-6">
      <FormRenderer
        config={simpleFormConfig}
        mode="create"
        initialValues={{}}
        onSubmit={(data) => {
          console.log("submit demo", data);
          alert(JSON.stringify(data, null, 2));
        }}
        onNew={() => alert("Nuevo")}
        onDelete={() => alert("Eliminar")}
      />
    </div>
  );
}
