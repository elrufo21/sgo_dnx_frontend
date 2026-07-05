import type { FormConfig } from "../types";

export const simpleFormConfig: FormConfig = {
  id: "simple-demo",
  title: { create: "Demo Create", edit: "Demo Edit" },
  fields: [
    {
      name: "nombre",
      label: "Nombre",
      type: "text",
      placeholder: "Tu nombre",
      validators: [{ type: "required", message: "Ingresa tu nombre" }],
    },
    {
      name: "email",
      label: "Email",
      type: "text",
      placeholder: "tucorreo@dominio.com",
      validators: [
        { type: "required", message: "Ingresa tu correo" },
        { type: "pattern", value: /^\S+@\S+\.\S+$/, message: "Correo invalido" },
      ],
    },
    {
      name: "rol",
      label: "Rol",
      type: "select",
      options: {
        type: "static",
        options: [
          { value: "admin", label: "Admin" },
          { value: "user", label: "Usuario" },
        ],
      },
      validators: [{ type: "required", message: "Selecciona un rol" }],
    },
  ],
  sections: [
    {
      id: "main",
      title: "Datos basicos",
      columns: 2,
      fields: ["nombre", "email", "rol"],
    },
  ],
  defaults: () => ({ nombre: "", email: "", rol: "" }),
};
