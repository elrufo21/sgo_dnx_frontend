import { pdf } from '@react-pdf/renderer';
import { writeFile } from 'node:fs/promises';
import { ServiceInvoicePdfDocument } from '../src/features/serviceInvoices/components/ServiceInvoicePdf';
const total = 31011.34;
const invoice = { compra: { compraId: 1, tipoCodigo: '01', compraConcepto: 'SERVICIO', serie: 'FA02', numero: '00000001', nroComprobante: 'FA02-00000001', fechaEmision: '2026-11-10', fechaRegistro: '2026-11-10 10:00:00', condicion: 'CREDITO', total, subTotal: 26280.80, igv: 4730.54 }, detalles: [{ detalleCompraId: 1, compraId: 1, detalleDesc: 'SERVICIO', detalleCant: 1, detallePrecio: total, importe: total }] };
const blob = await pdf(ServiceInvoicePdfDocument({invoice, company: {name:'EMPRESA',ruc:'00000000000'}, montoPendiente: total-Math.round(total*0.1)})).toBlob();
await writeFile('tmp/pdfs/factura-servicio-verificacion.pdf', Buffer.from(await blob.arrayBuffer()));

