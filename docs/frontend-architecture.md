# Arquitectura modular del frontend

DNX adopta la estructura activa de Picaflor. El punto de entrada y el router viven en `src/app`, junto con los módulos de negocio. Cada módulo concentra los archivos que mantienen su comportamiento y deja los controles reutilizables disponibles en `src/components`.

| Ubicación | Contenido |
| --- | --- |
| `src/app/main.tsx`, `App.tsx` y `routes.tsx` | Inicio de React, proveedores globales y composición de las rutas. |
| `src/app/auth`, `guards`, `layout` y `store` | Inicio de sesión, control de acceso, navegación y estado global de diálogos. |
| `src/app/<módulo>` | Rutas, páginas y los componentes, servicios, hooks, stores y tipos del dominio. |
| `src/app/maintenance/<submódulo>` | Áreas, categorías, computadoras, personal, feriados, proveedores y usuarios. |
| `src/app/listing` | Integración de listados genéricos con los módulos y sus acciones. |
| `src/components` | Controles reutilizables de formularios, tablas, diálogos y comprobantes. |
| `src/shared` | Configuración de API, cliente de consultas, utilidades y estilos globales. |

## Agregar o extender un módulo

1. Ubica la pantalla en `src/app/<módulo>/pages`. Usa `components`, `services`, `hooks`, `store`, `types` o `helpers` dentro del mismo módulo cuando lo necesites.
2. Reutiliza los controles de `src/components` para formularios o tablas. Coloca un componente de negocio junto al módulo que lo mantiene, aunque otra pantalla lo reutilice.
3. Define las rutas del módulo en `routes.tsx` y regístralas en `src/app/routes.tsx`. Usa el guard correspondiente y registra el permiso y el acceso en el menú cuando la funcionalidad los requiera. Las rutas de compatibilidad siguen registradas.
4. Usa imports relativos para archivos cercanos y `@/` para referencias desde la raíz de `src`. TypeScript y Vite resuelven el mismo alias.

Por ejemplo, Caja concentra `pages/CashFinalReportPage.tsx`, `components/CashFlowForm.tsx` y `store/cashFlow.store.ts` en `src/app/cashFlow`. Para agregar un listado genérico sigue la [guía de listados](listing-architecture.md).

## Limpieza de código sin uso

Se revisó el grafo de imports desde `index.html` y `src/app/main.tsx`, incluidos el router, los imports de tipos y los scripts de verificación. Se contrastaron los candidatos con búsquedas de rutas, acciones, archivos estáticos y usos indirectos, como el registro de listados.

- Se retiraron el motor de formularios de demostración, las pantallas de prueba de impresión y caja chica, dos celdas de tabla sin consumidores, un exportador de inventario duplicado, un store de navegación, un hook HTTP y tres recursos gráficos sin referencias.
- Se eliminaron acciones de stores y helpers sin consumidores. Personal usa el listado y las acciones de mantenimiento. Las notas de pedido usan el listado vigente y la edición de `PaymentPage`. La captura HTML activa se abre desde `/sales/html_capture/new`.
- Los archivos históricos `pdt.cs` y `proc.sql` se movieron a `docs/references/accounting`. Sirven como referencia del PDT de escritorio y conservan su contenido.

## Verificación

`npm run build:vercel` y los 20 scripts `scripts/verify-*` pasaron. Se compararon las 114 definiciones de ruta, incluidas redirecciones y permisos. En Chrome se comprobó la pantalla de inicio de sesión y el control de acceso con una sesión simulada.

TypeScript pasó de 297 a 248 errores y ESLint de 404 a 357 errores. Los diagnósticos restantes ya existían antes de la migración. `npm run build` incluye el chequeo de TypeScript y se detiene en esos errores.
