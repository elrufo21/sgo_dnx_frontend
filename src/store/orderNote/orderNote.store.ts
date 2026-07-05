import { create } from "zustand";
import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import type { OrderNote, OrderNoteApiItem } from "@/types/orderNote";
import type { SendNote, SendNoteItem } from "@/types/sendNote";

interface FetchOrderNotesParams {
  fechaInicio?: string;
  fechaFin?: string;
}

interface OrderNoteState {
  notes: OrderNote[];
  loading: boolean;
  fetchNotes: (params?: FetchOrderNotesParams) => Promise<void>;
  fetchNoteDetail: (noteId: number | string) => Promise<SendNote | null>;
  updateNoteDetail: (
    noteId: number,
    formData: Omit<SendNote, "id">,
    current: SendNote
  ) => Promise<boolean>;
}

const toPositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : Math.floor(fallback);
};

const normalizeText = (value: unknown, fallback = "-") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const dateLikePattern = /^(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})$/;
const numberLikePattern = /^-?\d+(?:[.,]\d+)?$/;

const isDateLike = (value: unknown) =>
  dateLikePattern.test(String(value ?? "").trim());

const isNumberLike = (value: unknown) =>
  numberLikePattern.test(String(value ?? "").trim());

const normalizeLower = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatDateForList = (rawValue: unknown) => {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return "-";
  if (dateLikePattern.test(raw) && raw.includes("/")) return raw;

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }

  return raw;
};

const mapDocTypeToCode = (docValue: string) => {
  const normalized = normalizeLower(docValue);
  if (normalized.includes("boleta")) return "03";
  if (normalized.includes("factura")) return "01";
  return "101";
};

const mapConceptToOption = (conceptValue: string) => {
  const normalized = normalizeLower(conceptValue);
  if (normalized.includes("serv")) return "servicio";
  if (normalized.includes("merc")) return "mercaderia";
  return normalized || "mercaderia";
};

const mapFormaPagoToOption = (formaPagoValue: string) => {
  const normalized = normalizeLower(formaPagoValue);
  if (normalized.includes("efect")) return "efectivo";
  if (normalized.includes("contado")) return "efectivo";
  if (normalized.includes("depo")) return "deposito";
  if (normalized.includes("trans")) return "transferencia";
  return normalized || "efectivo";
};

const mapFormDocTypeToNotaDocu = (
  tipoDocumentoValue: string,
  current?: SendNote
) => {
  const normalized = normalizeLower(tipoDocumentoValue);
  if (normalized === "03" || normalized.includes("boleta")) return "BOLETA";
  if (normalized === "01" || normalized.includes("factura")) return "FACTURA";
  if (normalized === "101" || normalized.includes("proforma"))
    return "PROFORMA V";
  return current?.notaDocu ?? "BOLETA";
};

const mapFormFormaPagoToNotaFormaPago = (formaPagoValue: string) => {
  const normalized = normalizeLower(formaPagoValue);
  if (normalized.includes("efect")) return "CONTADO";
  if (normalized.includes("depo")) return "DEPOSITO";
  if (normalized.includes("trans")) return "TRANSFERENCIA";
  return String(formaPagoValue ?? "").trim().toUpperCase() || "CONTADO";
};

const resolveSessionUsername = () => {
  if (typeof window === "undefined") return "USUARIO";
  try {
    const rawSession = window.localStorage.getItem("sgo.auth.session");
    if (!rawSession) return "USUARIO";
    const parsed = JSON.parse(rawSession) as {
      user?: { displayName?: string; username?: string };
    } | null;
    return (
      String(parsed?.user?.displayName ?? "").trim() ||
      String(parsed?.user?.username ?? "").trim() ||
      "USUARIO"
    );
  } catch {
    return "USUARIO";
  }
};

const mapApiToOrderNote = (item: OrderNoteApiItem, index: number): OrderNote => {
  const notaId = normalizeText(item?.notaId ?? item?.NotaId, "0");
  const notaDocu = normalizeText(
    item?.notaDocu ?? item?.NotaDocu ?? item?.documento,
    "",
  );
  const notaSerie = normalizeText(item?.notaSerie ?? item?.NotaSerie, "");
  const notaNumero = normalizeText(item?.notaNumero ?? item?.NotaNumero, "");
  const documentNumber =
    notaSerie || notaNumero
      ? `${notaSerie}${notaSerie && notaNumero ? "-" : ""}${notaNumero}`.trim()
      : "";
  const docAlreadyHasNumber =
    Boolean(documentNumber) &&
    notaDocu.toUpperCase().includes(documentNumber.toUpperCase());
  const documento = docAlreadyHasNumber
    ? notaDocu
    : [notaDocu, documentNumber].filter(Boolean).join(" ").trim();

  const rawFecha = normalizeText(
    item?.notaFecha ?? item?.NotaFecha ?? item?.fecha,
    "",
  );
  const rawCliente = normalizeText(
    item?.clienteRazon ?? item?.ClienteRazon ?? item?.cliente,
    "",
  );
  const rawFormaPago = normalizeText(
    item?.notaFormaPago ?? item?.NotaFormaPago ?? item?.formaPago,
    "",
  );
  const rawTotal = normalizeText(item?.notaTotal ?? item?.NotaTotal ?? item?.total, "");
  const rawAcuenta = normalizeText(
    item?.notaAcuenta ?? item?.NotaAcuenta ?? item?.acuenta,
    "0.00",
  );
  const rawSaldo = normalizeText(
    item?.notaSaldo ?? item?.NotaSaldo ?? item?.saldo,
    "0.00",
  );
  const rawUsuario = normalizeText(
    item?.notaUsuario ?? item?.NotaUsuario ?? item?.usuario,
    "",
  );
  const rawEstado = normalizeText(
    item?.notaEstado ?? item?.NotaEstado ?? item?.estado,
    "",
  );
  const rawEstadoSunat = normalizeText(
    item?.estadoSunat ??
      item?.EstadoSunat ??
      item?.notaEstadoSunat ??
      item?.NotaEstadoSunat,
    "",
  );
  const clienteFallbackId = normalizeText(item?.clienteId ?? item?.ClienteId, "");

  // Compatibilidad: algunos backends aún mapean con offsets antiguos y la fila llega corrida.
  const isShiftedResponse =
    isNumberLike(rawFecha) &&
    isDateLike(rawCliente) &&
    !isNumberLike(rawTotal) &&
    rawTotal.length > 0;

  const fecha = isShiftedResponse ? rawCliente : rawFecha || "-";
  const cliente = isShiftedResponse
    ? rawFecha
      ? `Cliente #${rawFecha}`
      : "-"
    : rawCliente || (clienteFallbackId ? `Cliente #${clienteFallbackId}` : "-");
  const formaPago = isShiftedResponse ? rawTotal || "-" : rawFormaPago || "-";
  const total = isShiftedResponse
    ? normalizeText(item?.notaTotal ?? item?.NotaTotal, "0.00")
    : rawTotal || "0.00";
  const usuario = isShiftedResponse ? rawFormaPago || "-" : rawUsuario || "-";
  const estado = isShiftedResponse
    ? rawUsuario || rawEstado || "PENDIENTE"
    : rawEstado || "PENDIENTE";

  const parsedId = Number(notaId);

  return {
    id: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : index + 1,
    notaId,
    documento: documento || normalizeText(item?.documento),
    fecha,
    cliente,
    formaPago,
    total,
    acuenta: rawAcuenta || "0.00",
    saldo: rawSaldo || "0.00",
    usuario,
    estado,
    estadoSunat: rawEstadoSunat,
  };
};

const parseDelimitedOrderNotes = (rawValue: string): OrderNote[] => {
  const raw = String(rawValue ?? "").trim();
  if (!raw || raw === "~" || raw.toUpperCase() === "FORMATO_INVALIDO") {
    return [];
  }

  return raw
    .split("¬")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, index) => {
      const parts = chunk.split("|");
      const at = (idx: number) => String(parts[idx] ?? "").trim();

      const notaId = at(0) || String(index + 1);
      const notaDocu = at(1);
      const clienteId = at(2);
      const clienteRazon = at(3);
      const notaFecha = at(13);
      const notaUsuario = at(14);
      const notaFormaPago = at(15);
      const notaTotal = at(23);
      const notaAcuenta = at(24);
      const notaSaldo = at(25);
      const notaEstado = at(29);
      const notaSerie = at(35);
      const notaNumero = at(36);

      const parsedId = Number(notaId);
      const documentNumber =
        notaSerie || notaNumero
          ? `${notaSerie}${notaSerie && notaNumero ? "-" : ""}${notaNumero}`.trim()
          : "";
      const documento = [notaDocu, documentNumber].filter(Boolean).join(" ").trim();
      const cliente =
        clienteRazon || (clienteId ? `Cliente #${clienteId}` : "-");

      return {
        id: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : index + 1,
        notaId,
        documento: documento || "-",
        fecha: formatDateForList(notaFecha),
        cliente,
        formaPago: notaFormaPago || "-",
        total: notaTotal || "0.00",
        acuenta: notaAcuenta || "0.00",
        saldo: notaSaldo || "0.00",
        usuario: notaUsuario || "-",
        estado: notaEstado || "PENDIENTE",
        estadoSunat: "",
      } satisfies OrderNote;
    });
};

const parseOrderNotesResponse = (payload: unknown): OrderNote[] => {
  if (Array.isArray(payload)) {
    return payload.map((item, index) =>
      mapApiToOrderNote(item as OrderNoteApiItem, index)
    );
  }

  if (typeof payload === "string") {
    return parseDelimitedOrderNotes(payload);
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const stringCandidate =
      (typeof record.resultado === "string" && record.resultado) ||
      (typeof record.Resultado === "string" && record.Resultado) ||
      Object.values(record).find((value) => typeof value === "string");

    if (typeof stringCandidate === "string") {
      const parsedFromString = parseDelimitedOrderNotes(stringCandidate);
      if (parsedFromString.length > 0) return parsedFromString;
    }

    const arrayCandidate = Object.values(record).find(Array.isArray);
    if (Array.isArray(arrayCandidate)) {
      return arrayCandidate.map((item, index) =>
        mapApiToOrderNote(item as OrderNoteApiItem, index)
      );
    }
  }

  return [];
};

const parseResultStringToSendNote = (resultString: string): SendNote | null => {
  const raw = String(resultString ?? "").trim();
  if (!raw || raw === "~" || raw === "FORMATO_INVALIDO") {
    return null;
  }

  const separatorIndex = raw.indexOf("[");
  const headerRaw = separatorIndex >= 0 ? raw.slice(0, separatorIndex) : raw;
  const detailsRaw = separatorIndex >= 0 ? raw.slice(separatorIndex + 1) : "";
  const headerParts = headerRaw.split("|");
  const at = (idx: number) => String(headerParts[idx] ?? "").trim();

  const noteId = toNumber(at(0), 0);
  const documentValue = at(1);
  const clienteId = toNumber(at(2), 0);
  const userValue = at(4);
  const condicionValue = at(6);
  const estadoValue = at(19);

  const parsedItems: SendNoteItem[] = detailsRaw
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): SendNoteItem | null => {
      const parts = chunk.split("|");
      if (parts[0] !== "DET") return null;

      const productId = toNumber(parts[3], 0);
      return {
        productId: productId > 0 ? productId : null,
        codigo: String(parts[3] ?? "").trim(),
        nombre: String(parts[6] ?? "").trim(),
        descripcion: String(parts[6] ?? "").trim(),
        unidadMedida: String(parts[5] ?? "").trim(),
        cantidad: toNumber(parts[4], 0),
        preCosto: toNumber(parts[7], 0),
        descuento: 0,
        importe: toNumber(parts[9], 0),
      };
    })
    .filter((item): item is SendNoteItem => Boolean(item));

  return {
    id: noteId,
    clienteId: clienteId > 0 ? clienteId : undefined,
    formaPago: mapFormaPagoToOption(at(5)),
    entidad: at(30),
    opr: at(31),
    cliente: at(33),
    ruc: at(34),
    dni: at(35),
    direccionFiscal: at(36) || at(8),
    direccionDespacho: at(40) || at(8) || at(36),
    telefono: at(37) || at(9),
    concepto: mapConceptToOption(at(24)),
    tipoDocumento: mapDocTypeToCode(documentValue),
    buscarCodigo: "",
    radioOpcion: "opcion1",
    items: parsedItems,
    usuarioResponsable: userValue,
    atendidoPor: userValue || at(22),
    estado: estadoValue,
    fechaEmitido: at(3),
    fechaPago: at(7) || at(3),
    notaCondicion: condicionValue || "NORMAL",
    notaDocu: documentValue || "BOLETA",
  };
};

export const useOrderNoteStore = create<OrderNoteState>((set) => ({
  notes: [],
  loading: false,
  fetchNotes: async (params) => {
    const today = getLocalDateISO();
    const fechaInicio = String(params?.fechaInicio ?? "").trim() || today;
    const fechaFin = String(params?.fechaFin ?? "").trim() || today;

    const query = new URLSearchParams();
    query.set("fechaInicio", fechaInicio);
    query.set("fechaFin", fechaFin);

    set({ loading: true });
    try {
      const response = await apiRequest<unknown>({
        url: `${API_BASE_URL}/Nota/list?${query.toString()}`,
        method: "GET",
        fallback: [],
      });

      const rows = parseOrderNotesResponse(response);

      set({
        notes: rows,
        loading: false,
      });
    } catch (error) {
      console.error("Error al listar notas de pedido", error);
      set({ loading: false });
    }
  },
  fetchNoteDetail: async (noteId) => {
    const parsedId = toPositiveInt(noteId, 0);
    if (!parsedId) return null;

    try {
      const response = await apiRequest<unknown>({
        url: `${API_BASE_URL}/Nota/sp/${parsedId}`,
        method: "GET",
        fallback: null,
      });

      const resultString =
        typeof response === "string"
          ? response
          : (response as { resultado?: unknown } | null)?.resultado;

      if (typeof resultString !== "string") return null;
      return parseResultStringToSendNote(resultString);
    } catch (error) {
      console.error("Error al cargar detalle de nota de pedido", error);
      return null;
    }
  },
  updateNoteDetail: async (noteId, formData, current) => {
    const safeNoteId = toPositiveInt(noteId, 0);
    if (!safeNoteId) return false;

    const nowDate = getLocalDateISO();
    const clienteId = toPositiveInt(
      formData.clienteId ?? current.clienteId ?? 0,
      0
    );
    const notaFecha =
      String(current.fechaEmitido ?? "").trim() ||
      String(formData.fechaPago ?? "").trim() ||
      nowDate;

    const notaPayload = {
      notaId: safeNoteId,
      notaDocu: mapFormDocTypeToNotaDocu(formData.tipoDocumento, current),
      clienteId,
      notaFecha,
      notaUsuario:
        String(current.usuarioResponsable ?? "").trim() ||
        String(current.atendidoPor ?? "").trim() ||
        resolveSessionUsername(),
      notaFormaPago: mapFormFormaPagoToNotaFormaPago(formData.formaPago),
      notaCondicion:
        String(current.notaCondicion ?? "").trim().toUpperCase() || "NORMAL",
    };

    const detallesPayload = (formData.items ?? [])
      .filter((item) => toPositiveInt(item.productId, 0) > 0)
      .map((item) => {
        const detalleCantidad = toNumber(item.cantidad, 0);
        const detalleCosto = toNumber(item.preCosto, 0);
        const detalleImporte = toNumber(item.importe, 0);
        const detallePrecio =
          detalleCantidad > 0
            ? Number((detalleImporte / detalleCantidad).toFixed(2))
            : detalleCosto;

        return {
          idProducto: toPositiveInt(item.productId, 0),
          detalleCantidad,
          detalleUm: String(item.unidadMedida ?? "").trim() || "UND",
          detalleDescripcion:
            String(item.nombre ?? "").trim() ||
            String(item.descripcion ?? "").trim(),
          detalleCosto,
          detallePrecio,
          detalleImporte,
          detalleEstado: "ACTIVO",
        };
      })
      .filter((item) => item.idProducto > 0);

    if (!clienteId) return false;
    if (!detallesPayload.length) return false;

    const response = await apiRequest<unknown>({
      url: `${API_BASE_URL}/Nota/editarOrden`,
      method: "PUT",
      data: {
        nota: notaPayload,
        detalles: detallesPayload,
      },
      config: {
        headers: {
          Accept: "*/*",
          "Content-Type": "application/json",
        },
      },
      fallback: null,
    });

    if (!response) return false;

    if (typeof response === "object" && response !== null) {
      const maybeError = response as {
        isAxiosError?: boolean;
        response?: { status?: number };
      };
      if (maybeError.isAxiosError) return false;
      if ((maybeError.response?.status ?? 200) >= 400) return false;
    }

    return true;
  },
}));
