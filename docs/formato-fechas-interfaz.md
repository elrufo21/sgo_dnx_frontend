# Fechas visibles en la interfaz

Las fechas se presentan en formato español `dd/mm/aaaa`, con hora de 24 horas cuando corresponde. El helper compartido `src/shared/helpers/formatDate.ts` interpreta fechas ISO y fechas con barras como día/mes/año, sin invertir fechas ambiguas como `03/04/2026`. Los valores no reconocidos se conservan en las tablas que los muestran.

La revisión abarcó máquinas, resumen de boletas, facturas de servicio, despacho de facturas, PDT, comparación SIRE, asistencia y pagos varios; caja, feriados, empleados y otras vistas ya utilizaban el helper o formato local. Los selectores MUI revisados usan `es`; los campos nativos de fecha dependen también del navegador y sistema operativo. Las fechas ISO usadas en formularios, filtros, API y archivos electrónicos conservan su formato de intercambio.
