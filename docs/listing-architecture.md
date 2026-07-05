# Listado genérico basado en configs (flujo y uso)

## Objetivo
Renderizar listados (tabla + acciones CRUD) sin crear componentes `*List.tsx` por módulo. Un componente genérico (`GenericList`) recibe una clave de módulo y arma todo a partir de un config registrado.

## Piezas principales
- `src/shared/listing/GenericList.tsx`: componente único que orquesta el listado.
- `src/shared/listing/listRegistry.ts`: registro que asocia cada `moduleKey` con su config y hooks de datos/acciones.
- Config de lista por módulo (ej. `employee.list.config.ts`, `categories.list.config.ts`, `area.list.config.ts`): define columnas, rutas base y textos de UI.
- `CrudList` (`src/components/ListView.tsx`): renderiza toolbar, acciones y `DataTable` a partir de props que le pasa el genérico.
- Stores/queries del módulo: exponen `data`, `fetchData`, `deleteItem`.

## Cómo funciona el flujo
1) **Ruta**: En `src/features/maintenance/routes.tsx`, la ruta de un módulo apunta directamente a `<GenericList moduleKey="categories" />` (o `areas`, `employees`, etc.).
2) **Resolución en registry**: `GenericList` usa `moduleKey` para obtener la entrada correspondiente en `listRegistry`:
   - `config`: columnas, `basePath`, `idKey`, textos (`createLabel`, `deleteMessage`).
   - `useDeps()`: hook que retorna `{ data, fetchData, deleteItem }` conectados al store o query del módulo.
3) **Render**: `GenericList` invoca `useDeps`, recibe datos y handlers, y renderiza `<CrudList {...config} data={data} fetchData={fetchData} deleteItem={deleteItem} />`.
4) **UI/Acciones**: `CrudList` construye las columnas (usa `DataTable`), muestra botón “Nuevo” (`basePath/create`), links de edición (`basePath/:id/edit`) y confirmación de borrado con `useDialogStore` + `toast` al eliminar.

## Archivos clave
- `src/shared/listing/GenericList.tsx`: consumo del registry y render del CrudList.
- `src/shared/listing/listRegistry.ts`: mapeo `moduleKey -> { config, useDeps }` para `employees`, `categories`, `areas` (extensible a más módulos).
- `src/features/maintenance/*/*.list.config.ts`: configs de columnas/textos/rutas (ej. `employee.list.config.ts`, `categories.list.config.ts`, `area.list.config.ts`).
- `src/components/ListView.tsx`: implementación de `CrudList` que recibe todo lo necesario.
- `src/shared/config/listConfig.ts`: tipos para configs de listado (`ModuleListConfig`).

## Cómo agregar un nuevo módulo al listado genérico
1) Crear el config de lista: `src/features/<modulo>/<modulo>.list.config.ts` con `basePath`, `columns`, `idKey`, `createLabel`, `deleteMessage`.
2) En `listRegistry.ts`, agregar una entrada:
   ```ts
   <moduleKey>: {
     config: <moduleListConfig>,
     useDeps: () => {
       const { data, fetchData, deleteItem } = <hook del store/query>;
       return { data, fetchData, deleteItem };
     },
   }
   ```
3) En el router, apuntar la ruta a `<GenericList moduleKey="<moduleKey>" />`.

## Notas
- Los antiguos `*List.tsx` se eliminaron; el router usa directamente `GenericList`.
- Para módulos que requieran lógica adicional en la vista de lista, puede extenderse `useDeps` (por ejemplo, prefiltros) o incorporar props extra en el config y consumirlos en `CrudList`/`GenericList`.
