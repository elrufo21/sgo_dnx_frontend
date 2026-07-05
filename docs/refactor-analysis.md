# Refactor analysis (enfoque basado en configs por módulo)

## Idea central

Cada módulo (empleados, áreas, categorías, computadoras, etc.) expone un archivo de configuración que describe el “contrato” de la vista: metadatos, endpoints, columnas de tabla, normalizadores, validadores y textos (toasts, diálogos). Las vistas/CRUD genéricos consumen ese config para renderizar tabla, formularios y flujos (crear, editar, eliminar) sin lógica duplicada.

## Qué define un config de módulo

- **Metadatos**: `moduleKey`, `title`, `basePath`.
- **API**: endpoints relativos (`list`, `create`, `update`, `delete`) o funciones `buildPath(id)`.
- **Normalizadores**: entrada/salida (`toForm`, `toPayload`, `beforeSave`).
- **Validadores**: reglas reutilizables (email, DNI, requerido, enums).
- **Tabla**: definición de columnas (id, header, accessor, render), acciones habilitadas.
- **Textos**: mensajes de toast y confirmaciones (`labels.successCreate`, `confirmDeleteMessage`, etc.).
- **Hooks opcionales**: `onAfterSave`, `onError`, flags (`supportsCreate`, `supportsDelete`).

### Ejemplo (borrador) `src/features/maintenance/employees/employee.config.ts`

```ts
import type { ColumnDef } from "@tanstack/react-table";
import type { Personal } from "@/types/employees";
import { isEmail, isDni } from "@/shared/validators";

export const employeeConfig = {
  moduleKey: "employees",
  title: "Empleados",
  basePath: "/maintenance/employees",
  api: {
    list: "/Personal/list",
    create: "/Personal/registerpersonal",
    update: (id: number | string) => `/Personal/${id}`,
    delete: (id: number | string) => `/Personal/${id}`,
  },
  normalizers: {
    toForm: (raw: any): Personal => ({
      personalId: raw.personalId ?? raw.id ?? 0,
      personalNombres: raw.personalNombres ?? raw.nombres ?? "",
      personalApellidos: raw.personalApellidos ?? raw.apellidos ?? "",
      areaId: raw.areaId ?? raw.AreaId ?? 0,
      personalCodigo: raw.personalCodigo ?? raw.codigo ?? "",
      personalNacimiento: raw.personalNacimiento ?? null,
      personalIngreso: raw.personalIngreso ?? null,
      personalDni: raw.personalDni ?? raw.dni ?? "",
      personalDireccion: raw.personalDireccion ?? raw.direccion ?? "",
      personalTelefono: raw.personalTelefono ?? raw.telefono ?? "",
      personalEmail: raw.personalEmail ?? raw.correo ?? "",
      personalEstado: raw.personalEstado ?? raw.estado ?? "ACTIVO",
      personalImagen: raw.personalImagen ?? raw.foto ?? "",
      companiaId: raw.companiaId ?? 1,
    }),
    toPayload: (v: Personal) => ({
      personalId: v.personalId ?? 0,
      personalNombres: v.personalNombres?.toUpperCase() ?? "",
      personalApellidos: v.personalApellidos?.toUpperCase() ?? "",
      areaId: Number(v.areaId) || 0,
      personalCodigo: v.personalCodigo ?? "",
      personalNacimiento: v.personalNacimiento ?? null,
      personalIngreso: v.personalIngreso ?? null,
      personalDNI: v.personalDni ?? "",
      personalDireccion: v.personalDireccion ?? "",
      personalTelefono: v.personalTelefono ?? "",
      personalEstado: v.personalEstado ?? "ACTIVO",
      personalEmail: v.personalEmail ?? "",
      personalImagen: v.personalImagen ?? "",
      companiaId: Number(v.companiaId) || 1,
    }),
  },
  validators: {
    email: isEmail,
    dni: isDni,
    area: (val: number | string) => Number(val) > 0,
  },
  table: {
    columns: [
      { id: "codigo", header: "Código", accessorKey: "personalCodigo" },
      { id: "nombres", header: "Nombres", accessorKey: "personalNombres" },
      {
        id: "apellidos",
        header: "Apellidos",
        accessorKey: "personalApellidos",
      },
      { id: "estado", header: "Estado", accessorKey: "personalEstado" },
    ] satisfies ColumnDef<Personal>[],
  },
  labels: {
    confirmDelete: "¿Seguro que deseas eliminar este empleado?",
    successSave: "Empleado guardado",
    successDelete: "Empleado eliminado",
    errorDelete: "No se pudo eliminar el empleado",
  },
};
```

## Infraestructura de soporte

- `src/config.ts`: API base/global; per-módulo configs viven junto a cada feature.
- `src/shared/api/client.ts`: `request(path, options) => ApiResult`; acepta path relativo y usa `API_BASE_URL`. Devuelve `{ ok, data, status, message }`.
- `src/shared/validators.ts`: `isEmail`, `isDni`, `required`, `minLength`, etc.
- `src/shared/normalizers.ts`: helpers genéricos si aplica; la mayoría van en cada config.
- `src/shared/ui/confirmDelete.tsx`: helper para abrir diálogo de confirmación con `useDialogStore`.
- `src/shared/ui/toast.ts`: `toastSuccess/Error/Warning` usando `richColors`.
- `src/shared/table/columnFactory.ts`: fabrica columnas comunes (acciones, estado) para reutilizar entre configs.

## Refactor propuesto (pasos)

1. **Infra mínima**: añadir `src/config.ts` (API base), `shared/api/client.ts`, `shared/validators.ts`, `shared/ui/toast.ts`, `shared/ui/confirmDelete.tsx`.
2. **Config de listados**: definir configs por módulo (ej. `employee.list.config.ts`, `category.list.config.ts`, `area.list.config.ts`) y usar `CrudList` consumiendo esos objetos para columnas, rutas y textos.
3. **Config por módulo (formularios y API)**: crear `employee.config.ts` (normalizadores, endpoints) y ajustar stores a usar `api.client` + normalizadores del config.
4. **Extender a áreas/categorías/computadoras**: crear sus configs y adaptar stores a consumirlos (payloads/normalización/labels).
5. **Form validation**: reemplazar regex inline por `validators` del config.
6. **Toasts/confirm**: usar helpers centralizados y textos del config.
7. **Column reuse**: mover definiciones de columnas a los configs y consumirlos en `ListView`/`DataTable`.

## Beneficios

- Menos lógica duplicada (normalización, validación, mensajes).
- Cambios de API centralizados (solo actualizar paths en config).
- Vistas CRUD más declarativas: la UI se arma leyendo el config.
- Escalabilidad: agregar un módulo nuevo = definir su config + wiring mínimo.
