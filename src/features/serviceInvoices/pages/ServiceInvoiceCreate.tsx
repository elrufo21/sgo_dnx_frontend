import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { Download, RefreshCw, Send, Trash2 } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { useForm, useWatch } from "react-hook-form";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { generateTicketQrBase64 } from "@/components/ticketQr";
import { ServiceInvoicePdfDocument } from "@/features/serviceInvoices/components/ServiceInvoicePdf";
import { buildDebitNoteQrData } from "@/features/serviceInvoices/components/debitNotePdfHelpers";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormAutocomplete } from "@/components/forms/HookFormAutocomplete";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { toast } from "@/shared/ui/toast";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import { numberToWords } from "@/shared/helpers/numberToWords";
import {
  IGV_FACTOR,
  roundCurrency,
  roundUnitValue,
} from "@/shared/helpers/saleMonetary";
import { useAuthStore } from "@/store/auth/auth.store";
import { useDialogStore } from "@/store/app/dialog.store";
import { useBillingConfigStore } from "@/store/configuration/billingConfig.store";
import { useClientsStore } from "@/store/customers/customers.store";
import {
  summarizeServiceInvoiceDetail,
  useServiceInvoicesStore,
} from "@/store/serviceInvoices/serviceInvoices.store";
import type {
  ServiceInvoiceCreditNotePayload,
  ServiceInvoiceDetailInput,
  ServiceInvoiceFormValues,
  ServiceInvoiceListItem,
  ServiceInvoicePayloadDetail,
  ServiceInvoiceSendPayload,
  ServiceProduct,
} from "@/types/serviceInvoice";
import DebitNotePdf from "../components/DebitNotePdf";

type ClientOption = {
  value: string;
  label: string;
  ruc: string;
  razon: string;
  direccion: string;
  email?: string;
};

type ServiceOption = {
  value: number;
  label: string;
  codigo: string;
  codigoSunat: string;
  precioConIgv: number;
  data: ServiceProduct;
};

type ServiceInvoiceTab = "form" | "voucher";

const DEFAULT_PROCESS_TYPE = 3 as const;
const SERVICE_OPERATION_CODE = "1001" as const;
const SERVICE_LINE_OPERATION_CODE = "10" as const;
const SERVICE_UNIT_MEASURE = "ZZ" as const;
const DETRACTION_ACCOUNT = "00054103689";
const DETRACTION_RATE = 0.1;

const resolveProcessTypeValue = (processType?: string | null) =>
  processType === "PRODUCCION" ? 1 : DEFAULT_PROCESS_TYPE;

const createDetailRow = (): ServiceInvoiceDetailInput => ({
  id: Math.random().toString(36).slice(2, 11),
  productId: null,
  cantidad: "1",
  precioSinImpuesto: "0",
  descripcion: "",
  codigo: "SERV001",
  codigoSunat: "80161701",
});

const safeText = (value: unknown, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const normalizeInvoiceEstado = (estado?: string) =>
  safeText(estado).toUpperCase();

const isAnnulledInvoice = (invoice?: ServiceInvoiceListItem | null) =>
  normalizeInvoiceEstado(invoice?.compra.estado) === "ANULADO";

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value: number) => Number(value.toFixed(2));

const formatReadonlyMoney = (value: unknown) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));

const resolveCurrencyLabel = (
  currency: ServiceInvoiceFormValues["codMoneda"],
) => (currency === "USD" ? "DOLARES" : "SOLES");

const resolveCompanyId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
};

const extractSerieFromComprobante = (value: unknown) => {
  const text = safeText(value).toUpperCase();
  const [serie = ""] = text.split("-");
  return /^[A-Z0-9]{4}$/.test(serie) ? serie : "";
};

const resolveAccepted = (response: unknown) => {
  if (!response || typeof response !== "object") return false;
  const record = response as Record<string, unknown>;
  const code = safeText(
    record.cod_sunat ?? record.codigoSunat ?? record.CodSunat,
  );
  const accepted = record.aceptado ?? record.accepted;
  const ok = record.ok === true || safeText(record.flg_rta) === "1";
  return ok || accepted === true || code === "0" || code === "0000";
};

const resolveResponseMessage = (response: unknown) => {
  if (!response || typeof response !== "object") return "";
  const record = response as Record<string, unknown>;
  const registro = (record.registro_bd ?? {}) as Record<string, unknown>;
  return safeText(
    record.msj_sunat ??
      record.mensaje ??
      record.message ??
      registro.mensaje ??
      registro.resultado,
  );
};

const resolveResponseRecord = (response: unknown) =>
  response && typeof response === "object"
    ? (response as Record<string, unknown>)
    : {};

const resolveResponseNumber = (
  response: unknown,
  ...keys: string[]
): number => {
  const record = resolveResponseRecord(response);
  const registro = resolveResponseRecord(record.registro_bd);

  for (const key of keys) {
    const parsed = Number(record[key] ?? registro[key]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return 0;
};

const normalizePdfFileName = (value: unknown) =>
  safeText(value, "factura-servicio")
    .replace(/[^\w.-]+/g, "_")
    .toLowerCase();

const normalizeQrDateISO = (value: unknown) => {
  const text = safeText(value);
  if (!text) return "";

  const normalized = text.replace("T", " ").split(" ")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;

  const [day, month, year] = normalized.split("/");
  if (day && month && year) return `${year}-${month}-${day}`;

  return "";
};

const buildServiceInvoiceQrData = (
  invoice: ServiceInvoiceListItem,
  company?: { ruc?: string } | null,
) => {
  const compra = invoice.compra;
  const subtotal =
    toNumber(compra.subTotal) ||
    Math.max(0, toNumber(compra.total) - toNumber(compra.igv));
  const igv =
    toNumber(compra.igv) || Math.max(0, toNumber(compra.total) - subtotal);
  const total = toNumber(compra.total) || subtotal + igv;
  const documentNumber = safeText(
    compra.nroComprobante,
    `${safeText(compra.serie, "FA01")}-${safeText(compra.numero, "00000000")}`,
  );
  const clientRuc = safeText(compra.clienteRuc, safeText(compra.clienteDni));

  return [
    safeText(company?.ruc, "15390049339"),
    "01",
    documentNumber,
    igv.toFixed(2),
    total.toFixed(2),
    normalizeQrDateISO(compra.fechaEmision),
    "06",
    clientRuc || "00000000000",
  ].join("|");
};

const downloadPdfDocument = async (
  pdfDocument: ReactElement,
  fileName: string,
) => {
  const blob = await renderPdfBlob(pdfDocument);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${normalizePdfFileName(fileName)}.pdf`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const renderPdfBlob = async (pdfDocument: ReactElement) => {
  const instance = pdf(pdfDocument as Parameters<typeof pdf>[0]);
  return instance.toBlob();
};

export default function ServiceInvoiceCreate() {
  const navigate = useNavigate();
  const { docuId } = useParams();
  const [createdDocuId, setCreatedDocuId] = useState<number | null>(null);
  const [focusPrecio, setFocusPrecio] = useState(false);
  const precioRef = useRef<HTMLInputElement>(null);
  const user = useAuthStore((state) => state.user);
  const openDialog = useDialogStore((state) => state.openDialog);
  const { config, fetchConfig } = useBillingConfigStore();
  const { clients, fetchClients, searchClients } = useClientsStore();
  const clientSearchTimerRef = useRef<number | null>(null);
  const {
    sendInvoice,
    sendCreditNote,
    fetchInvoiceById,
    fetchCorrelative,
    fetchServiceProducts,
    sending,
    correlativeLoading,
    serviceProducts,
    serviceProductsLoading,
  } = useServiceInvoicesStore();
  const [sendingEmail, setSendingEmail] = useState(false);
  const [details, setDetails] = useState<ServiceInvoiceDetailInput[]>([
    createDetailRow(),
  ]);
  const [viewInvoice, setViewInvoice] = useState<ServiceInvoiceListItem | null>(
    null,
  );
  const [serviceInvoiceQrBase64, setServiceInvoiceQrBase64] = useState("");
  const [debitNoteQrBase64, setDebitNoteQrBase64] = useState("");
  const [createdViewMode, setCreatedViewMode] = useState(false);
  const [activeTab, setActiveTab] = useState<ServiceInvoiceTab>("form");
  const [voucherPdfUrl, setVoucherPdfUrl] = useState("");
  const [voucherPdfLoading, setVoucherPdfLoading] = useState(false);
  const isViewMode = Boolean(docuId) || createdViewMode;
  const canEdit = !isViewMode;
  const viewLoading = isViewMode && !viewInvoice;

  const confirmWithAppDialog = useCallback(
    ({
      title,
      content,
      confirmText,
      cancelText = "Cancelar",
    }: {
      title: string;
      content: ReactNode;
      confirmText: string;
      cancelText?: string;
    }) =>
      new Promise<boolean>((resolve) => {
        openDialog({
          title,
          content,
          confirmText,
          cancelText,
          onConfirm: () => {
            resolve(true);
          },
          onCancel: () => {
            resolve(false);
          },
        });
      }),
    [openDialog],
  );

  useEffect(() => {
    void fetchClients("ACTIVO");
  }, [fetchClients]);

  const queueClientSearch = useCallback(
    (value: string) => {
      const term = safeText(value);
      if (clientSearchTimerRef.current) {
        window.clearTimeout(clientSearchTimerRef.current);
      }
      if (term.length < 2) return;
      clientSearchTimerRef.current = window.setTimeout(() => {
        void searchClients(term);
      }, 300);
    },
    [searchClients],
  );

  useEffect(
    () => () => {
      if (clientSearchTimerRef.current) {
        window.clearTimeout(clientSearchTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!config) void fetchConfig();
  }, [config, fetchConfig]);

  useEffect(() => {
    if (!canEdit) return;
    void fetchServiceProducts({ estado: "ACTIVO", page: 1, pageSize: 100 });
  }, [canEdit, fetchServiceProducts]);

  const clientOptions = useMemo<ClientOption[]>(
    () =>
      clients
        .filter((client) => safeText(client.ruc))
        .map((client) => ({
          value: client.nombreRazon,
          label: client.nombreRazon,
          ruc: client.ruc,
          razon: client.nombreRazon,
          direccion: client.direccionFiscal,
          email: client.email,
        })),
    [clients],
  );

  const rucOptions = useMemo<ClientOption[]>(
    () =>
      clients
        .filter((client) => safeText(client.ruc))
        .map((client) => ({
          value: client.ruc,
          label: client.ruc,
          ruc: client.ruc,
          razon: client.nombreRazon,
          direccion: client.direccionFiscal,
          email: client.email,
        })),
    [clients],
  );

  const serviceOptions = useMemo<ServiceOption[]>(
    () =>
      serviceProducts.map((service) => ({
        value: service.id,
        label: `${service.codigo ? `${service.codigo} - ` : ""}${service.nombre}`,
        codigo: service.codigo,
        codigoSunat: service.codigoSunat || "80161701",
        precioConIgv: service.venta,
        data: service,
      })),
    [serviceProducts],
  );

  const methods = useForm<ServiceInvoiceFormValues>({
    defaultValues: {
      nroComprobante: "",
      fechaDocumento: getLocalDateISO(),
      fechaVto: getLocalDateISO(),
      codMoneda: "PEN",
      formaPago: "Contado",
      nroDocumentoCliente: "",
      razonSocialCliente: "",
      direccionCliente: "",
      clienteCorreo: "",
    },
  });

  const { control, setValue } = methods;
  const nroComprobante = useWatch({ control, name: "nroComprobante" }) ?? "";
  const formaPago = useWatch({ control, name: "formaPago" });
  const fechaDocumento = useWatch({ control, name: "fechaDocumento" });
  const getCreditDueDate = (baseDate: string) => {
    const [year, month] = baseDate.split("-");

    return `${year}-${month}-24`;
  };

  useEffect(() => {
    if (!canEdit || !fechaDocumento) return;

    if (formaPago === "Contado") {
      setValue("fechaVto", fechaDocumento, { shouldDirty: true });

      setValue("nroDocumentoCliente", "", { shouldDirty: true });
      setValue("razonSocialCliente", "", { shouldDirty: true });
      setValue("direccionCliente", "", { shouldDirty: true });

      setDetails([createDetailRow()]);
      return;
    }

    if (formaPago === "Credito") {
      setValue("fechaVto", getCreditDueDate(fechaDocumento), {
        shouldDirty: true,
      });

      const cliente = clientOptions.find((c) => c.ruc === "20522109178");

      if (cliente) {
        setValue("razonSocialCliente", cliente.value, {
          shouldDirty: true,
          shouldValidate: true,
        });

        setValue("nroDocumentoCliente", cliente.ruc, {
          shouldDirty: true,
          shouldValidate: true,
        });

        setValue("direccionCliente", cliente.direccion, {
          shouldDirty: true,
          shouldValidate: true,
        });

        setValue("clienteCorreo", safeText(cliente.email), {
          shouldDirty: true,
          shouldValidate: true,
        });
      }

      const servicio = serviceProducts.find((s) => s.id === 97);

      if (servicio) {
        setDetails([
          {
            id: Math.random().toString(36).slice(2, 11),
            productId: servicio.id,
            cantidad: "1",
            precioSinImpuesto: "",
            descripcion: servicio.nombre.toUpperCase(),
            codigo: servicio.codigo,
            codigoSunat: servicio.codigoSunat || "80161701",
          },
        ]);
        setFocusPrecio(true);
      }
    }
  }, [
    formaPago,
    fechaDocumento,
    canEdit,
    clientOptions,
    serviceProducts,
    setValue,
  ]);
  useEffect(() => {
    if (!focusPrecio) return;

    requestAnimationFrame(() => {
      precioRef.current?.focus();
      precioRef.current?.select();
      setFocusPrecio(false);
    });
  }, [focusPrecio, details]);

  const loadCorrelative = useCallback(
    async (serie?: string, notifyOnFail = true) => {
      const correlative = await fetchCorrelative(
        resolveCompanyId(user?.companyId),
        serie,
      );

      if (!correlative?.nroComprobante) {
        if (notifyOnFail) {
          toast.error("No se pudo obtener el correlativo de factura.");
        }
        return;
      }

      setValue("nroComprobante", correlative.nroComprobante.toUpperCase(), {
        shouldDirty: true,
      });
    },
    [fetchCorrelative, setValue, user?.companyId],
  );

  useEffect(() => {
    if (!canEdit) return;
    void loadCorrelative(undefined, false);
  }, [canEdit, loadCorrelative]);

  const applyViewInvoice = useCallback(
    (invoice: ServiceInvoiceListItem, parsedDocuId: number) => {
      const compra = invoice.compra;
      setViewInvoice(invoice);
      setValue("nroComprobante", safeText(compra.nroComprobante), {
        shouldDirty: false,
      });
      setValue("fechaDocumento", safeText(compra.fechaEmision), {
        shouldDirty: false,
      });
      setValue(
        "fechaVto",
        safeText(
          compra.fechaVencimiento,
          safeText(compra.fechaVto, compra.fechaEmision),
        ),
        {
          shouldDirty: false,
        },
      );
      setValue(
        "formaPago",
        safeText(compra.formaPago, "Credito") === "Contado"
          ? "Contado"
          : "Credito",
        { shouldDirty: false },
      );
      setValue("codMoneda", "PEN", { shouldDirty: false });
      setValue("nroDocumentoCliente", safeText(compra.clienteRuc), {
        shouldDirty: false,
      });
      setValue("razonSocialCliente", safeText(compra.clienteRazon), {
        shouldDirty: false,
      });
      setValue("direccionCliente", safeText(compra.direccionFiscal), {
        shouldDirty: false,
      });

      const mappedDetails = invoice.detalles.map((detail, index) => ({
        id: `view-${detail.detalleCompraId || index}`,
        productId: detail.productId ?? null,
        cantidad: String(detail.detalleCant || 1),
        precioSinImpuesto: String(money(toNumber(detail.detallePrecio))),
        descripcion: safeText(
          detail.detalleDesc,
          safeText(compra.compraConcepto, "FACTURA DE SERVICIO"),
        ),
        codigo: safeText(detail.codigoProducto, "SERV001"),
        codigoSunat: safeText(detail.codigoSunat, "80161701"),
      }));

      setDetails(
        mappedDetails.length
          ? mappedDetails
          : [
              {
                id: `view-${compra.compraId || parsedDocuId}`,
                productId: null,
                cantidad: "1",
                precioSinImpuesto: String(money(toNumber(compra.total))),
                descripcion: safeText(
                  compra.compraConcepto,
                  "FACTURA DE SERVICIO",
                ),
                codigo: "SERV001",
                codigoSunat: "80161701",
              },
            ],
      );
    },
    [setValue],
  );

  useEffect(() => {
    if (!isViewMode) return;

    const parsedDocuId = Number(docuId ?? createdDocuId);
    if (!Number.isFinite(parsedDocuId) || parsedDocuId <= 0) {
      toast.error("Factura de servicio no valida.");
      navigate("/service-invoices");
      return;
    }

    let cancelled = false;
    void fetchInvoiceById(parsedDocuId).then((invoice) => {
      if (cancelled) return;

      if (!invoice) {
        toast.error("No se pudo cargar la factura de servicio.");
        navigate("/service-invoices");
        return;
      }

      applyViewInvoice(invoice, parsedDocuId);
    });

    return () => {
      cancelled = true;
    };
  }, [
    applyViewInvoice,
    createdDocuId,
    docuId,
    fetchInvoiceById,
    isViewMode,
    navigate,
  ]);
  useEffect(() => {
    if (!viewInvoice) return;

    const rucCliente = safeText(viewInvoice.compra.clienteRuc);

    const cliente = clients.find((c) => safeText(c.ruc) === rucCliente);

    setValue("clienteCorreo", safeText(cliente?.email), {
      shouldDirty: false,
    });
  }, [viewInvoice, clients, setValue]);
  const detailPayload = useMemo<ServiceInvoicePayloadDetail[]>(() => {
    const validDetails = details.filter(
      (item) =>
        toNumber(item.cantidad) > 0 &&
        toNumber(item.precioSinImpuesto) > 0 &&
        safeText(item.descripcion),
    );

    return validDetails.map((item, index) => {
      const cantidad = toNumber(item.cantidad);
      const precioConIgv = toNumber(item.precioSinImpuesto);
      const totalLinea = roundCurrency(cantidad * precioConIgv);
      const subTotal = roundCurrency(totalLinea / IGV_FACTOR);
      const igv = roundCurrency(totalLinea - subTotal);
      const precioSinImpuesto =
        cantidad > 0 ? roundUnitValue(subTotal / cantidad) : 0;

      return {
        item: index + 1,
        unidadMedida: SERVICE_UNIT_MEASURE,
        cantidad,
        precio: roundCurrency(precioConIgv),
        importe: subTotal,
        igv,
        precioSinImpuesto,
        codTipoOperacion: SERVICE_LINE_OPERATION_CODE,
        codigo: safeText(item.codigo, "SERV001").toUpperCase(),
        codigoSunat: safeText(item.codigoSunat, "80161701"),
        descripcion: safeText(item.descripcion).toUpperCase(),
      };
    });
  }, [details]);

  const totals = useMemo(
    () => summarizeServiceInvoiceDetail(detailPayload),
    [detailPayload],
  );
  const montoDetraccion = useMemo(
    () => Math.round(totals.total * DETRACTION_RATE),
    [totals.total],
  );
  const viewCompra = viewInvoice?.compra;
  const isAnnulled = isAnnulledInvoice(viewInvoice);
  const canUseDocumentActions =
    isViewMode && Boolean(viewInvoice) && !isAnnulled;
  const canShowVoucher = isViewMode && Boolean(viewInvoice);
  const invoicePdfCompany = useMemo(
    () => ({
      name: user?.companyName,
      commercialName: user?.companyCommercialName,
      ruc: user?.companyRuc,
      address: user?.companySunatAddress,
      phone: user?.companyPhone,
    }),
    [
      user?.companyCommercialName,
      user?.companyName,
      user?.companyPhone,
      user?.companyRuc,
      user?.companySunatAddress,
    ],
  );
  useEffect(() => {
    if (!isViewMode || !viewInvoice) {
      setServiceInvoiceQrBase64("");
      setDebitNoteQrBase64("");
      return;
    }

    let active = true;
    setServiceInvoiceQrBase64("");
    setDebitNoteQrBase64("");

    const isAnnulledDocument = isAnnulledInvoice(viewInvoice);
    const qrData = isAnnulledDocument
      ? buildDebitNoteQrData(viewInvoice, invoicePdfCompany)
      : buildServiceInvoiceQrData(viewInvoice, invoicePdfCompany);

    generateTicketQrBase64(qrData).then((qrBase64) => {
      if (!active) return;
      if (isAnnulledDocument) {
        setDebitNoteQrBase64(qrBase64);
        return;
      }

      setServiceInvoiceQrBase64(qrBase64);
    });

    return () => {
      active = false;
    };
  }, [invoicePdfCompany, isViewMode, viewInvoice]);
  const handleSendEmail = async () => {
    if (!viewInvoice || sendingEmail) return;

    if (isAnnulledInvoice(viewInvoice)) {
      toast.error("La factura está anulada. No se puede enviar por correo.");
      return;
    }

    setSendingEmail(true);

    try {
      const qrBase64 =
        serviceInvoiceQrBase64 ||
        (await generateTicketQrBase64(
          buildServiceInvoiceQrData(viewInvoice, invoicePdfCompany),
        ));
      const pdfDocument = ServiceInvoicePdfDocument({
        invoice: viewInvoice,
        company: invoicePdfCompany,
        preGeneratedQrBase64: qrBase64,
      });
      const blob = await renderPdfBlob(pdfDocument);

      const pdfFile = new File(
        [blob],
        `${viewInvoice.compra.nroComprobante}.pdf`,
        {
          type: "application/pdf",
        },
      );

      const form = new FormData();

      const correoCliente = methods.getValues("clienteCorreo");

      if (!correoCliente) {
        toast.error("El cliente no tiene correo registrado.");
        return;
      }

      form.append("para", correoCliente);
      form.append("asunto", `Factura ${viewInvoice.compra.nroComprobante}`);

      form.append("cuerpo", "<p>Adjuntamos su comprobante electrónico.</p>");

      form.append("esHtml", "true");

      form.append("pdf", pdfFile);
      form.append("rucEmisor", invoicePdfCompany.ruc || "15390049339");
      form.append("nroComprobante", viewInvoice.compra.numero);

      if (viewInvoice.compra.xmlUrl)
        form.append("xmlUrl", viewInvoice.compra.xmlUrl);

      if (viewInvoice.compra.cdrUrl)
        form.append("cdrUrl", viewInvoice.compra.cdrUrl);
      //"https://www.api-sgo.somee.com/api/v1/Correo/enviar-comprobante"
      const response = await fetch(
        "https://www.api-sgo.somee.com/api/v1/Correo/enviar-comprobante",
        {
          method: "POST",
          body: form,
        },
      );

      if (!response.ok) {
        throw new Error("Error enviando correo");
      }

      toast.success("Correo enviado correctamente");
    } catch (error) {
      console.error(error);
      toast.error("No se pudo enviar el correo");
    } finally {
      setSendingEmail(false);
    }
  };
  const buildVoucherPdfDocument = useCallback(async () => {
    if (!viewInvoice) return null;

    if (isAnnulledInvoice(viewInvoice)) {
      const qrBase64 =
        debitNoteQrBase64 ||
        (await generateTicketQrBase64(
          buildDebitNoteQrData(viewInvoice, invoicePdfCompany),
        ));

      return (
        <DebitNotePdf
          invoice={viewInvoice}
          company={invoicePdfCompany}
          preGeneratedQrBase64={qrBase64}
        />
      );
    }

    const qrBase64 =
      serviceInvoiceQrBase64 ||
      (await generateTicketQrBase64(
        buildServiceInvoiceQrData(viewInvoice, invoicePdfCompany),
      ));

    return ServiceInvoicePdfDocument({
      invoice: viewInvoice,
      company: invoicePdfCompany,
      preGeneratedQrBase64: qrBase64,
    });
  }, [
    debitNoteQrBase64,
    invoicePdfCompany,
    serviceInvoiceQrBase64,
    viewInvoice,
  ]);

  useEffect(() => {
    if (!canShowVoucher && activeTab === "voucher") {
      setActiveTab("form");
    }
  }, [activeTab, canShowVoucher]);

  useEffect(() => {
    if (!canShowVoucher) {
      setVoucherPdfUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return "";
      });
      setVoucherPdfLoading(false);
      return;
    }

    let active = true;
    let objectUrl = "";

    setVoucherPdfLoading(true);
    setVoucherPdfUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });

    void buildVoucherPdfDocument()
      .then((document) => (document ? renderPdfBlob(document) : null))
      .then((blob) => {
        if (!active || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setVoucherPdfUrl(objectUrl);
      })
      .catch((error) => {
        console.error("No se pudo generar el comprobante", error);
        if (active) setVoucherPdfUrl("");
      })
      .finally(() => {
        if (active) setVoucherPdfLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [buildVoucherPdfDocument, canShowVoucher]);

  const processTypeValue = useMemo(
    () => resolveProcessTypeValue(config?.processType),
    [config?.processType],
  );

  const updateDetail = useCallback(
    (id: string, patch: Partial<ServiceInvoiceDetailInput>) => {
      setDetails((current) =>
        current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
      );
    },
    [],
  );

  const selectService = useCallback(
    (rowId: string, option: ServiceOption | null) => {
      if (!option) {
        updateDetail(rowId, { productId: null });
        return;
      }

      updateDetail(rowId, {
        productId: option.value,
        codigo: option.codigo || "SERV001",
        codigoSunat: option.codigoSunat || "80161701",
        descripcion: option.data.nombre.toUpperCase(),
        precioSinImpuesto: String(money(option.precioConIgv)),
      });
    },
    [updateDetail],
  );

  const removeDetail = useCallback((id: string) => {
    setDetails((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== id),
    );
  }, []);

  const buildPayload = useCallback(
    (values: ServiceInvoiceFormValues): ServiceInvoiceSendPayload => {
      const razonSocial = safeText(
        user?.companyName,
        safeText(user?.companyCommercialName, "TU RAZON SOCIAL"),
      );
      const nombreComercial = safeText(
        user?.companyCommercialName,
        razonSocial,
      );
      const ubigeoName = safeText(user?.companyUbigeoName, "LIMA");
      const currencyLabel = resolveCurrencyLabel(values.codMoneda);

      return {
        TIPO_PROCESO: processTypeValue,
        TIPO_OPERACION: SERVICE_OPERATION_CODE,
        NRO_COMPROBANTE: safeText(values.nroComprobante).toUpperCase(),
        FECHA_DOCUMENTO: values.fechaDocumento,
        FECHA_VTO: values.fechaVto,
        COD_MONEDA: values.codMoneda,
        FORMA_PAGO: values.formaPago,
        NRO_DOCUMENTO_EMPRESA: safeText(user?.companyRuc, "10464869978"),
        TIPO_DOCUMENTO_EMPRESA: "6",
        RAZON_SOCIAL_EMPRESA: razonSocial,
        NOMBRE_COMERCIAL_EMPRESA: nombreComercial,
        CODIGO_UBIGEO_EMPRESA: "150101",
        DIRECCION_EMPRESA: safeText(
          user?.companySunatAddress,
          "DIRECCION DE LA EMPRESA",
        ),
        DEPARTAMENTO_EMPRESA: ubigeoName,
        PROVINCIA_EMPRESA: ubigeoName,
        DISTRITO_EMPRESA: ubigeoName,
        CODIGO_PAIS_EMPRESA: "PE",
        CODIGO_ANEXO: "0000",
        USUARIO_SOL_EMPRESA: safeText(
          config?.solUser,
          safeText(user?.usuarioSol, "USUARIO_BETA"),
        ),
        PASS_SOL_EMPRESA: safeText(
          config?.solPassword,
          safeText(user?.claveSol, "CLAVE_BETA"),
        ),
        CONTRA_FIRMA: safeText(
          config?.certificatePassword,
          safeText(user?.claveCertificado, "CLAVE_CERTIFICADO"),
        ),
        RUTA_PFX: safeText(
          config?.certificateBase64,
          safeText(user?.certificadoBase64, "C:\\ruta\\certificado.pfx"),
        ),
        NRO_DOCUMENTO_CLIENTE: safeText(values.nroDocumentoCliente),
        TIPO_DOCUMENTO_CLIENTE: "6",
        RAZON_SOCIAL_CLIENTE: safeText(values.razonSocialCliente).toUpperCase(),
        DIRECCION_CLIENTE: safeText(
          values.direccionCliente,
          "DIRECCION DEL CLIENTE",
        ),
        COD_PAIS_CLIENTE: "PE",
        TOTAL_GRAVADAS: totals.subTotal,
        SUB_TOTAL: totals.subTotal,
        POR_IGV: 18,
        TOTAL_IGV: totals.igv,
        TOTAL_DESCUENTO: 0,
        TOTAL: totals.total,
        TOTAL_LETRAS: numberToWords(totals.total, currencyLabel),
        CUENTA_DETRACCION: DETRACTION_ACCOUNT,
        MONTO_DETRACCION: montoDetraccion,
        detalle: detailPayload,
      };
    },
    [config, detailPayload, montoDetraccion, processTypeValue, totals, user],
  );

  const resolveRecordDocuId = useCallback((): number => {
    const fromParams = Number(docuId);
    if (Number.isFinite(fromParams) && fromParams > 0) return fromParams;

    if (createdDocuId && createdDocuId > 0) return createdDocuId;

    const compraId = viewInvoice?.compra.compraId ?? 0;
    return Number.isFinite(compraId) && compraId > 0 ? compraId : 0;
  }, [createdDocuId, docuId, viewInvoice?.compra.compraId]);

  const buildCreditNotePayload = useCallback(
    (values: ServiceInvoiceFormValues): ServiceInvoiceCreditNotePayload => {
      const razonSocial = safeText(
        user?.companyName,
        safeText(user?.companyCommercialName, "TU RAZON SOCIAL"),
      );
      const ubigeoName = safeText(user?.companyUbigeoName, "LIMA");
      const currencyLabel = resolveCurrencyLabel(values.codMoneda);
      const documentoModifica = safeText(
        viewInvoice?.compra.nroComprobante,
        safeText(values.nroComprobante, "FA01-00000000"),
      );

      return {
        DOCU_ID: resolveRecordDocuId(),
        COD_TIPO_DOCUMENTO: "07",
        TIPO_PROCESO: processTypeValue,
        NRO_DOCUMENTO_EMPRESA: safeText(user?.companyRuc, "10464869978"),
        TIPO_DOCUMENTO_EMPRESA: "6",
        RAZON_SOCIAL_EMPRESA: razonSocial,
        CODIGO_UBIGEO_EMPRESA: "150101",
        DIRECCION_EMPRESA: safeText(
          user?.companySunatAddress,
          "DIRECCION DE LA EMPRESA",
        ),
        DEPARTAMENTO_EMPRESA: ubigeoName,
        PROVINCIA_EMPRESA: ubigeoName,
        DISTRITO_EMPRESA: ubigeoName,
        CODIGO_PAIS_EMPRESA: "PE",
        NRO_COMPROBANTE: "",
        FECHA_DOCUMENTO: values.fechaDocumento,
        COD_MONEDA: values.codMoneda,
        USUARIO_SOL_EMPRESA: safeText(
          config?.solUser,
          safeText(user?.usuarioSol, "USUARIO_BETA"),
        ),
        PASS_SOL_EMPRESA: safeText(
          config?.solPassword,
          safeText(user?.claveSol, "CLAVE_BETA"),
        ),
        CONTRA_FIRMA: safeText(
          config?.certificatePassword,
          safeText(user?.claveCertificado, "CLAVE_CERTIFICADO"),
        ),
        RUTA_PFX: safeText(
          config?.certificateBase64,
          safeText(user?.certificadoBase64, "C:\\ruta\\certificado.pfx"),
        ),
        NRO_DOCUMENTO_CLIENTE: safeText(values.nroDocumentoCliente),
        TIPO_DOCUMENTO_CLIENTE: "6",
        RAZON_SOCIAL_CLIENTE: safeText(values.razonSocialCliente).toUpperCase(),
        COD_UBIGEO_CLIENTE: "150101",
        DIRECCION_CLIENTE: safeText(
          values.direccionCliente,
          "DIRECCION DEL CLIENTE",
        ),
        DEPARTAMENTO_CLIENTE: ubigeoName,
        PROVINCIA_CLIENTE: ubigeoName,
        DISTRITO_CLIENTE: ubigeoName,
        COD_PAIS_CLIENTE: "PE",
        TIPO_COMPROBANTE_MODIFICA: "01",
        DOCU_CONDICION: "SERVICIO",

        NRO_DOCUMENTO_MODIFICA: documentoModifica,
        COD_TIPO_MOTIVO: "01",
        DESCRIPCION_MOTIVO: "ANULACION DE LA OPERACION",
        SUB_TOTAL: totals.subTotal,
        TOTAL_GRAVADAS: totals.subTotal,
        TOTAL_IGV: totals.igv,
        TOTAL_DESCUENTO: 0,
        POR_IGV: 18,
        TOTAL: totals.total,
        TOTAL_LETRAS: numberToWords(totals.total, currencyLabel),
        detalle: detailPayload.map((detail, index) => ({
          item: index + 1,
          cantidad: detail.cantidad,
          importe: detail.importe,
          precio: detail.precio,
          descripcion: detail.descripcion,
          codTipoOperacion: detail.codTipoOperacion,
          codigo: detail.codigo,
        })),
      };
    },
    [
      config,
      detailPayload,
      processTypeValue,
      resolveRecordDocuId,
      totals,
      user,
      viewInvoice,
    ],
  );

  const handleCreateCreditNote = useCallback(async () => {
    if (!viewInvoice) return;

    if (isAnnulledInvoice(viewInvoice)) {
      toast.error(
        "La factura ya está anulada. No se puede crear otra nota de crédito.",
      );
      return;
    }

    const recordDocuId = resolveRecordDocuId();
    if (!recordDocuId) {
      toast.error("No se encontró el ID del documento a anular.");
      return;
    }

    const confirmed = await confirmWithAppDialog({
      title: "Anular factura",
      content: <p>¿Está seguro que desea anular la factura?</p>,
      confirmText: "Anular",
    });
    if (!confirmed) return;

    const values = methods.getValues();
    const payload = buildCreditNotePayload(values);

    try {
      const response = await sendCreditNote(payload);
      const message = resolveResponseMessage(response);
      const accepted = resolveAccepted(response);

      if (!accepted) {
        toast.warning(
          message ||
            "La nota de crédito fue enviada; revisa la respuesta del OSE.",
        );
        return;
      }

      const responseRecord = resolveResponseRecord(response);
      const registroBd = resolveResponseRecord(responseRecord.registro_bd);
      const registroBdOk = responseRecord.registro_bd_ok === true;

      if (!registroBdOk) {
        toast.warning(
          safeText(
            registroBd.mensaje,
            "La nota de crédito fue aceptada por SUNAT, pero no se registró en la base de datos.",
          ),
        );
        return;
      }

      const invoiceUpdated = await fetchInvoiceById(recordDocuId);
      if (!invoiceUpdated) {
        toast.warning(
          "La nota de crédito se registró, pero no se pudo actualizar la vista.",
        );
        return;
      }

      applyViewInvoice(invoiceUpdated, recordDocuId);
      toast.success(message || "Nota de crédito enviada y aceptada.");
    } catch (error) {
      console.error("No se pudo enviar la nota de crédito", error);
      toast.error("No se pudo enviar la nota de crédito.");
    }
  }, [
    applyViewInvoice,
    buildCreditNotePayload,
    confirmWithAppDialog,
    fetchInvoiceById,
    methods,
    resolveRecordDocuId,
    sendCreditNote,
    viewInvoice,
  ]);

  const onSubmit = async (values: ServiceInvoiceFormValues) => {
    if (!canEdit) return;

    if (!/^[A-Za-z0-9]{4}-\d{1,8}$/.test(values.nroComprobante.trim())) {
      toast.error("El comprobante debe tener formato FA02-00000468.");
      return;
    }

    if (!/^\d{11}$/.test(values.nroDocumentoCliente.trim())) {
      toast.error("El RUC del cliente debe tener 11 digitos.");
      return;
    }

    if (!detailPayload.length) {
      toast.error(
        "Agrega al menos un servicio con cantidad, precio y descripcion.",
      );
      return;
    }

    try {
      const response = await sendInvoice(buildPayload(values));
      const message = resolveResponseMessage(response);
      const accepted = resolveAccepted(response);

      if (!accepted) {
        toast.warning(
          message || "Factura enviada; revisa la respuesta del OSE.",
        );
        return;
      }

      toast.success(message || "Factura de servicio enviada y aceptada.");

      const docuIdCreado = resolveResponseNumber(
        response,
        "docu_id",
        "docuId",
        "DocuId",
      );

      if (!docuIdCreado) {
        toast.error("La factura se creó, pero no se pudo obtener el ID.");
        return;
      }

      const invoiceCreated = await fetchInvoiceById(docuIdCreado);

      if (!invoiceCreated) {
        toast.error("La factura se creó, pero no se pudo cargar el registro.");
        return;
      }

      setViewInvoice(invoiceCreated);
      setCreatedDocuId(docuIdCreado);
      setCreatedViewMode(true);
      setActiveTab("voucher");

      window.history.replaceState(
        null,
        "",
        `/service-invoices/${docuIdCreado}`,
      );
    } catch (error) {
      console.error("No se pudo enviar la factura de servicio", error);
      toast.error("No se pudo enviar la factura de servicio.");
    }
  };

  const handleDownloadPdf = useCallback(async () => {
    if (!viewInvoice) return;

    const document = await buildVoucherPdfDocument();
    if (!document) {
      toast.error("No se pudo generar el comprobante.");
      return;
    }

    await downloadPdfDocument(
      document,
      isAnnulledInvoice(viewInvoice)
        ? safeText(
            viewCompra?.anuladoPorNroComprobante,
            safeText(viewCompra?.nroComprobante, "nota-credito"),
          )
        : safeText(viewCompra?.nroComprobante, "factura-servicio"),
    );
  }, [buildVoucherPdfDocument, viewCompra, viewInvoice]);
  console.log("viewInvoice", viewInvoice);
  return (
    <div className="space-y-4 p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackArrowButton fallbackTo="/service-invoices" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              {canEdit ? "Factura de servicio" : "Ver factura de servicio"}
            </h1>
            <p className="text-sm text-slate-500">
              {canEdit
                ? `Proceso ${processTypeValue} · operacion ${SERVICE_OPERATION_CODE} · servicio`
                : viewLoading
                  ? "Cargando factura de servicio"
                  : isAnnulled
                    ? "Factura anulada"
                    : safeText(
                        viewCompra?.nroComprobante,
                        "Consulta bloqueada",
                      )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/service-invoices")}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Volver
        </button>
      </div>

      {isAnnulled ? (
        <div
          role="status"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <p className="font-semibold">Factura anulada</p>
          <p className="mt-1 text-red-700">
            Este documento fue anulado con nota de crédito.
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("form")}
          className={`border-b-2 px-4 py-2 text-sm font-semibold ${
            activeTab === "form"
              ? "border-[#B23636] text-[#B23636]"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Formulario
        </button>
        {canShowVoucher ? (
          <button
            type="button"
            onClick={() => setActiveTab("voucher")}
            className={`border-b-2 px-4 py-2 text-sm font-semibold ${
              activeTab === "voucher"
                ? "border-[#B23636] text-[#B23636]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Comprobante
          </button>
        ) : null}
      </div>

      {activeTab === "voucher" && canShowVoucher ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                {isAnnulled ? "Nota de credito" : "Factura de servicio"}
              </h2>
              <p className="text-sm text-slate-500">
                {safeText(viewCompra?.nroComprobante, "Comprobante")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={voucherPdfLoading || !voucherPdfUrl}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download className="h-4 w-4" />
              Descargar PDF
            </button>
          </div>

          {voucherPdfUrl ? (
            <iframe
              key={voucherPdfUrl}
              title="Comprobante"
              src={`${voucherPdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
              className="h-[calc(100vh-14rem)] min-h-[36rem] w-full rounded-lg border border-slate-200 bg-white"
            />
          ) : (
            <div className="flex h-[36rem] items-center justify-center rounded-lg border border-slate-200 bg-white text-sm text-slate-500">
              {voucherPdfLoading
                ? "Generando comprobante..."
                : "No se pudo generar el comprobante."}
            </div>
          )}
        </section>
      ) : (
        <HookForm methods={methods} onSubmit={onSubmit}>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
            <div className="space-y-4">
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <HookFormSelect<ServiceInvoiceFormValues>
                    name="formaPago"
                    label="Forma pago"
                    options={[
                      { value: "Credito", label: "Credito" },
                      { value: "Contado", label: "Contado" },
                    ]}
                    disabled={!canEdit}
                  />
                  <HookFormInput<ServiceInvoiceFormValues>
                    name="nroComprobante"
                    label="Comprobante"
                    placeholder="F001-00000013"
                    rules={{ required: "El comprobante es obligatorio" }}
                    disabled
                    endAdornment={
                      canEdit ? (
                        <button
                          type="button"
                          onClick={() =>
                            void loadCorrelative(
                              extractSerieFromComprobante(nroComprobante),
                            )
                          }
                          disabled={correlativeLoading}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Obtener correlativo"
                          aria-label="Obtener correlativo"
                        >
                          <RefreshCw
                            className={`h-4 w-4 ${
                              correlativeLoading ? "animate-spin" : ""
                            }`}
                          />
                        </button>
                      ) : null
                    }
                  />
                  <HookFormInput<ServiceInvoiceFormValues>
                    name="fechaDocumento"
                    label="Fecha emision"
                    type="date"
                    rules={{ required: "La fecha es obligatoria" }}
                    disabled={!canEdit}
                  />
                  <HookFormInput<ServiceInvoiceFormValues>
                    name="fechaVto"
                    label="Fecha vcto"
                    type="date"
                    rules={{
                      required: "La fecha de vencimiento es obligatoria",
                    }}
                    disabled
                  />
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <HookFormAutocomplete<ServiceInvoiceFormValues, ClientOption>
                    name="razonSocialCliente"
                    label="Cliente"
                    options={clientOptions}
                    placeholder="Razon social"
                    syncInputToValue
                    onInputValueChange={queueClientSearch}
                    disabled={!canEdit}
                    rules={{ required: "La razon social es obligatoria" }}
                    onOptionSelected={(option) => {
                      if (!option) return;

                      setValue("nroDocumentoCliente", option.ruc, {
                        shouldDirty: true,
                      });
                      setValue("direccionCliente", option.direccion, {
                        shouldDirty: true,
                      });
                      setValue("clienteCorreo", safeText(option.email), {
                        shouldDirty: true,
                      });
                    }}
                  />
                  <HookFormAutocomplete<ServiceInvoiceFormValues, ClientOption>
                    name="nroDocumentoCliente"
                    label="RUC cliente"
                    options={rucOptions}
                    placeholder="20522109178"
                    syncInputToValue
                    onInputValueChange={queueClientSearch}
                    disabled={!canEdit}
                    rules={{ required: "El RUC es obligatorio" }}
                    onOptionSelected={(option) => {
                      if (!option) return;
                      setValue("razonSocialCliente", option.razon, {
                        shouldDirty: true,
                      });
                      setValue("direccionCliente", option.direccion, {
                        shouldDirty: true,
                      });
                      setValue("clienteCorreo", safeText(option.email), {
                        shouldDirty: true,
                      });
                    }}
                  />
                  <div className="md:col-span-1">
                    <HookFormInput<ServiceInvoiceFormValues>
                      name="direccionCliente"
                      label="Direccion cliente"
                      rules={{ required: "La direccion es obligatoria" }}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="md:col-span-1">
                    <HookFormInput<ServiceInvoiceFormValues>
                      name="clienteCorreo"
                      label="Correo cliente"
                      disabled
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                    Servicios
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[64rem] border-collapse">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Servicio</th>
                        <th className="w-24 px-3 py-2 text-right font-semibold">
                          Cant.
                        </th>
                        <th className="w-32 px-3 py-2 text-right font-semibold">
                          Precio
                        </th>
                        <th className="w-32 px-3 py-2 text-right font-semibold">
                          Total
                        </th>
                        <th className="w-16 px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {details.map((row, index) => {
                        const cantidad = toNumber(row.cantidad);
                        const precioConIgv = toNumber(row.precioSinImpuesto);
                        const total = roundCurrency(cantidad * precioConIgv);

                        return (
                          <tr
                            key={row.id}
                            className="border-t border-slate-200"
                          >
                            <td className="px-3 py-2">
                              <Autocomplete<ServiceOption, false, false, true>
                                freeSolo
                                disabled={!canEdit}
                                size="small"
                                loading={serviceProductsLoading}
                                options={serviceOptions}
                                value={
                                  serviceOptions.find(
                                    (option) => option.value === row.productId,
                                  ) ?? null
                                }
                                inputValue={row.descripcion}
                                getOptionLabel={(option) =>
                                  typeof option === "string"
                                    ? option
                                    : option.label
                                }
                                isOptionEqualToValue={(option, value) =>
                                  option.value === value.value
                                }
                                onChange={(_, option) => {
                                  if (typeof option === "string") {
                                    updateDetail(row.id, {
                                      productId: null,
                                      descripcion: option.toUpperCase(),
                                    });
                                    return;
                                  }
                                  selectService(row.id, option);
                                }}
                                onInputChange={(_, value, reason) => {
                                  if (reason === "reset") return;
                                  updateDetail(row.id, {
                                    productId: null,
                                    descripcion: value.toUpperCase(),
                                  });
                                }}
                                renderInput={(params) => (
                                  <TextField
                                    {...params}
                                    placeholder={
                                      serviceProductsLoading
                                        ? "Cargando servicios..."
                                        : "Seleccionar servicio"
                                    }
                                    size="small"
                                    sx={{
                                      "& .MuiOutlinedInput-root": {
                                        borderRadius: "0.45rem",
                                        backgroundColor: "#fff",
                                        "& fieldset": {
                                          borderColor: "#cbd5e1",
                                        },
                                        "&.Mui-focused fieldset": {
                                          borderColor: "#B23636",
                                          boxShadow:
                                            "0 0 0 2px rgba(178,54,54,0.18)",
                                        },
                                      },
                                      "& .MuiOutlinedInput-input": {
                                        fontSize: "0.875rem",
                                        py: 0.75,
                                      },
                                    }}
                                  />
                                )}
                              />
                            </td>

                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.cantidad}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  updateDetail(row.id, {
                                    cantidad: event.target.value,
                                  })
                                }
                                className="h-9 w-full rounded-md border border-slate-300 px-2 text-right text-sm outline-none focus:border-[#B23636] focus:ring-2 focus:ring-[#B23636]/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>

                            <td className="px-3 py-2">
                              <input
                                type="number"
                                ref={index === 0 ? precioRef : undefined}
                                min="0"
                                step="0.01"
                                value={row.precioSinImpuesto}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  updateDetail(row.id, {
                                    precioSinImpuesto: event.target.value,
                                  })
                                }
                                className="h-9 w-full rounded-md border border-slate-300 px-2 text-right text-sm outline-none focus:border-[#B23636] focus:ring-2 focus:ring-[#B23636]/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-semibold text-slate-800">
                              {formatReadonlyMoney(total)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removeDetail(row.id)}
                                disabled={!canEdit || details.length === 1}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45"
                                title="Eliminar"
                                aria-label="Eliminar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                  Totales
                </h2>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">Gravada</span>
                    <span className="font-semibold">
                      {formatReadonlyMoney(totals.subTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">IGV 18%</span>
                    <span className="font-semibold">
                      {formatReadonlyMoney(totals.igv)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-base">
                    <span className="font-semibold text-slate-700">Total</span>
                    <span className="font-bold text-slate-900">
                      {formatReadonlyMoney(totals.total)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3 text-xs text-slate-500">
                    <span>Detraccion</span>
                    <span>{formatReadonlyMoney(montoDetraccion)}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-xs text-slate-500">
                    <span>Cuenta</span>
                    <span>{DETRACTION_ACCOUNT}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-xs text-slate-500">
                    <span>M.Pendiente:</span>
                    <span>
                      {formatReadonlyMoney(totals.total - montoDetraccion)}{" "}
                    </span>
                  </div>
                  {canUseDocumentActions ? (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCreateCreditNote()}
                        disabled={sending}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-700 bg-red-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sending ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        {sending ? "Anulando..." : "ANULAR"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSendEmail()}
                        disabled={sendingEmail}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Send
                          className={`h-4 w-4 ${sendingEmail ? "animate-spin" : ""}`}
                        />
                        {sendingEmail ? "Enviando..." : "Enviar Correo"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </section>

              {canEdit ? (
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#B23636] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#96312a] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {sending ? "Creando factura..." : "Enviar"}
                </button>
              ) : null}
            </aside>
          </div>
        </HookForm>
      )}
    </div>
  );
}
