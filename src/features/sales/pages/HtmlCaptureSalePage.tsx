import { pdf } from "@react-pdf/renderer";
import { CheckCircle2, FileDown, FileUp, RotateCcw } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useForm } from "react-hook-form";
import TicketDocument from "@/components/Ticket";
import { HookForm } from "@/components/forms/HookForm";
import { SaleCaptureFormFields } from "@/components/sales/SaleCaptureFormFields";
import { generateTicketQrBase64 } from "@/components/ticketQr";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import { useClientsStore } from "@/store/customers/customers.store";
import { useProductsStore } from "@/store/products/products.store";
import type { Client } from "@/types/customer";
import type { Product } from "@/types/product";
import type { PosCartItem } from "@/types/pos";

type CaptureLine = { code: string; quantity: number };
type CaptureData = {
  transactionNumber: string;
  memberCode: string;
  customerName: string;
  ruc: string;
  date: string;
  discount: number;
  lines: CaptureLine[];
};
type SaleRow = {
  product: Product;
  code: string;
  description: string;
  quantity: number;
  price: number;
  cost: number;
  stock: number;
  pv: number;
  sv: number;
  matched: boolean;
};
type SaleForm = {
  docTypeCode: "03" | "01";
  condition: "ALCONTADO" | "CREDITO";
  delivery: "INMEDIATA" | "POR ENTREGAR";
  paymentMethod: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "YAPE" | "DEPOSITO";
  bankEntity: string;
  operationNumber: string;
  customerName: string;
  customerDoc: string;
  address: string;
  memberCode: string;
  transactionNumber: string;
};

const DOC_CONFIG = {
  "03": { docu: "BOLETA", serie: "BA01", ticket: "boleta" as const },
  "01": { docu: "FACTURA", serie: "FA01", ticket: "factura" as const },
};

const defaultForm: SaleForm = {
  docTypeCode: "03",
  condition: "ALCONTADO",
  delivery: "INMEDIATA",
  paymentMethod: "EFECTIVO",
  bankEntity: "-",
  operationNumber: "",
  customerName: "",
  customerDoc: "",
  address: "",
  memberCode: "",
  transactionNumber: "",
};

const safeTrim = (value: unknown) => String(value ?? "").trim();
const normalizeCode = (value: unknown) => safeTrim(value).toUpperCase();
const readText = (root: ParentNode, selector: string) =>
  root.querySelector(selector)?.textContent?.trim() ?? "";
const getClientCode = (client: Client | null | undefined) =>
  safeTrim(client?.clienteCodigo);
const money = (value: number) =>
  Number(value || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const localDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};
const parseNumber = (value: unknown) => {
  const chunks = String(value ?? "").match(/-?\d+(?:[.,]\d+)?/g) ?? [];
  return chunks.reduce((total, chunk) => {
    const parsed = Number(chunk.replace(",", "."));
    return Number.isFinite(parsed) ? total + parsed : total;
  }, 0);
};
const frameFileName = (html: string) => {
  const document = new DOMParser().parseFromString(html, "text/html");
  const src = document.querySelector("frame")?.getAttribute("src") ?? "";
  return decodeURIComponent(src.replace(/\\/g, "/")).split("/").pop() ?? "";
};
const parseNotaResult = (result: unknown) => {
  const raw =
    typeof result === "string"
      ? result
      : safeTrim(
          (result as any)?.resultado ??
            (result as any)?.Resultado ??
            (result as any)?.data ??
            "",
        );
  const [idRaw = "", numberRaw = ""] = raw.split("¬");
  return {
    noteId: Number(idRaw.match(/\d+/)?.[0] ?? 0),
    number: (numberRaw.match(/\d+/)?.[0] ?? numberRaw).padStart(8, "0"),
    raw,
  };
};
const parseCapture = (html: string): CaptureData => {
  const document = new DOMParser().parseFromString(html, "text/html");
  const table = document.querySelector("table");
  const ruc = readText(document, "#section-1 .medium-font.center-align");
  const sectionText = readText(document, "#section-6");
  const memberCode =
    sectionText.match(/No\.\s*de\s*Membres[ií]a\s*:?\s*([A-Z0-9-]+)/i)?.[1] ??
    readText(document, "#section-6 .fright.left-align")
      .replace("Miembro Telefono", "#")
      .replace("Miembro Teléfono", "#")
      .replace("No. de Membresia", "")
      .replace(":", "")
      .split("#")[0];
  const discountText = readText(document, "#discount .sections.summary")
    .replace("DISCOUNT", "")
    .trim();
  const lines =
    document.getElementById("section-6") && table
      ? Array.from(table.querySelectorAll("tr"))
          .slice(1)
          .map((row) => {
            const cells = Array.from(row.querySelectorAll("td"));
            return {
              code: normalizeCode(cells[0]?.textContent),
              quantity: parseNumber(cells[5]?.textContent),
            };
          })
          .filter((line) => line.code && line.quantity > 0)
      : [];

  return {
    transactionNumber: readText(document, "#section-6 .center.medium-font"),
    memberCode: safeTrim(memberCode),
    customerName:
      readText(document, "#section-2 .fleft") ||
      readText(document, "#section-3 .fleft"),
    ruc,
    date: readText(
      document,
      ruc.toUpperCase().includes("FACTURA")
        ? "#section-5 .fleft"
        : "#section-3 .fleft",
    ),
    discount: parseNumber(discountText),
    lines,
  };
};
const readSession = () => {
  if (typeof window === "undefined") {
    return {
      companyId: 1,
      username: "USUARIO",
      companyName: "",
      companyRuc: "",
      companyAddress: "",
      companyDistrict: "",
    };
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(localStorage.getItem("sgo.auth.session") ?? "null");
  } catch {
    parsed = null;
  }

  return {
    companyId:
      Number(
        parsed?.user?.companyId ?? localStorage.getItem("companiaId") ?? 1,
      ) || 1,
    username:
      safeTrim(parsed?.user?.displayName) ||
      safeTrim(parsed?.user?.username) ||
      "USUARIO",
    companyName:
      safeTrim(parsed?.user?.companyCommercialName) ||
      safeTrim(parsed?.user?.companyName),
    companyRuc: safeTrim(parsed?.user?.companyRuc),
    companyAddress: safeTrim(parsed?.user?.companySunatAddress),
    companyDistrict: safeTrim(parsed?.user?.companyUbigeoName),
  };
};

export default function HtmlCaptureSalePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const externalCaptureKeyRef = useRef("");
  const { products, fetchProducts, loading } = useProductsStore();
  const { clients, fetchClients } = useClientsStore();
  const [capture, setCapture] = useState<CaptureData | null>(null);
  const [pendingExternalCapture, setPendingExternalCapture] =
    useState<CaptureData | null>(null);
  const [rows, setRows] = useState<SaleRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastDocument, setLastDocument] = useState("");
  const session = useMemo(readSession, []);
  const formMethods = useForm<SaleForm>({ defaultValues: defaultForm });
  const form = formMethods.watch();

  useEffect(() => {
    if (!products.length) void fetchProducts();
    if (!clients.length) void fetchClients();
  }, [clients.length, fetchClients, fetchProducts, products.length]);

  const productByCode = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((product) => {
      const key = normalizeCode(product.codigo);
      if (key && !map.has(key)) map.set(key, product);
    });
    return map;
  }, [products]);

  const clientOptions = useMemo(
    () =>
      clients.map((client) => ({
        client,
        label: safeTrim(client.nombreRazon),
        doc: safeTrim(client.ruc || client.dni),
        code: getClientCode(client),
      })),
    [clients],
  );
  const selectedClient = useMemo(
    () =>
      clientOptions.find(
        (opt) =>
          opt.label === safeTrim(form.customerName) ||
          (safeTrim(form.memberCode) && opt.code === safeTrim(form.memberCode)) ||
          (safeTrim(form.customerDoc) && opt.doc === safeTrim(form.customerDoc)),
      )?.client ?? null,
    [clientOptions, form.customerDoc, form.customerName, form.memberCode],
  );

  const applyClient = useCallback(
    (client: Client | null) => {
      if (!client) return;
      formMethods.setValue("customerName", client.nombreRazon ?? "", {
        shouldDirty: true,
      });
      formMethods.setValue("customerDoc", client.ruc || client.dni || "", {
        shouldDirty: true,
      });
      formMethods.setValue("memberCode", getClientCode(client), {
        shouldDirty: true,
      });
      formMethods.setValue(
        "address",
        client.direccionFiscal || client.direccionDespacho || "",
        { shouldDirty: true },
      );
      formMethods.setValue("docTypeCode", client.ruc ? "01" : form.docTypeCode, {
        shouldDirty: true,
      });
    },
    [form.docTypeCode, formMethods],
  );

  useEffect(() => {
    const code = safeTrim(form.memberCode);
    if (!code || selectedClient) return;
    const match = clientOptions.find((opt) => opt.code === code)?.client ?? null;
    if (match) applyClient(match);
  }, [applyClient, clientOptions, form.memberCode, selectedClient]);

  const buildRows = useCallback(
    (data: CaptureData) =>
      data.lines.map((line): SaleRow => {
        const found = productByCode.get(line.code);
        const product: Product = found ?? {
          id: -1,
          codigo: line.code,
          nombre: line.code,
          unidadMedida: "UNIDAD",
          valorCritico: 0,
          preCosto: 0,
          preVenta: 0,
          preVentaB: 0,
          aplicaINV: "S",
          cantidad: 0,
          pv: 0,
          sv: 0,
          usuario: "",
          estado: "ACTIVO",
        };

        return {
          product,
          code: product.codigo,
          description: product.nombre,
          quantity: line.quantity,
          price: Number(product.preVenta ?? product.preVentaB ?? 0),
          cost: Number(product.preCosto ?? 0),
          stock: Number(product.cantidad ?? 0),
          pv: Number(product.pv ?? 0),
          sv: Number(product.sv ?? 0),
          matched: Boolean(found),
        };
      }),
    [productByCode],
  );

  const applyCaptureData = useCallback(
    (data: CaptureData) => {
      const docValue =
        data.ruc
          .replace(/FACTURA|BOLETA|RUC|DNI|DOCUMENTO|:/gi, " ")
          .match(/\d{8,11}/)?.[0] ?? "";
      const nextRows = buildRows(data);
      setCapture(data);
      setRows(nextRows);
      const nextDocTypeCode =
        data.ruc.toUpperCase().includes("FACTURA") || docValue.length === 11
          ? "01"
          : "03";
      const matchedClient =
        clientOptions.find(
          (opt) => opt.code && opt.code === safeTrim(data.memberCode),
        )?.client ?? null;
      formMethods.setValue("docTypeCode", nextDocTypeCode, {
        shouldDirty: true,
      });
      if (matchedClient) {
        applyClient(matchedClient);
      } else {
        formMethods.setValue(
          "customerName",
          data.customerName || formMethods.getValues("customerName"),
          { shouldDirty: true },
        );
        formMethods.setValue(
          "customerDoc",
          docValue || formMethods.getValues("customerDoc"),
          { shouldDirty: true },
        );
      }
      formMethods.setValue(
        "memberCode",
        data.memberCode || formMethods.getValues("memberCode"),
        { shouldDirty: true },
      );
      formMethods.setValue(
        "transactionNumber",
        data.transactionNumber || formMethods.getValues("transactionNumber"),
        { shouldDirty: true },
      );
      setLastDocument("");
      toast.success(`Capturados ${nextRows.length} productos.`);
    },
    [applyClient, buildRows, clientOptions, formMethods],
  );

  const totals = useMemo(() => {
    const subtotal = rows.reduce(
      (sum, row) => sum + row.quantity * row.price,
      0,
    );
    const discount = Math.min(capture?.discount ?? 0, subtotal);
    const total = subtotal - discount;
    return {
      subtotal,
      discount,
      base: total / 1.18,
      igv: total - total / 1.18,
      total,
      pv: rows.reduce((sum, row) => sum + row.pv * row.quantity, 0),
      sv: rows.reduce((sum, row) => sum + row.sv * row.quantity, 0),
    };
  }, [capture?.discount, rows]);

  const cartItems = useMemo<PosCartItem[]>(
    () =>
      rows.map((row) => ({
        productId: row.product.id,
        codigo: row.code,
        nombre: row.description,
        unidadMedida: row.product.unidadMedida || "UNIDAD",
        precio: row.price,
        precioMinimo: row.price,
        cantidad: row.quantity,
        valorUM: 1,
        pv: row.pv,
        sv: row.sv,
        stock: row.stock,
      })),
    [rows],
  );

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length) return;

    const firstHtml = await files[0].text();
    let data = parseCapture(firstHtml);
    if (!data.lines.length && files.length > 1) {
      const target = frameFileName(firstHtml).toLowerCase();
      const candidates = target
        ? [
            ...files.filter((file) => file.name.toLowerCase() === target),
            ...files.filter((file) => file.name.toLowerCase() !== target),
          ]
        : files.slice(1);
      for (const file of candidates) {
        data = parseCapture(await file.text());
        if (data.lines.length) break;
      }
    }

    if (!data.lines.length) {
      const target = frameFileName(firstHtml);
      toast.error(
        target
          ? `Selecciona tambien ${target}.`
          : "No se encontraron productos en el HTML.",
      );
      return;
    }

    applyCaptureData(data);
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const message = event.data as
        | { type?: string; payload?: CaptureData }
        | undefined;
      if (message?.type !== "SGO_DXN_CAPTURE") return;
      if (!message.payload?.lines?.length) return;
      const key = JSON.stringify(message.payload);
      if (externalCaptureKeyRef.current === key) return;
      externalCaptureKeyRef.current = key;
      setPendingExternalCapture(message.payload);
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    let attempts = 0;
    const askForCapture = () => {
      attempts += 1;
      window.postMessage(
        { type: "SGO_DXN_CAPTURE_READY" },
        window.location.origin,
      );
      if (attempts >= 20) window.clearInterval(timer);
    };
    const timer = window.setInterval(askForCapture, 300);
    askForCapture();
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!pendingExternalCapture || !products.length) return;
    applyCaptureData(pendingExternalCapture);
    setPendingExternalCapture(null);
  }, [applyCaptureData, pendingExternalCapture, products.length]);

  const clearForm = () => {
    setCapture(null);
    setRows([]);
    formMethods.reset(defaultForm);
    setLastDocument("");
  };

  const validate = () => {
    if (!rows.length) return "Carga un HTML antes de vender.";
    const missing = rows.filter((row) => !row.matched);
    if (missing.length) {
      return `Productos no encontrados: ${missing
        .slice(0, 5)
        .map((row) => row.code)
        .join(", ")}`;
    }
    if (form.docTypeCode === "01" && safeTrim(form.customerDoc).length !== 11) {
      return "Factura requiere RUC de 11 digitos.";
    }
    if (form.paymentMethod !== "EFECTIVO" && !safeTrim(form.operationNumber)) {
      return "Ingresa el numero de operacion.";
    }
    return "";
  };

  const downloadTicket = async (documentNumber: string, noteId: number) => {
    const qrData = [
      session.companyRuc || "20601070155",
      form.docTypeCode,
      documentNumber,
      totals.igv.toFixed(2),
      totals.total.toFixed(2),
      localDate(),
      form.docTypeCode === "01" ? "06" : "01",
      form.customerDoc ||
        (form.docTypeCode === "01" ? "00000000000" : "00000000"),
    ].join("|");
    const preGeneratedQrBase64 = await generateTicketQrBase64(qrData);
    const blob = await pdf(
      <TicketDocument
        clientName={form.customerName || "VARIOS"}
        clientId={form.customerDoc}
        clientAddress={form.address}
        docType={DOC_CONFIG[form.docTypeCode].ticket}
        paymentMethod={form.paymentMethod}
        items={cartItems}
        totals={{
          subTotal: totals.subtotal,
          total: totals.total,
          itemCount: rows.length,
        }}
        documentNumber={documentNumber}
        noteId={noteId}
        companyName={session.companyName}
        companyRuc={session.companyRuc}
        companyAddress={session.companyAddress}
        companyDistrict={session.companyDistrict}
        summary={{
          operacionGravada: totals.base,
          descuento: totals.discount,
          showDiscount: totals.discount > 0,
          subtotal: totals.base,
          igv: totals.igv,
          total: totals.total,
        }}
        preGeneratedQrBase64={preGeneratedQrBase64}
      />,
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${documentNumber || `TICKET_${Date.now()}`}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  };

  const registerSale = async () => {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    const doc = DOC_CONFIG[form.docTypeCode];
    const total = Number(totals.total.toFixed(2));
    const efectivo = form.paymentMethod === "EFECTIVO" ? total : 0;
    const deposito = form.paymentMethod === "EFECTIVO" ? 0 : total;
    const clienteId = Number(selectedClient?.id ?? 1) || 1;

    setIsSaving(true);
    try {
      const result = await apiRequest({
        url: buildApiUrl("/Nota/crearOrden"),
        method: "POST",
        data: {
          nota: {
            notaId: 0,
            notaDocu: doc.docu,
            clienteId,
            notaFecha: `${localDate()}T00:00:00`,
            notaUsuario: session.username,
            notaFormaPago: form.paymentMethod,
            notaCondicion: form.condition,
            notaFechaPago: new Date().toISOString(),
            notaDireccion: form.address || "-",
            notaSubtotal: total,
            notaMovilidad: 0,
            notaDescuento: Number(totals.discount.toFixed(2)),
            notaTotal: total,
            notaAcuenta: 0,
            notaSaldo: total,
            notaAdicional: 0,
            notaTarjeta: 0,
            notaPagar: total,
            notaEstado: "CANCELADO",
            companiaId: session.companyId,
            notaEntrega: form.delivery,
            notaConcepto: "MERCADERIA",
            notaSerie: doc.serie,
            notaNumero: "00000000",
            notaGanancia: 0,
            icbper: 0,
            entidadBancaria: form.bankEntity || "-",
            nroOperacion: form.operationNumber,
            efectivo,
            deposito,
            notaTransaccion: form.transactionNumber,
            miembro: form.customerName || "VARIOS",
            codigoCliente: form.memberCode,
            conceptoOBS: "VENTA",
            estadoOBS: "EMITIDO",
            pv: `${Number(totals.pv.toFixed(2))} PV`,
            image: "",
            codigoRes: "",
            responsable: "",
          },
          detalles: rows.map((row) => ({
            idProducto: row.product.id,
            detalleCantidad: row.quantity,
            detalleUm: row.product.unidadMedida || "UNIDAD",
            detalleDescripcion: row.description,
            detalleCosto: row.cost,
            detallePrecio: row.price,
            detallePV: Number((row.pv * row.quantity).toFixed(2)),
            detalleSV: Number((row.sv * row.quantity).toFixed(2)),
            detalleImporte: Number((row.price * row.quantity).toFixed(2)),
            detalleEstado: "PENDIENTE",
            valorUM: 1,
          })),
        },
        config: {
          headers: { Accept: "*/*", "Content-Type": "application/json" },
        },
        fallback: null,
      });

      const parsed = parseNotaResult(result);
      const documentNumber = `${doc.serie}-${parsed.number}`;
      if (!parsed.noteId) {
        toast.error(parsed.raw || "No se pudo registrar la venta.");
        return;
      }

      setLastDocument(documentNumber);
      await downloadTicket(documentNumber, parsed.noteId);
      toast.success(`${doc.docu} registrada: ${documentNumber}`);
    } catch (err) {
      console.error("No se pudo registrar venta HTML", err);
      toast.error("No se pudo registrar la venta.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1760px] space-y-4">
      {/* Datos de la venta */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-2">
          <h2 className="text-sm font-semibold text-slate-700">
            Datos de la venta
          </h2>
        </div>
        <HookForm methods={formMethods} onSubmit={() => undefined}>
          <div className="px-5 py-3">
            <SaleCaptureFormFields
              clientOptions={clientOptions}
              disabled={isSaving}
              onClientSelected={applyClient}
            />
          </div>
        </HookForm>
      </section>

      {/* Productos capturados */}
      <section className="rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2">
          <h2 className="mr-auto text-sm font-semibold text-slate-700">
            Productos capturados
            {rows.length > 0 && (
              <span className="ml-2 font-normal text-slate-400">
                ({rows.length})
              </span>
            )}
          </h2>

          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.htm,text/html"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || isSaving}
          >
            <FileUp className="h-4 w-4" />
            Capturar datos
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={clearForm}
            disabled={isSaving}
          >
            <RotateCcw className="h-4 w-4" />
            Limpiar
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={registerSale}
            disabled={
              isSaving || !rows.length || rows.some((row) => !row.matched)
            }
          >
            {isSaving ? (
              <FileDown className="h-4 w-4 animate-pulse" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {isSaving ? "Registrando..." : "Registrar y descargar ticket"}
          </button>
        </div>

        <div className="max-h-[46vh] overflow-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="sticky top-0 bg-white text-xs uppercase tracking-wide text-slate-400">
              <tr>
                {[
                  "Codigo",
                  "Descripcion",
                  "Cantidad",
                  "Precio",
                  "Stock",
                  "PV Unit.",
                  "PV Total",
                  "SV",
                  "Importe",
                ].map((header, i) => (
                  <th
                    key={header}
                    className={`border-b border-slate-100 px-4 py-2 font-medium ${
                      i > 1 ? "text-right" : "text-left"
                    }`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-14 text-center text-sm text-slate-400"
                  >
                    Carga un archivo HTML para ver productos.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.code}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-2 font-medium text-slate-700">
                      <span className="flex items-center gap-2">
                        {row.code}
                        {!row.matched && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            no encontrado
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {row.description}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {row.quantity}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {money(row.price)}
                    </td>
                    <td
                      className={`px-4 py-2 text-right font-medium ${
                        row.stock < 0 ? "text-red-600" : "text-slate-600"
                      }`}
                    >
                      {money(row.stock)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500">
                      {money(row.pv)}
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-700">
                      {money(row.pv * row.quantity)}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-500">
                      {money(row.sv * row.quantity)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-800">
                      {money(row.price * row.quantity)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Totales: barra compacta al pie de la misma tarjeta */}
        <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-sm">
          <Summary label="Sub total" value={totals.subtotal} />
          <Summary label="IGV" value={totals.igv} />
          <Summary label="PVS" value={totals.pv} />
          {totals.discount > 0 && (
            <Summary label="Descuento" value={totals.discount} negative />
          )}
          <div className="flex items-baseline gap-2 border-l border-slate-200 pl-6">
            <span className="text-sm font-semibold text-slate-700">Total</span>
            <span className="text-lg font-semibold text-slate-900">
              S/ {money(totals.total)}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

function Summary({
  label,
  value,
  negative,
}: {
  label: string;
  value: number;
  negative?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-slate-500">{label}</span>
      <span
        className={`font-medium ${
          negative && value > 0 ? "text-red-600" : "text-slate-700"
        }`}
      >
        {negative && value > 0 ? "-" : ""}
        {money(value)}
      </span>
    </div>
  );
}
