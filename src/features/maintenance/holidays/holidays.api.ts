import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import type { Holiday } from "@/types/maintenance";

export const holidaysQueryKey = ["holidays"] as const;

type HolidayApiResponse = {
  idFeriado?: number;
  feriadoID?: number;
  feriadoId?: number;
  id?: number;
  fecha?: string;
  feriadoFecha?: string;
  motivo?: string;
  feriadoMotivo?: string;
};

const ENDPOINT = `${API_BASE_URL}/Feriados`;

const formatDateOnly = (value?: string) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  try {
    return value.substring(0, 10);
  } catch {
    return "";
  }
};

const mapHoliday = (item: HolidayApiResponse): Holiday => {
  const id =
    Number(
      item?.idFeriado ??
        item?.feriadoID ??
        item?.feriadoId ??
        item?.id ??
        0
    ) || 0;

  return {
    id,
    fecha: formatDateOnly(item?.fecha ?? item?.feriadoFecha ?? ""),
    motivo: String(item?.motivo ?? item?.feriadoMotivo ?? ""),
  };
};

const parseDelimitedHolidays = (rawValue: string): Holiday[] => {
  const raw = String(rawValue ?? "").trim();
  if (!raw || raw === "~" || raw.toUpperCase() === "FORMATO_INVALIDO") {
    return [];
  }

  return raw
    .split("¬")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk): Holiday | null => {
      const parts = chunk.split("|");
      const at = (index: number) => String(parts[index] ?? "").trim();

      const id = Number(at(0)) || 0;
      const fecha = formatDateOnly(at(1));
      const motivo = at(2);

      if (!id && !fecha && !motivo) return null;

      return {
        id,
        fecha,
        motivo,
      };
    })
    .filter((item): item is Holiday => Boolean(item));
};

const parseHolidaysResponse = (payload: unknown): Holiday[] => {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => mapHoliday(item as HolidayApiResponse))
      .filter((h) => Boolean(h.id) || Boolean(h.fecha) || Boolean(h.motivo));
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const arrayCandidate = Object.values(record).find(Array.isArray);
    if (Array.isArray(arrayCandidate)) {
      return arrayCandidate
        .map((item) => mapHoliday(item as HolidayApiResponse))
        .filter((h) => Boolean(h.id) || Boolean(h.fecha) || Boolean(h.motivo));
    }

    const stringCandidate = Object.values(record).find(
      (value) => typeof value === "string",
    );
    if (typeof stringCandidate === "string") {
      return parseDelimitedHolidays(stringCandidate);
    }

    const single = mapHoliday(record as HolidayApiResponse);
    return single.id || single.fecha || single.motivo ? [single] : [];
  }

  if (typeof payload === "string") {
    return parseDelimitedHolidays(payload);
  }

  return [];
};

export const fetchHolidaysApi = async (): Promise<Holiday[]> => {
  const response = await apiRequest<unknown>({
    url: `${ENDPOINT}/list`,
    method: "GET",
    fallback: [],
  });

  return parseHolidaysResponse(response);
};

export const fetchHolidayByIdApi = async (
  id: number
): Promise<Holiday | null> => {
  if (!id) return null;
  const response = await apiRequest<HolidayApiResponse>({
    url: `${ENDPOINT}/${id}`,
    method: "GET",
    fallback: null,
  });
  return response ? mapHoliday(response) : null;
};

type HolidayConflict =
  | { error: "EXISTE_FECHA" }
  | { error: string };

export const saveHolidayApi = async (
  payload: Omit<Holiday, "id"> & { id?: number }
): Promise<Holiday | HolidayConflict> => {
  const body = {
    idFeriado: payload.id ?? 0,
    fecha: payload.fecha,
    motivo: payload.motivo,
  };

  const response = await apiRequest<HolidayApiResponse | string>({
    url: `${ENDPOINT}/register`,
    method: "POST",
    data: body,
    config: {
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
      },
    },
    fallback: body as HolidayApiResponse,
  });

  if (typeof response === "string") {
    const upper = response.toUpperCase();
    if (upper.includes("EXISTE_FECHA") || upper.includes("EXISTE FERIADO")) {
      return { error: "EXISTE_FERIADO" };
    }
    return mapHoliday({ ...body, idFeriado: payload.id ?? 0 });
  }

  return mapHoliday(response ?? { ...body, idFeriado: payload.id ?? 0 });
};

export const deleteHolidayApi = async (id: number) => {
  if (!id) return false;
  const response = await apiRequest({
    url: `${ENDPOINT}/${id}`,
    method: "DELETE",
    config: {
      headers: {
        Accept: "*/*",
      },
    },
    fallback: null,
  });

  return Boolean(response);
};
