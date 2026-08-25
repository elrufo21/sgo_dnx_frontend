import type { Area } from "@/types/maintenance";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { buildApiUrl } from "@/config";

export const areasQueryKey = ["areas"] as const;

type AreaApiResponse = {
  id?: string | number;
  nombre?: string;
  areaId?: number;
  areaNombre?: string;
};

export const fetchAreasApi = async (): Promise<Area[]> => {
  const response = await apiRequest<
    | AreaApiResponse[]
  >({
    url: buildApiUrl("/Area/list"),
    method: "GET",
    fallback: [],
  });

  return (
    response?.map((item) => ({
      id: item.id ?? item.areaId,
      area: item.nombre ?? item.areaNombre ?? "",
    })) ?? []
  );
};

type AreaInput = Omit<Area, "id"> & { id?: number };
type AreaSaveResult = Area | { error: string };

const mapArea = (item: AreaApiResponse, fallback: AreaInput): Area => ({
  id: Number(item.id ?? item.areaId ?? fallback.id ?? 0),
  area: item.nombre ?? item.areaNombre ?? fallback.area,
});

export const saveAreaApi = async (payload: AreaInput): Promise<AreaSaveResult> => {
  const response = await apiRequest<AreaApiResponse | string | null>({
    url: buildApiUrl("/Area/registerarea"),
    method: "POST",
    data: { areaId: payload.id ?? 0, areaNombre: payload.area },
    config: { headers: { Accept: "*/*", "Content-Type": "application/json" } },
    fallback: null,
  });

  if (response === null) return { error: "No se pudo guardar el área." };
  if (typeof response !== "string") return mapArea(response, payload);

  const [status = "", value = ""] = response.split("|").map((part) => part.trim());
  if (status.toUpperCase() !== "OK") {
    return { error: value || "No se pudo guardar el área." };
  }

  return mapArea({ areaId: Number(value) || payload.id }, payload);
};

export const deleteAreaApi = async (id: number) => {
  if (!id) return false;
  const response = await apiRequest<unknown>({
    url: buildApiUrl(`/Area/${id}`),
    method: "DELETE",
    config: { headers: { Accept: "*/*" } },
    fallback: null,
  });
  return response === true || (typeof response === "string" && response.toUpperCase().startsWith("OK|"));
};
