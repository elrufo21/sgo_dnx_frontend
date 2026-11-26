import { create } from "zustand";
import { API_BASE_URL } from "@/shared/config/api";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import type { OrderNote, OrderNoteApiItem } from "@/app/orderNotes/types/orderNote";

interface FetchOrderNotesParams {
  fechaInicio?: string;
  fechaFin?: string;
}

interface OrderNoteState {
  notes: OrderNote[];
  totalNotes: number;
  loading: boolean;
  viewedOrderNoteId: number | null;
  setViewedOrderNoteId: (noteId: number | null) => void;
  fetchNotes: (params?: FetchOrderNotesParams, refresh?: boolean) => Promise<void>;
  deleteNote: (
    noteId: number | string,
    clave?: string,
  ) => Promise<{ ok: boolean; mensaje: string }>;
}

const inFlightNotesRequests = new Map<string, Promise<void>>();
const getNotesRequestUserKey = () => {
  if (typeof window === "undefined") return "server";
  try {
    const session = JSON.parse(
      window.localStorage.getItem("sgo.auth.session") ?? "null",
    ) as { userId?: unknown; id?: unknown; username?: unknown } | null;
    return String(session?.userId ?? session?.id ?? session?.username ?? "anonymous");
  } catch {
    return "anonymous";
  }
};

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

const dateLikePattern =
  /^(\d{1,2}\/\d{1,2}\/\d{4}(?:[T\s]\d{1,2}:\d{2}(?::\d{2})?)?|\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?)?)$/;
const numberLikePattern = /^-?\d+(?:[.,]\d+)?$/;

const isDateLike = (value: unknown) =>
  dateLikePattern.test(String(value ?? "").trim());

const isNumberLike = (value: unknown) =>
  numberLikePattern.test(String(value ?? "").trim());

const formatDateForList = (rawValue: unknown) => {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return "-";

  const formatTime = (value: string | undefined) => {
    if (!value) return "";
    const [hour = "0", minute = "0", second = "0"] = value.split(":");
    return ` ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}`;
  };
  const localMatch = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[T\s](\d{1,2}:\d{2}(?::\d{2})?))?$/,
  );
  if (localMatch) {
    const [, day, month, year, time] = localMatch;
    return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}${formatTime(time)}`;
  }

  const isoMatch = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?)?$/,
  );
  if (isoMatch) {
    const [, year, month, day, time] = isoMatch;
    return `${day}/${month}/${year}${formatTime(time)}`;
  }

  return raw;
};

const mapApiToOrderNote = (
  item: OrderNoteApiItem,
  index: number,
): OrderNote => {
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
    item?.clienteRazon ??
      item?.ClienteRazon ??
      item?.miembro ??
      item?.Miembro ??
      item?.cliente,
    "",
  );
  const rawCodigoCliente = normalizeText(
    item?.codigoCliente ?? item?.CodigoCliente,
    "",
  );
  const rawFormaPago = normalizeText(
    item?.notaFormaPago ?? item?.NotaFormaPago ?? item?.formaPago,
    "",
  );
  const rawNotaCondicion = normalizeText(
    item?.notaCondicion ??
      item?.NotaCondicion ??
      item?.condicion ??
      item?.Condicion,
    "",
  );
  const rawEfectivo = normalizeText(
    item?.efectivo ?? item?.Efectivo,
    "0.00",
  );
  const rawDeposito = normalizeText(
    item?.deposito ?? item?.Deposito,
    "0.00",
  );
  const rawTotal = normalizeText(
    item?.notaTotal ?? item?.NotaTotal ?? item?.total,
    "",
  );
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
    item?.notaEstado ??
      item?.NotaEstado ??
      item?.estado ??
      item?.docuEstado ??
      item?.DocuEstado ??
      item?.estadoOBS ??
      item?.EstadoOBS,
    "",
  );
  const rawEstadoSunat = normalizeText(
    item?.estadoSunat ??
      item?.EstadoSunat ??
      item?.notaEstadoSunat ??
      item?.NotaEstadoSunat,
    "",
  );
  const clienteFallbackId = normalizeText(
    item?.clienteId ?? item?.ClienteId,
    "",
  );

  // Compatibilidad: algunos backends aún mapean con offsets antiguos y la fila llega corrida.
  const isShiftedResponse =
    isNumberLike(rawFecha) &&
    isDateLike(rawCliente) &&
    !isNumberLike(rawTotal) &&
    rawTotal.length > 0;

  const fecha = formatDateForList(isShiftedResponse ? rawCliente : rawFecha);
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
  const estadoSunat = rawEstadoSunat;

  const parsedId = Number(notaId);

  return {
    id: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : index + 1,
    notaId,
    documento: documento || normalizeText(item?.documento),
    fecha,
    codigoCliente: rawCodigoCliente || "-",
    cliente,
    conceptoOBS: normalizeText(item?.conceptoOBS ?? item?.ConceptoOBS),
    formaPago,
    efectivo: rawEfectivo || "0.00",
    deposito: rawDeposito || "0.00",
    total,
    acuenta: rawAcuenta || "0.00",
    saldo: rawSaldo || "0.00",
    usuario,
    notaUsuario: usuario,
    estado,
    estadoSunat,
    notaCondicion: rawNotaCondicion || "-",
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
      const notaCondicion = at(16);
      const efectivo = at(42);
      const deposito = at(43);
      const notaTotal = at(23);
      const notaAcuenta = at(24);
      const notaSaldo = at(25);
      const notaEstado = at(29);
      const notaSerie = at(35);
      const notaNumero = at(36);
      const estadoSunat = at(44);
      const codigoCliente = at(45);

      const parsedId = Number(notaId);
      const documentNumber =
        notaSerie || notaNumero
          ? `${notaSerie}${notaSerie && notaNumero ? "-" : ""}${notaNumero}`.trim()
          : "";
      const documento = [notaDocu, documentNumber]
        .filter(Boolean)
        .join(" ")
        .trim();
      const cliente =
        clienteRazon || (clienteId ? `Cliente #${clienteId}` : "-");

      return {
        id: Number.isFinite(parsedId) && parsedId > 0 ? parsedId : index + 1,
        notaId,
        documento: documento || "-",
        fecha: formatDateForList(notaFecha),
        codigoCliente: codigoCliente || "-",
        cliente,
        conceptoOBS: at(46) || "-",
        notaCondicion: notaCondicion || "-",
        formaPago: notaFormaPago || "-",
        efectivo: efectivo || "0.00",
        deposito: deposito || "0.00",
        total: notaTotal || "0.00",
        acuenta: notaAcuenta || "0.00",
        saldo: notaSaldo || "0.00",
        usuario: notaUsuario || "-",
        notaUsuario: notaUsuario || "-",
        estado: notaEstado || "PENDIENTE",
        estadoSunat,
      } satisfies OrderNote;
    });
};

const parseOrderNotesResponse = (
  payload: unknown,
): { rows: OrderNote[]; total: number } => {
  if (Array.isArray(payload)) {
    const rows = payload.map((item, index) =>
      mapApiToOrderNote(item as OrderNoteApiItem, index),
    );
    return { rows, total: rows.length };
  }

  if (typeof payload === "string") {
    const rows = parseDelimitedOrderNotes(payload);
    return { rows, total: rows.length };
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (
      "isAxiosError" in record ||
      ("message" in record && "response" in record)
    ) {
      return { rows: [], total: 0 };
    }
    const total = Number(
      record.total ?? record.Total ?? record.count ?? record.Count,
    );
    const stringCandidate =
      (typeof record.resultado === "string" && record.resultado) ||
      (typeof record.Resultado === "string" && record.Resultado);

    if (typeof stringCandidate === "string") {
      const parsedFromString = parseDelimitedOrderNotes(stringCandidate);
      if (parsedFromString.length > 0) {
        return {
          rows: parsedFromString,
          total: Number.isFinite(total) ? total : parsedFromString.length,
        };
      }
    }

    const arrayCandidate = Object.values(record).find(Array.isArray);
    if (Array.isArray(arrayCandidate)) {
      const rows = arrayCandidate.map((item, index) =>
        mapApiToOrderNote(item as OrderNoteApiItem, index),
      );
      return { rows, total: Number.isFinite(total) ? total : rows.length };
    }
  }

  return { rows: [], total: 0 };
};

export const useOrderNoteStore = create<OrderNoteState>((set, get) => ({
  notes: [],
  totalNotes: 0,
  loading: false,
  viewedOrderNoteId: null,
  setViewedOrderNoteId: (noteId) => set({ viewedOrderNoteId: noteId }),
  fetchNotes: (params, refresh = false) => {
    const today = getLocalDateISO();
    const fechaInicio = String(params?.fechaInicio ?? "").trim() || today;
    const fechaFin = String(params?.fechaFin ?? "").trim() || today;
    const requestKey = `${getNotesRequestUserKey()}|${fechaInicio}|${fechaFin}`;
    const pendingRequest = inFlightNotesRequests.get(requestKey);
    if (pendingRequest) {
      return refresh
        ? pendingRequest.then(() => get().fetchNotes(params))
        : pendingRequest;
    }

    const query = new URLSearchParams();
    query.set("fechaInicio", fechaInicio);
    query.set("fechaFin", fechaFin);

    set({ loading: true });
    const request = (async () => {
      try {
        const response = await apiRequest<unknown>({
          url: `${API_BASE_URL}/Nota/lista-cadena?${query.toString()}`,
          method: "GET",
        });
        if (
          response &&
          typeof response === "object" &&
          "isAxiosError" in response
        ) {
          return;
        }

        const { rows, total } = parseOrderNotesResponse(response);
        set({ notes: rows, totalNotes: total });
      } catch (error) {
        console.error("Error al listar notas de pedido", error);
      } finally {
        set({ loading: false });
      }
    })();
    inFlightNotesRequests.set(requestKey, request);
    void request.then(() => {
      if (inFlightNotesRequests.get(requestKey) === request) {
        inFlightNotesRequests.delete(requestKey);
      }
    });
    return request;
  },
  deleteNote: async (noteId, clave) => {
    const safeNoteId = toPositiveInt(noteId, 0);
    if (!safeNoteId) return { ok: false, mensaje: "Nota de pedido inválida." };

    const response = await apiRequest<unknown>({
      url: `${API_BASE_URL}/Nota/${safeNoteId}`,
      method: "DELETE",
      data: { clave: String(clave ?? "").trim() },
    });

    const result = response as {
      ok?: unknown;
      mensaje?: unknown;
      response?: { data?: { mensaje?: unknown } };
    } | null;
    const mensaje = String(
      result?.mensaje ?? result?.response?.data?.mensaje ?? "No se pudo eliminar la nota de pedido.",
    );
    return { ok: result?.ok === true, mensaje };
  },
}));
