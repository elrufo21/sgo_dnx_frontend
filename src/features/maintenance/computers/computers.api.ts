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
  serieNc?: string;
  serieBoleta?: string;
  tiketera?: string;
  ticketera?: string;
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
      serieNc: item.serieNc ?? item.serieNC ?? "",
      serieBoleta: item.serieBoleta ?? "",
      ticketera: item.ticketera ?? item.tiketera ?? "",
      areaId: 0,
    })) ?? []
  );
};

type ComputerInput = Omit<Computer, "id"> & { id?: number };
type ComputerSaveResult = Computer | { error: string };

const mapComputer = (item: ComputerApiResponse, fallback: ComputerInput): Computer => ({
  id: item.idMaquina ?? fallback.id ?? 0,
  maquina: item.nombreMaquina ?? fallback.maquina,
  registro: item.registro ?? fallback.registro,
  serieFactura: item.serieFactura ?? fallback.serieFactura,
  serieNc: item.serieNC ?? fallback.serieNc,
  serieBoleta: item.serieBoleta ?? fallback.serieBoleta,
  ticketera: item.tiketera ?? fallback.ticketera,
  areaId: fallback.areaId,
});

export const saveComputerApi = async (
  payload: ComputerInput,
): Promise<ComputerSaveResult> => {
  const response = await apiRequest<ComputerApiResponse | string | null>({
    url: buildApiUrl("/Maquina/registermaquina"),
    method: "POST",
    data: {
      idMaquina: payload.id ?? 0,
      nombreMaquina: payload.maquina,
      serieFactura: payload.serieFactura,
      serieNC: payload.serieNc,
      serieBoleta: payload.serieBoleta,
      tiketera: payload.ticketera,
    },
    config: { headers: { Accept: "*/*", "Content-Type": "application/json" } },
    fallback: null,
  });

  if (response === null) return { error: "No se pudo guardar la máquina." };
  if (typeof response !== "string") return mapComputer(response, payload);

  const [status = "", value = ""] = response.split("|").map((part) => part.trim());
  if (status.toUpperCase() !== "OK") {
    return { error: value || "No se pudo guardar la máquina." };
  }

  return mapComputer({ idMaquina: Number(value) || payload.id }, payload);
};

export const deleteComputerApi = async (id: number) => {
  if (!id) return false;
  const response = await apiRequest<unknown>({
    url: buildApiUrl(`/Maquina/${id}`),
    method: "DELETE",
    config: { headers: { Accept: "*/*" } },
    fallback: null,
  });
  return response === true || (typeof response === "string" && response.toUpperCase().startsWith("OK|"));
};
