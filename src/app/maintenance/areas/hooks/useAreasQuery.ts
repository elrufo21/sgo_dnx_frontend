import { useQuery } from "@tanstack/react-query";
import { areasQueryKey, fetchAreasApi } from "../services/areas.api";
import { useMaintenanceStore } from "@/app/maintenance/store/maintenance.store";

export function useAreasQuery() {
  const setAreas = useMaintenanceStore((s) => s.setAreas);

  return useQuery({
    queryKey: areasQueryKey,
    queryFn: fetchAreasApi,
    staleTime: 1000 * 60,
    onSuccess: (data) => setAreas(data ?? []),
  });
}
