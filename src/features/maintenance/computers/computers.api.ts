import type { Computer } from "@/types/maintenance";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { buildApiUrl } from "@/config";

export const computersQueryKey = ["computers"] as const;

type ComputerApiResponse = {
  idMaquina?: number;
  nombreMaquina?: string;
  registro?: string;
  serieFactura?: string;
  serieNC?: string;
  serieBoleta?: string;
  tiketera?: string;
};

export const fetchComputersApi = async (): Promise<Computer[]> => {
  const response = await apiRequest<ComputerApiResponse[]>({
    url: buildApiUrl("/Maquina/list"),
    method: "GET",
    fallback: [],
  });

  return (
    response?.map((item) => ({
      id: item.idMaquina ?? 0,
      maquina: item.nombreMaquina ?? "",
      registro: item.registro ?? "",
      serieFactura: item.serieFactura ?? "",
      serieNc: (item as any).serieNc ?? item.serieNC ?? "",
      serieBoleta: item.serieBoleta ?? "",
      ticketera: (item as any).ticketera ?? item.tiketera ?? "",
      areaId: 0,
    })) ?? []
  );
};
