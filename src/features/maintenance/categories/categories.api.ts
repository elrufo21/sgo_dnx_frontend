import type { Category } from "@/types/maintenance";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { buildApiUrl } from "@/config";

export const categoriesQueryKey = ["categories"] as const;
export const legacyCategoriesQueryKey = ["categories", "legacy"] as const;

const toCategory = (item: unknown): Category | null => {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  const id = Number(row.idSubLinea ?? row.IdSubLinea ?? row.id ?? row.Id);
  const idLinea = Number(row.idLinea ?? row.IdLinea);
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
    idLinea: Number.isFinite(idLinea) && idLinea > 0 ? idLinea : undefined,
    nombreSublinea,
    codigoSunat: String(row.codigoSunat ?? row.CodigoSunat ?? "").trim(),
    vista: String(row.vista ?? row.Vista ?? "V").trim() || "V",
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
    url: buildApiUrl("/Linea/maintenance/list?pageSize=100000"),
    method: "GET",
    fallback: [],
  });
  return normalizeCategories(response);
};

export const fetchLegacyCategoriesApi = async (): Promise<Category[]> => {
  const response = await apiRequest<unknown>({
    url: buildApiUrl("/Linea/list?pageSize=100000"),
    method: "GET",
    fallback: [],
  });
  return normalizeCategories(response);
};

type CategoryInput = Omit<Category, "id"> & { id?: string | number };
export type CategorySaveResult = Category | { error: string };

const mapCategory = (payload: CategoryApiResponse, fallback: CategoryInput): Category => ({
  id: Number(payload.id ?? payload.idSubLinea ?? fallback.id ?? 0),
  idSubLinea: Number(payload.id ?? payload.idSubLinea ?? fallback.id ?? 0),
  idLinea: Number(payload.idLinea ?? fallback.idLinea ?? 0),
  nombreSublinea: payload.nombreSublinea ?? fallback.nombreSublinea,
  codigoSunat: payload.codigoSunat ?? fallback.codigoSunat,
  vista: payload.vista ?? fallback.vista ?? "V",
});

type CategoryApiResponse = {
  id?: string | number;
  idSubLinea?: string | number;
  idLinea?: string | number;
  nombreSublinea?: string;
  codigoSunat?: string;
  vista?: string;
};

export const saveCategoryApi = async (
  payload: CategoryInput,
): Promise<CategorySaveResult> => {
  const id = Number(payload.id ?? payload.idSubLinea ?? 0);
  const idLinea = Number(payload.idLinea ?? 0);
  const nombre = payload.nombreSublinea?.trim() ?? "";
  const codigo = payload.codigoSunat?.trim() ?? "";
  const vista = payload.vista?.trim() || "V";

  const response = await apiRequest<string | CategoryApiResponse | null>({
    url: buildApiUrl("/Linea/maintenance/register"),
    method: "POST",
    data: {
      idSubLinea: id,
      idLinea,
      nombreSublinea: nombre,
      codigoSunat: codigo,
      vista,
    },
    config: { headers: { Accept: "*/*", "Content-Type": "application/json" } },
    fallback: null,
  });

  if (response === null) return { error: "No se pudo guardar la sublinea." };
  if (typeof response !== "string") return mapCategory(response, payload);

  const [status = "", value = ""] = response
    .split("|")
    .map((part) => part.trim());
  if (status.toUpperCase() !== "OK") {
    return { error: value || "No se pudo guardar la sublinea." };
  }

  return mapCategory(
    { id: id > 0 ? id : Number(value), idLinea, nombreSublinea: nombre, codigoSunat: codigo, vista },
    payload,
  );
};

export const deleteCategoryApi = async (id: number): Promise<boolean> => {
  if (!id) return false;
  const response = await apiRequest<unknown>({
    url: buildApiUrl(`/Linea/maintenance/${id}`),
    method: "DELETE",
    config: { headers: { Accept: "*/*" } },
    fallback: null,
  });
  return typeof response === "string" && response.toUpperCase().startsWith("OK|");
};
