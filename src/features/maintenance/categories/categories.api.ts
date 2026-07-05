import type { Category } from "@/types/maintenance";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { buildApiUrl } from "@/config";

export const categoriesQueryKey = ["categories"] as const;

export const fetchCategoriesApi = async (): Promise<Category[]> => {
  const response = await apiRequest<Category[]>({
    url: buildApiUrl("/Linea/list"),
    method: "GET",
    fallback: [],
  });
  return response ?? [];
};
