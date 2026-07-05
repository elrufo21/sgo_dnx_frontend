import { useQuery } from "@tanstack/react-query";
import { fetchCategoriesApi, categoriesQueryKey } from "./categories.api";
import { useMaintenanceStore } from "@/store/maintenance/maintenance.store";

export function useCategoriesQuery() {
  const setCategories = useMaintenanceStore((s) => s.setCategories);

  return useQuery({
    queryKey: categoriesQueryKey,
    queryFn: fetchCategoriesApi,
    staleTime: 1000 * 60, // 1 minuto
    onSuccess: (data) => setCategories(data ?? []),
  });
}
