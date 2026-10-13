import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";

export type UncapturedObsSale = {
  transaccion: string;
  codigo: string;
  cliente: string;
  importe: number;
};

type UncapturedObsSalesResponse = {
  fecha: string;
  ventasNoCapturadas: UncapturedObsSale[];
};

export async function fetchUncapturedObsSales(
  fecha: string,
): Promise<UncapturedObsSale[]> {
  const query = new URLSearchParams({ fecha });
  const response = await apiRequest<UncapturedObsSalesResponse, unknown, null>({
    url: buildApiUrl(`/CashFlow/ventas-no-capturadas?${query.toString()}`),
  });
  if (!response || !Array.isArray(response.ventasNoCapturadas)) {
    throw new Error("No se pudieron cargar las ventas no capturadas al facturador.");
  }
  return response.ventasNoCapturadas;
}
