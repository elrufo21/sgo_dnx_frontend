import type { Area } from "@/types/maintenance";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { buildApiUrl } from "@/config";

export const areasQueryKey = ["areas"] as const;

type AreaApiResponse = {
  areaId: number;
  areaNombre: string;
};

export const fetchAreasApi = async (): Promise<Area[]> => {
  const response = await apiRequest<
    | AreaApiResponse[]
    | { id?: string | number; nombre?: string; areaId?: number; areaNombre?: string }[]
  >({
    url: buildApiUrl("/Area/list"),
    method: "GET",
    fallback: [],
  });

  return (
    response?.map((item: any) => ({
      id: item.id ?? item.areaId,
      area: item.nombre ?? item.areaNombre ?? "",
    })) ?? []
  );
};
