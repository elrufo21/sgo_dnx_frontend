import { create } from "zustand";
import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import type {
  BoletaSummaryConsultPayload,
  BoletaSummaryConsultResponse,
  BoletaSummaryDocument,
  BoletaSummarySentRecord,
  BoletaSummarySendBajaPayload,
  BoletaSummarySendPayload,
  BoletaSummarySendResponse,
} from "@/types/boletasSummary";

interface BoletasSummaryState {
  documents: BoletaSummaryDocument[];
  sentSummaries: BoletaSummarySentRecord[];
  loading: boolean;
  sentSummariesLoading: boolean;
  sequenceLoading: boolean;
  sendingSummary: boolean;
  fetchDocuments: (options?: {
    dataOverride?: string | number;
    includeCancelled?: boolean;
  }) => Promise<void>;
  fetchSentSummaries: (params: {
    fechaInicio: string;
    fechaFin: string;
  }) => Promise<void>;
  fetchNextSummarySequence: (
    companyIdOverride?: string | number,
  ) => Promise<string | null>;
  sendSummary: (
    payload: BoletaSummarySendPayload,
  ) => Promise<BoletaSummarySendResponse>;
  sendSummaryBaja: (
    payload: BoletaSummarySendBajaPayload,
  ) => Promise<BoletaSummarySendResponse>;
  consultSummary: (
    payload: BoletaSummaryConsultPayload,
  ) => Promise<BoletaSummaryConsultResponse>;
  consultSummaryBaja: (
    payload: BoletaSummaryConsultPayload,
  ) => Promise<BoletaSummaryConsultResponse>;
}

const toPositiveInt = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const normalizeText = (value: unknown, fallback = "") => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const toBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  const raw = normalizeText(value, "").toLowerCase();
  return raw === "1" || raw === "true" || raw === "ok" || raw === "success";
};

const extractValidationMessages = (payload: unknown): string[] => {
  const record = asRecord(payload);
  if (!record) return [];

  return Object.values(record)
    .flatMap((value) =>
      Array.isArray(value)
        ? value.map((item) => normalizeText(item, "")).filter(Boolean)
        : [normalizeText(value, "")].filter(Boolean),
    )
    .filter(Boolean);
};

const extractApiMessage = (payload: unknown): string => {
  if (typeof payload === "string") return normalizeText(payload, "");

  const record = asRecord(payload);
  if (!record) return "";

  const directMessage = normalizeText(
    record.mensaje ?? record.message ?? record.title ?? record.detail ?? "",
    "",
  );
  if (directMessage) return directMessage;

  const validationMessages = extractValidationMessages(record.errors);
  if (validationMessages.length > 0) return validationMessages.join(" | ");

  const nestedMessage = extractApiMessage(record.error);
  if (nestedMessage) return nestedMessage;

  return "";
};

const resolveCompanyId = () => {
  if (typeof window === "undefined") return 1;
  try {
    const sessionRaw = window.localStorage.getItem("sgo.auth.session");
    if (!sessionRaw) return 1;

    const parsed = JSON.parse(sessionRaw) as
      | {
          user?: { companyId?: string | number | null };
          companiaId?: string | number | null;
        }
      | null;

    const companyIdRaw =
      parsed?.user?.companyId ??
      parsed?.companiaId ??
      window.localStorage.getItem("companiaId");

    const companyIdNum = Number(companyIdRaw);
    return Number.isFinite(companyIdNum) && companyIdNum > 0 ? companyIdNum : 1;
  } catch {
    return 1;
  }
};

const mapDelimitedRow = (
  chunk: string,
  index: number,
): BoletaSummaryDocument | null => {
  const parts = chunk.split("|");
  const at = (idx: number) => normalizeText(parts[idx], "");

  const docuId = toPositiveInt(at(0), 0);
  const companiaId = toPositiveInt(at(1), 0);
  const notaId = toPositiveInt(at(2), 0);
  if (!docuId && !notaId) return null;

  return {
    id: docuId || index + 1,
    docuId,
    companiaId,
    notaId,
    fechaEmision: at(3),
    docuDocumento: at(4),
    serieNumero: at(5),
    cliente: at(6),
    clienteDni: at(7),
    subTotal: at(8) || "0.00",
    igv: at(9) || "0.00",
    icbper: at(10) || "0.00",
    total: at(11) || "0.00",
    usuario: at(12),
    estadoSunat: at(13),
  };
};

const parseDelimitedDocuments = (rawValue: string): BoletaSummaryDocument[] => {
  const raw = normalizeText(rawValue);
  if (!raw || raw === "~" || raw.toUpperCase() === "FORMATO_INVALIDO") {
    return [];
  }

  // Formato esperado: "dd/MM/yyyy§row1¬row2..." (a veces llega mojibake "Â§")
  const separator = raw.includes("§") ? "§" : raw.includes("Â§") ? "Â§" : "";
  const detailPayload = separator ? raw.split(separator).slice(1).join(separator) : raw;
  const normalizedDetail = normalizeText(detailPayload);
  if (!normalizedDetail || normalizedDetail === "~") return [];

  return normalizedDetail
    .split("¬")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk, index) => mapDelimitedRow(chunk, index))
    .filter((row): row is BoletaSummaryDocument => Boolean(row));
};

const parseDocumentsResponse = (payload: unknown): BoletaSummaryDocument[] => {
  if (Array.isArray(payload)) {
    return payload
      .map((item, index) => {
        const row = item as Record<string, unknown>;
        const docuId = toPositiveInt(row.docuId ?? row.DocuId, 0);
        if (!docuId) return null;

        return {
          id: docuId || index + 1,
          docuId,
          companiaId: toPositiveInt(row.companiaId ?? row.CompaniaId, 0),
          notaId: toPositiveInt(row.notaId ?? row.NotaId, 0),
          fechaEmision: normalizeText(row.docuEmision ?? row.DocuEmision),
          docuDocumento: normalizeText(row.docuDocumento ?? row.DocuDocumento),
          serieNumero:
            normalizeText(row.serieNumero) ||
            normalizeText(
              `${normalizeText(row.docuSerie ?? row.DocuSerie)}-${normalizeText(row.docuNumero ?? row.DocuNumero)}`,
            ),
          cliente: normalizeText(row.clienteRazon ?? row.ClienteRazon),
          clienteDni: normalizeText(row.clienteDni ?? row.ClienteDni),
          subTotal: normalizeText(row.docuSubTotal ?? row.DocuSubTotal, "0.00"),
          igv: normalizeText(row.docuIgv ?? row.DocuIgv, "0.00"),
          icbper: normalizeText(row.icbper ?? row.ICBPER, "0.00"),
          total: normalizeText(row.docuTotal ?? row.DocuTotal, "0.00"),
          usuario: normalizeText(row.docuUsuario ?? row.DocuUsuario),
          estadoSunat: normalizeText(row.estadoSunat ?? row.EstadoSunat),
        } satisfies BoletaSummaryDocument;
      })
      .filter((item): item is BoletaSummaryDocument => Boolean(item));
  }

  if (typeof payload === "string") {
    return parseDelimitedDocuments(payload);
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const stringCandidate =
      (typeof record.resultado === "string" && record.resultado) ||
      (typeof record.Resultado === "string" && record.Resultado) ||
      Object.values(record).find((value) => typeof value === "string");

    if (typeof stringCandidate === "string") {
      const parsedFromString = parseDelimitedDocuments(stringCandidate);
      if (parsedFromString.length > 0) return parsedFromString;
    }

    const arrayCandidate = Object.values(record).find(Array.isArray);
    if (Array.isArray(arrayCandidate)) {
      return parseDocumentsResponse(arrayCandidate);
    }
  }

  return [];
};

const toIsoDate = (value: unknown): string => {
  const raw = normalizeText(value, "");
  if (!raw) return "";

  const [datePart = ""] = raw.split(" ");
  const slashMatch = datePart.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm}-${dd}`;
  }

  const isoMatch = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return datePart;

  return "";
};

const normalizeDelimitedHeader = (value: string) =>
  normalizeText(value, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

const buildDelimitedHeaderIndex = (headerChunk: string) => {
  const index: Record<string, number> = {};
  headerChunk.split("|").forEach((columnName, columnIndex) => {
    const key = normalizeDelimitedHeader(columnName);
    if (key && index[key] === undefined) {
      index[key] = columnIndex;
    }
  });
  return index;
};

const getDelimitedValue = (
  parts: string[],
  headerIndex: Record<string, number> | null,
  aliases: string[],
  fallbackIndex?: number,
) => {
  if (headerIndex) {
    for (const alias of aliases) {
      const key = normalizeDelimitedHeader(alias);
      const idx = headerIndex[key];
      if (idx !== undefined) {
        return normalizeText(parts[idx], "");
      }
    }
  }

  if (fallbackIndex === undefined || fallbackIndex < 0) return "";
  return normalizeText(parts[fallbackIndex], "");
};

const mapDelimitedSentSummaryRow = (
  chunk: string,
  index: number,
  headerIndex: Record<string, number> | null = null,
): BoletaSummarySentRecord => {
  const parts = chunk.split("|");
  const resumenId = toPositiveInt(
    getDelimitedValue(parts, headerIndex, ["Id", "ResumenId"], 0),
    0,
  );
  const serie = getDelimitedValue(
    parts,
    headerIndex,
    ["Serie", "ResumenSerie"],
    4,
  );
  const estado = getDelimitedValue(parts, headerIndex, ["ESTADO", "Estado"], 18);
  const tipoDocumento = inferSummaryDocumentType(
    getDelimitedValue(
      parts,
      headerIndex,
      ["TIPO_DOCUMENTO", "TipoDocumento", "TipoDoc"],
      -1,
    ),
    estado,
  );

  return {
    id: resumenId || index + 1,
    resumenId,
    companiaId: toPositiveInt(
      getDelimitedValue(parts, headerIndex, ["Compania", "CompaniaId"], 1),
      0,
    ),
    fechaEmision: getDelimitedValue(
      parts,
      headerIndex,
      ["FechaEmision", "FechaReferencia"],
      2,
    ),
    fechaEnvio: getDelimitedValue(parts, headerIndex, ["FechaEnvio"], 3),
    serie,
    secuencia:
      getDelimitedValue(
        parts,
        headerIndex,
        ["Secuencia", "NroDocumento"],
        -1,
      ) || serie,
    rangoNumeros: getDelimitedValue(
      parts,
      headerIndex,
      ["RangoNumeros", "RangoNumero"],
      5,
    ),
    subTotal: getDelimitedValue(parts, headerIndex, ["SubTotal"], 6) || "0.00",
    igv: getDelimitedValue(parts, headerIndex, ["IGV"], 7) || "0.00",
    icbper: getDelimitedValue(parts, headerIndex, ["ICBPER"], 8) || "0.00",
    total: getDelimitedValue(parts, headerIndex, ["Total"], 9) || "0.00",
    ticket: getDelimitedValue(parts, headerIndex, ["Ticket", "ResumenTiket"], 10),
    codigoSunat: getDelimitedValue(
      parts,
      headerIndex,
      ["CDSunat", "CodigoSunat", "CodSunat"],
      11,
    ),
    hashCdr: getDelimitedValue(parts, headerIndex, ["HASHCDR", "HashCdr"], 12),
    cdr: getDelimitedValue(
      parts,
      headerIndex,
      ["CDRBase64", "CDR", "Cdr", "XmlCdr"],
      -1,
    ),
    tieneCdr: getDelimitedValue(parts, headerIndex, ["TieneCDR"], -1),
    mensaje: getDelimitedValue(parts, headerIndex, ["Mensaje", "MensajeSunat"], 13),
    usuario: getDelimitedValue(parts, headerIndex, ["Usuario"], 14),
    ruc: getDelimitedValue(parts, headerIndex, ["RUC"], 15),
    usuarioSolEmpresa: getDelimitedValue(
      parts,
      headerIndex,
      ["UserSol", "UsuarioSolEmpresa", "UsuarioSol"],
      16,
    ),
    passSolEmpresa: getDelimitedValue(
      parts,
      headerIndex,
      ["ClaveSol", "PassSolEmpresa", "PassSol"],
      17,
    ),
    tipoDocumento,
    intentos: toPositiveInt(
      getDelimitedValue(parts, headerIndex, ["Intentos"], 19),
      0,
    ),
    estado,
  };
};

const parseDelimitedSentSummaries = (
  rawValue: string,
): BoletaSummarySentRecord[] => {
  const raw = normalizeText(rawValue, "");
  if (!raw || raw === "~" || raw.toUpperCase() === "FORMATO_INVALIDO") {
    return [];
  }

  const normalizedRaw = raw.replaceAll("Â¬", "¬").replaceAll("\uFFFD", "¬");
  const chunks = normalizedRaw
    .split("¬")
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  if (!chunks.length) return [];

  const hasSchemaPrefix = chunks[0]
    .toLowerCase()
    .includes("id|compania|fechaemision|fechaenvio");
  const headerIndex = hasSchemaPrefix ? buildDelimitedHeaderIndex(chunks[0]) : null;
  const detailRows = (hasSchemaPrefix ? chunks.slice(3) : chunks).filter(
    (chunk) => chunk && chunk !== "~",
  );

  return detailRows
    .map((chunk, index) => mapDelimitedSentSummaryRow(chunk, index, headerIndex))
    .filter(hasMeaningfulSentSummaryRow);
};

const looksLikeJsonString = (value: string) => {
  const trimmed = value.trim();
  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
};

const isPlaceholderText = (value: unknown) => {
  const normalized = normalizeText(value, "");
  if (!normalized) return true;
  return normalized === "~";
};

const inferSummaryDocumentType = (
  tipoDocumento: unknown,
  estado: unknown,
): "RA" | "RC" => {
  const explicitType = normalizeText(tipoDocumento, "").toUpperCase();
  if (explicitType === "RA" || explicitType === "RC") {
    return explicitType;
  }

  const normalizedEstado = normalizeText(estado, "").toUpperCase();
  if (
    normalizedEstado === "B" ||
    normalizedEstado.includes("BAJA") ||
    normalizedEstado.includes("ANUL")
  ) {
    return "RA";
  }

  return "RC";
};

const hasMeaningfulSentSummaryRow = (row: BoletaSummarySentRecord) =>
  [
    row.fechaEmision,
    row.fechaEnvio,
    row.serie,
    row.rangoNumeros,
    row.ticket,
    row.codigoSunat,
    row.mensaje,
  ].some((field) => !isPlaceholderText(field));

const parseSentSummariesResponse = (payload: unknown): BoletaSummarySentRecord[] => {
  if (Array.isArray(payload)) {
    return payload
      .map((item, index) => {
        const row = item as Record<string, unknown>;
        const resumenId = toPositiveInt(
          row.resumenId ?? row.ResumenId ?? row.id ?? row.Id,
          0,
        );
        const estado = normalizeText(row.estado ?? row.Estado);

        return {
          id: resumenId || index + 1,
          resumenId,
          companiaId: toPositiveInt(row.companiaId ?? row.CompaniaId, 0),
          fechaEmision: normalizeText(
            row.fechaEmision ?? row.FechaEmision ?? row.fechaReferencia,
          ),
          fechaEnvio: normalizeText(row.fechaEnvio ?? row.FechaEnvio),
          serie: normalizeText(row.serie ?? row.Serie ?? row.resumenSerie),
          secuencia: normalizeText(
            row.secuencia ??
              row.Secuencia ??
              row.nroDocumento ??
              row.NRO_DOCUMENTO ??
              row.serie ??
              row.Serie ??
              row.resumenSerie,
          ),
          rangoNumeros: normalizeText(
            row.rangoNumeros ?? row.RangoNumeros ?? row.rangoNumero,
          ),
          subTotal: normalizeText(row.subTotal ?? row.SubTotal, "0.00"),
          igv: normalizeText(row.igv ?? row.IGV, "0.00"),
          icbper: normalizeText(row.icbper ?? row.ICBPER, "0.00"),
          total: normalizeText(row.total ?? row.Total, "0.00"),
          ticket: normalizeText(
            row.ticket ?? row.Ticket ?? row.resumenTiket ?? row.ResumenTiket,
          ),
          codigoSunat: normalizeText(row.codigoSunat ?? row.CodigoSunat),
          hashCdr: normalizeText(row.hashCdr ?? row.HASHCDR ?? row.hashcdr),
          cdr: normalizeText(
            row.cdr ??
              row.CDRBase64 ??
              row.cdrBase64 ??
              row.CDR ??
              row.xmlCdr ??
              row.XmlCdr ??
              row.cdrXml ??
              row.CdrXml,
          ),
          tieneCdr: normalizeText(row.tieneCdr ?? row.TieneCDR),
          mensaje: normalizeText(row.mensaje ?? row.Mensaje ?? row.mensajeSunat),
          usuario: normalizeText(row.usuario ?? row.Usuario),
          ruc: normalizeText(
            row.ruc ??
              row.RUC ??
              row.nroDocumentoEmpresa ??
              row.NRO_DOCUMENTO_EMPRESA,
          ),
          usuarioSolEmpresa: normalizeText(
            row.usuarioSolEmpresa ??
              row.userSol ??
              row.UserSol ??
              row.USUARIO_SOL_EMPRESA,
          ),
          passSolEmpresa: normalizeText(
            row.passSolEmpresa ??
              row.claveSol ??
              row.ClaveSol ??
              row.PASS_SOL_EMPRESA,
          ),
          tipoDocumento: inferSummaryDocumentType(
            row.tipoDocumento ?? row.TipoDocumento ?? row.TIPO_DOCUMENTO,
            estado,
          ),
          tipoProceso: toPositiveInt(
            row.tipoProceso ??
              row.TipoProceso ??
              row.TIPO_PROCESO ??
              row.tipoProcesoUsado ??
              row.TipoProcesoUsado,
            0,
          ),
          intentos: toPositiveInt(row.intentos ?? row.Intentos, 0),
          estado,
        } satisfies BoletaSummarySentRecord;
      })
      .filter(hasMeaningfulSentSummaryRow);
  }

  if (typeof payload === "string") {
    const normalized = normalizeText(payload, "");
    if (isPlaceholderText(normalized)) return [];

    if (looksLikeJsonString(normalized)) {
      try {
        const parsed = JSON.parse(normalized) as unknown;
        return parseSentSummariesResponse(parsed);
      } catch {
        // Continue with delimited parser fallback.
      }
    }

    return parseDelimitedSentSummaries(normalized);
  }

  const record = asRecord(payload);
  if (!record) return [];

  const stringCandidate =
    (typeof record.resultado === "string" && record.resultado) ||
    (typeof record.Resultado === "string" && record.Resultado) ||
    (typeof record.data === "string" && record.data) ||
    Object.values(record).find((value) => typeof value === "string");

  if (typeof stringCandidate === "string") {
    const normalizedCandidate = normalizeText(stringCandidate, "");
    if (isPlaceholderText(normalizedCandidate)) return [];

    if (looksLikeJsonString(normalizedCandidate)) {
      try {
        const parsed = JSON.parse(normalizedCandidate) as unknown;
        return parseSentSummariesResponse(parsed);
      } catch {
        // Continue with delimited parser fallback.
      }
    }

    const fromString = parseDelimitedSentSummaries(normalizedCandidate);
    if (fromString.length > 0) {
      return fromString;
    }
  }

  const arrayCandidate = Object.values(record).find(Array.isArray);
  if (Array.isArray(arrayCandidate)) {
    return parseSentSummariesResponse(arrayCandidate);
  }

  return [];
};

const sentSummaryOrderKey = (row: BoletaSummarySentRecord) => {
  const rawDateTime = normalizeText(row.fechaEnvio || row.fechaEmision, "");
  const [datePart = "", timePart = ""] = rawDateTime.split(" ");
  const safeDate = toIsoDate(datePart) || "0000-00-00";
  const safeTime = /^\d{2}:\d{2}:\d{2}$/.test(timePart)
    ? timePart
    : "00:00:00";
  return `${safeDate} ${safeTime}`;
};

const isSentSummaryInRange = (
  row: BoletaSummarySentRecord,
  startIso: string,
  endIso: string,
) => {
  const emisionIso = toIsoDate(row.fechaEmision);
  const envioIso = toIsoDate(row.fechaEnvio);
  const currentIso = emisionIso || envioIso;

  if (!currentIso || !startIso || !endIso) return true;
  return currentIso >= startIso && currentIso <= endIso;
};

const parseSummarySequenceResponse = (payload: unknown): string | null => {
  if (!payload) return null;

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const fromJson = normalizeText(
        parsed.secuencia ?? parsed.Secuencia ?? "",
        "",
      );
      return fromJson || trimmed;
    } catch {
      return trimmed;
    }
  }

  if (typeof payload === "object") {
    const row = payload as Record<string, unknown>;
    const sequence = normalizeText(row.secuencia ?? row.Secuencia ?? "", "");
    if (sequence) return sequence;
  }

  return null;
};

const parseRegistroBdResponse = (
  payload: unknown,
): BoletaSummarySendResponse["registro_bd"] => {
  const fallback: BoletaSummarySendResponse["registro_bd"] = {
    ok: false,
    mensaje: "",
    resultado: "",
  };

  if (!payload) return fallback;

  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) return fallback;

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return parseRegistroBdResponse(parsed);
    } catch {
      return {
        ...fallback,
        resultado: trimmed,
      };
    }
  }

  const record = asRecord(payload);
  if (!record) return fallback;

  return {
    ok: toBoolean(record.ok ?? record.Ok ?? false),
    mensaje: normalizeText(record.mensaje ?? record.message ?? "", ""),
    resultado: normalizeText(record.resultado ?? record.Resultado ?? "", ""),
    accion_bd: normalizeText(record.accion_bd ?? record.accionBd ?? "", ""),
    cod_sunat: normalizeText(
      record.cod_sunat ?? record.codSunat ?? record.CodSunat ?? "",
      "",
    ),
    msj_sunat: normalizeText(
      record.msj_sunat ?? record.msjSunat ?? record.MsjSunat ?? "",
      "",
    ),
  };
};

const emptySendSummaryResponse: BoletaSummarySendResponse = {
  ok: false,
  flg_rta: "0",
  aceptado: null,
  http_status: null,
  mensaje: "",
  cod_sunat: "",
  msj_sunat: "",
  hash_cpe: "",
  hash_cdr: "",
  ticket: "",
  entorno_usado: "",
  tipo_proceso_usado: null,
  registro_bd: {
    ok: false,
    mensaje: "",
    resultado: "",
  },
};

const parseSendSummaryResponse = (payload: unknown): BoletaSummarySendResponse => {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) {
      return {
        ...emptySendSummaryResponse,
        mensaje: "No se pudo enviar el resumen.",
      };
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return parseSendSummaryResponse(parsed);
    } catch {
      return {
        ...emptySendSummaryResponse,
        mensaje: trimmed,
        msj_sunat: trimmed,
      };
    }
  }

  const record = asRecord(payload);
  if (!record) {
    return {
      ...emptySendSummaryResponse,
      mensaje: "No se pudo enviar el resumen.",
    };
  }

  const axiosResponse = asRecord(record.response);
  if (axiosResponse) {
    const status = toPositiveInt(axiosResponse.status, 0);
    const apiMessage =
      extractApiMessage(axiosResponse.data) || normalizeText(record.message, "");

    return {
      ...emptySendSummaryResponse,
      http_status: status > 0 ? status : null,
      aceptado: false,
      mensaje: apiMessage || "No se pudo enviar el resumen.",
      cod_sunat: status > 0 ? String(status) : "",
      msj_sunat: apiMessage,
    };
  }

  const flag = normalizeText(
    record.flg_rta ?? record.flgRta ?? record.FlgRta ?? "",
    "",
  );
  const okValue = toBoolean(record.ok ?? record.Ok ?? null);
  const normalizedFlag = flag || (okValue ? "1" : "0");
  const normalizedOk = okValue || normalizedFlag === "1";
  const hasAcceptedField =
    "aceptado" in record || "Aceptado" in record || "ACEPTADO" in record;
  const acceptedRaw =
    record.aceptado ?? record.Aceptado ?? record.ACEPTADO ?? null;
  const acceptedValue = hasAcceptedField ? toBoolean(acceptedRaw) : null;
  const status = toPositiveInt(record.status ?? record.Status, 0);

  const message =
    extractApiMessage(record) || normalizeText(record.mensaje ?? record.message, "");
  const msjSunat = normalizeText(
    record.msj_sunat ?? record.msjSunat ?? record.MsjSunat ?? "",
    "",
  );
  const ticket =
    normalizeText(record.ticket ?? record.Ticket ?? "", "") || msjSunat;
  const tipoProceso = toPositiveInt(
    record.tipo_proceso_usado ??
      record.tipoProcesoUsado ??
      record.TipoProcesoUsado,
    0,
  );
  const registroBd = parseRegistroBdResponse(
    record.registro_bd ?? record.registroBd ?? record.RegistroBd,
  );

  return {
    ok: normalizedOk,
    flg_rta: normalizedFlag,
    aceptado: acceptedValue,
    http_status: status > 0 ? status : null,
    mensaje:
      message ||
      (normalizedOk
        ? "Resumen enviado correctamente."
        : "No se pudo enviar el resumen."),
    cod_sunat: normalizeText(
      record.cod_sunat ?? record.codSunat ?? record.CodSunat,
      "",
    ),
    msj_sunat: msjSunat,
    hash_cpe: normalizeText(
      record.hash_cpe ?? record.hashCpe ?? record.HashCpe,
      "",
    ),
    hash_cdr: normalizeText(
      record.hash_cdr ?? record.hashCdr ?? record.HashCdr,
      "",
    ),
    ticket,
    entorno_usado: normalizeText(
      record.entorno_usado ?? record.entornoUsado ?? record.EntornoUsado,
      "",
    ),
    tipo_proceso_usado: tipoProceso > 0 ? tipoProceso : null,
    registro_bd: registroBd,
  };
};

const emptyConsultSummaryResponse: BoletaSummaryConsultResponse = {
  ok: false,
  accion: "",
  mensaje: "",
  intentos: null,
  cod_sunat: "",
  msj_sunat: "",
  hash_cdr: "",
  hash_cpe: "",
  cdr_recibido: false,
  cdr_base64: "",
  requiere_reenvio: false,
};

const parseConsultSummaryResponse = (
  payload: unknown,
): BoletaSummaryConsultResponse => {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) {
      return {
        ...emptyConsultSummaryResponse,
        mensaje: "No se pudo consultar el resumen.",
      };
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return parseConsultSummaryResponse(parsed);
    } catch {
      return {
        ...emptyConsultSummaryResponse,
        mensaje: trimmed,
        msj_sunat: trimmed,
      };
    }
  }

  const record = asRecord(payload);
  if (!record) {
    return {
      ...emptyConsultSummaryResponse,
      mensaje: "No se pudo consultar el resumen.",
    };
  }

  const axiosResponse = asRecord(record.response);
  if (axiosResponse) {
    const status = toPositiveInt(axiosResponse.status, 0);
    const apiMessage =
      extractApiMessage(axiosResponse.data) || normalizeText(record.message, "");

    return {
      ...emptyConsultSummaryResponse,
      accion: "error",
      mensaje: apiMessage || "No se pudo consultar el resumen.",
      cod_sunat: status > 0 ? String(status) : "",
      msj_sunat: apiMessage,
    };
  }

  const okValue = toBoolean(record.ok ?? record.Ok ?? null);
  const accion = normalizeText(record.accion ?? record.action ?? "", "");
  const message =
    extractApiMessage(record) || normalizeText(record.mensaje ?? record.message, "");
  const intentosRaw = Number(record.intentos ?? record.Intentos);
  const intentos =
    Number.isFinite(intentosRaw) && intentosRaw >= 0
      ? Math.floor(intentosRaw)
      : null;

  return {
    ok: okValue,
    accion,
    mensaje:
      message ||
      (okValue
        ? "Consulta realizada correctamente."
        : "No se pudo consultar el resumen."),
    intentos,
    cod_sunat: normalizeText(
      record.cod_sunat ?? record.codSunat ?? record.CodSunat,
      "",
    ),
    msj_sunat: normalizeText(
      record.msj_sunat ?? record.msjSunat ?? record.MsjSunat,
      "",
    ),
    hash_cdr: normalizeText(
      record.hash_cdr ?? record.hashCdr ?? record.HashCdr,
      "",
    ),
    hash_cpe: normalizeText(
      record.hash_cpe ?? record.hashCpe ?? record.HashCpe,
      "",
    ),
    cdr_recibido: toBoolean(
      record.cdr_recibido ?? record.cdrRecibido ?? record.CdrRecibido ?? false,
    ),
    cdr_base64: normalizeText(
      record.cdr_base64 ?? record.cdrBase64 ?? record.CdrBase64,
      "",
    ),
    requiere_reenvio: toBoolean(
      record.requiere_reenvio ??
        record.requiereReenvio ??
        record.RequiereReenvio ??
        false,
    ),
  };
};

export const useBoletasSummaryStore = create<BoletasSummaryState>((set) => ({
  documents: [],
  sentSummaries: [],
  loading: false,
  sentSummariesLoading: false,
  sequenceLoading: false,
  sendingSummary: false,
  fetchDocuments: async (options) => {
    const { dataOverride, includeCancelled = false } = options ?? {};
    const fallbackCompanyId = resolveCompanyId();
    const payloadData =
      dataOverride !== undefined && dataOverride !== null
        ? String(dataOverride).trim()
        : String(fallbackCompanyId);
    const safeData = payloadData || String(fallbackCompanyId);
    const endpoint = includeCancelled
      ? `${API_BASE_URL}/Nota/lista-bajas`
      : `${API_BASE_URL}/Nota/lista-documentos`;
    const requestData = includeCancelled
      ? { Data: safeData }
      : { data: safeData };

    set({ loading: true });
    try {
      const response = await apiRequest<unknown>({
        url: endpoint,
        method: "POST",
        data: requestData,
        config: {
          headers: {
            "Content-Type": "application/json",
          },
        },
        fallback: [],
      });

      set({
        documents: parseDocumentsResponse(response),
        loading: false,
      });
    } catch (error) {
      console.error("Error al listar boletas para resumen", error);
      set({ loading: false });
    }
  },
  fetchSentSummaries: async ({ fechaInicio, fechaFin }) => {
    const startIso = toIsoDate(fechaInicio);
    const endIso = toIsoDate(fechaFin);

    if (!startIso || !endIso || startIso > endIso) {
      set({ sentSummaries: [] });
      return;
    }

    set({ sentSummariesLoading: true });
    try {
      const query = new URLSearchParams({
        fechaInicio: startIso,
        fechaFin: endIso,
      });
      const response = await apiRequest<unknown>({
        url: `${API_BASE_URL}/Nota/resumen/fecha?${query.toString()}`,
        method: "GET",
        fallback: null,
      });
      const mergedRows = parseSentSummariesResponse(response);

      const dedupMap = new Map<string, BoletaSummarySentRecord>();
      mergedRows.forEach((row) => {
        const dedupKey = [
          row.resumenId || 0,
          row.companiaId || 0,
          normalizeText(row.serie, ""),
          normalizeText(row.ticket, ""),
          normalizeText(row.fechaEnvio, ""),
        ].join("|");
        if (!dedupMap.has(dedupKey)) {
          dedupMap.set(dedupKey, row);
        }
      });

      const rows = Array.from(dedupMap.values())
        .filter((row) => isSentSummaryInRange(row, startIso, endIso))
        .sort((a, b) => sentSummaryOrderKey(b).localeCompare(sentSummaryOrderKey(a)));

      set({ sentSummaries: rows, sentSummariesLoading: false });
    } catch (error) {
      console.error("Error al listar resúmenes enviados", error);
      set({ sentSummaries: [], sentSummariesLoading: false });
    }
  },
  fetchNextSummarySequence: async (companyIdOverride) => {
    const fallbackCompanyId = resolveCompanyId();
    const companyIdNum = toPositiveInt(companyIdOverride, fallbackCompanyId);
    const safeCompanyId = companyIdNum > 0 ? companyIdNum : fallbackCompanyId;

    set({ sequenceLoading: true });
    try {
      const response = await apiRequest<unknown>({
        url: `${API_BASE_URL}/Nota/resumen/secuencia/${safeCompanyId}`,
        method: "GET",
        fallback: null,
      });

      return parseSummarySequenceResponse(response);
    } catch (error) {
      console.error("Error al obtener secuencia del resumen", error);
      return null;
    } finally {
      set({ sequenceLoading: false });
    }
  },
  sendSummary: async (payload) => {
    set({ sendingSummary: true });
    try {
      const response = await apiRequest<unknown>({
        url: `${API_BASE_URL}/Nota/resumen/enviar`,
        method: "POST",
        data: payload,
        config: {
          headers: {
            "Content-Type": "application/json",
          },
        },
        fallback: null,
      });

      return parseSendSummaryResponse(response);
    } catch (error) {
      console.error("Error al enviar resumen de boletas", error);
      return {
        ...emptySendSummaryResponse,
        mensaje: "No se pudo enviar el resumen.",
      };
    } finally {
      set({ sendingSummary: false });
    }
  },
  sendSummaryBaja: async (payload) => {
    set({ sendingSummary: true });
    try {
      const response = await apiRequest<unknown>({
        url: `${API_BASE_URL}/Nota/resumen/enviar-baja`,
        method: "POST",
        data: payload,
        config: {
          headers: {
            "Content-Type": "application/json",
          },
        },
        fallback: null,
      });

      return parseSendSummaryResponse(response);
    } catch (error) {
      console.error("Error al enviar resumen de bajas", error);
      return {
        ...emptySendSummaryResponse,
        mensaje: "No se pudo enviar la baja.",
      };
    } finally {
      set({ sendingSummary: false });
    }
  },
  consultSummary: async (payload) => {
    try {
      const response = await apiRequest<unknown>({
        url: `${API_BASE_URL}/Nota/resumen/consultar`,
        method: "POST",
        data: payload,
        config: {
          headers: {
            "Content-Type": "application/json",
          },
        },
        fallback: null,
      });

      return parseConsultSummaryResponse(response);
    } catch (error) {
      console.error("Error al consultar resumen de boletas", error);
      return {
        ...emptyConsultSummaryResponse,
        mensaje: "No se pudo consultar el resumen.",
      };
    }
  },
  consultSummaryBaja: async (payload) => {
    try {
      const response = await apiRequest<unknown>({
        url: `${API_BASE_URL}/Nota/resumen/consultar-baja`,
        method: "POST",
        data: payload,
        config: {
          headers: {
            "Content-Type": "application/json",
          },
        },
        fallback: null,
      });

      return parseConsultSummaryResponse(response);
    } catch (error) {
      console.error("Error al consultar baja de boletas", error);
      return {
        ...emptyConsultSummaryResponse,
        mensaje: "No se pudo consultar la baja.",
      };
    }
  },
}));
