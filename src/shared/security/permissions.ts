import type { AuthUser } from "@/store/auth/auth.store";

export const permissionGroups = [
  {
    title: "Ventas",
    permissions: [
      ["VENTAS.VER", "Módulo Ventas", "Acceso general a las operaciones de venta."],
      ["VENTAS.POS", "Punto de venta", "Registrar ventas desde el POS."],
      ["VENTAS.CAPTURAR", "Captura de ventas", "Usar la captura HTML de ventas."],
      ["VENTAS.LISTA", "Lista de ventas", "Consultar y editar notas de pedido."],
      ["VENTAS.OBS", "Extraer ventas OBS", "Importar ventas desde OBS."],
      ["VENTAS.GUIA_REMISION", "Guías de remisión", "Generar y consultar guías."],
      ["VENTAS.NOTA_PEDIDO", "Notas de pedido", "Crear y editar notas de pedido."],
      ["VENTAS.RESUMEN_BOLETAS", "Resumen de boletas", "Consultar y enviar resúmenes."],
      ["VENTAS.ANULAR", "Anular comprobantes", "Anular una venta emitida."],
    ],
  },
  {
    title: "Caja",
    permissions: [
      ["CAJA.VER", "Módulo Caja", "Acceso general a las operaciones de caja."],
      ["CAJA.CONTROL", "Control de caja", "Consultar movimientos y arqueos."],
      ["CAJA.APERTURA", "Apertura y cierre", "Abrir, editar y cerrar caja."],
      ["CAJA.INFORME_FINAL", "Informe final", "Generar el informe final de caja."],
      ["CAJA.CHICA", "Caja chica", "Registrar movimientos de caja chica."],
      ["CAJA.GESTIONAR", "Gestionar caja", "Modificar movimientos y estados de caja."],
    ],
  },
  {
    title: "Operaciones",
    permissions: [
      ["COMPRAS.GESTIONAR", "Compras", "Crear, editar y consultar compras."],
      ["FACTURAS_SERVICIO.GESTIONAR", "Facturas de servicio", "Gestionar facturas de servicio."],
      ["CLIENTES.GESTIONAR", "Clientes", "Crear, editar y consultar clientes."],
    ],
  },
  {
    title: "Contabilidad",
    permissions: [
      ["CONTABILIDAD.VER", "Módulo Contabilidad", "Acceso general a contabilidad."],
      ["CONTABILIDAD.PDT_EMPRESA", "PDT Empresa", "Gestionar datos para PDT."],
      ["CONTABILIDAD.ENVIO_FACTURAS", "Envío de facturas", "Consultar y reenviar facturas."],
      ["CONTABILIDAD.RESUMEN_BOLETAS", "Resumen de boletas", "Enviar y consultar resúmenes."],
    ],
  },
  {
    title: "Mantenimiento",
    permissions: [
      ["MANTENIMIENTO.VER", "Módulo Mantenimiento", "Acceso general a los catálogos."],
      ["MANTENIMIENTO.AREAS", "Áreas", "Crear y editar áreas."],
      ["MANTENIMIENTO.CATEGORIAS", "Categorías", "Gestionar categorías y sublíneas."],
      ["MANTENIMIENTO.PROVEEDORES", "Proveedores", "Gestionar proveedores y contactos."],
      ["MANTENIMIENTO.FERIADOS", "Feriados", "Gestionar feriados."],
      ["MANTENIMIENTO.COMPUTADORAS", "Computadoras", "Gestionar equipos."],
      ["MANTENIMIENTO.PRODUCTOS", "Productos", "Gestionar catálogo de productos."],
      ["MANTENIMIENTO.EMPLEADOS", "Empleados", "Gestionar empleados."],
      ["MANTENIMIENTO.USUARIOS", "Gestionar usuarios", "Crear, editar o eliminar usuarios."],
      ["MANTENIMIENTO.RESUMEN_BOLETAS", "Resumen de boletas", "Consultar el resumen de boletas."],
    ],
  },
  {
    title: "Configuración",
    permissions: [
      ["CONFIGURACION.VER", "Módulo Configuración", "Acceso general a ajustes."],
      ["CONFIGURACION.FACTURACION", "Facturación", "Configurar certificado y credenciales SOL."],
      ["CONFIGURACION.VENTAS_BOLETAS", "Ventas y boletas", "Configurar envío y captura."],
      ["CONFIGURACION.CAJA", "Configuración de caja", "Configurar cierre de caja."],
      ["CONFIGURACION.PERMISOS", "Permisos", "Administrar permisos por área y usuario."],
    ],
  },
] as const;

export const allPermissionCodes = permissionGroups.flatMap((group) =>
  group.permissions.map(([code]) => code),
);

export const hasPermission = (user: AuthUser | null, code: string): boolean =>
  Boolean(user?.isAdministrator || user?.permissions.includes(code));
