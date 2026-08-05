import type { Category } from "@/types/maintenance";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { buildApiUrl } from "@/config";

export const categoriesQueryKey = ["categories"] as const;

const toCategory = (item: unknown): Category | null => {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  const id = Number(row.idSubLinea ?? row.IdSubLinea ?? row.id ?? row.Id);
  const nombreSublinea = String(
    row.nombreSublinea ??
      row.NombreSublinea ??
      row.nombre ??
      row.Nombre ??
      "",
  ).trim();

  if (!nombreSublinea) return null;

  return {
    id: Number.isFinite(id) && id > 0 ? id : undefined,
    idSubLinea: Number.isFinite(id) && id > 0 ? id : undefined,
    nombreSublinea,
    codigoSunat: String(row.codigoSunat ?? row.CodigoSunat ?? "").trim(),
  };
};

const normalizeCategories = (response: unknown): Category[] => {
  if (Array.isArray(response)) {
    return response.map(toCategory).filter((item): item is Category => !!item);
  }

  if (!response || typeof response !== "object") return [];

  const row = response as Record<string, unknown>;
  const nested = row.data ?? row.items ?? row.result ?? row.results;
  return Array.isArray(nested)
    ? nested.map(toCategory).filter((item): item is Category => !!item)
    : [];
};

export const fetchCategoriesApi = async (): Promise<Category[]> => {
  const response = await apiRequest<unknown>({
    url: buildApiUrl("/Linea/list?pageSize=100000"),
    method: "GET",
    fallback: [],
  });
  return normalizeCategories(response);
};
