import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";

export function fetchInitialStocks(fechaInicio: string): Promise<unknown> {
  const query = new URLSearchParams({ fechaInicio });
  return apiRequest<unknown>({ url: buildApiUrl(`/InventarioValorizado/saldos-iniciales?${query}`) });
}

export function saveInitialStock(codigo: string, fechaInicio: string, cantidad: number) {
  return apiRequest<{ codigo?: string; cantidad?: number }>({
    url: buildApiUrl("/InventarioValorizado/saldos-iniciales"), method: "PUT", data: { codigo, fechaInicio, cantidad },
  });
}
