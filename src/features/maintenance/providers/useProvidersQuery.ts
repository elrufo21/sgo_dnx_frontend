import { useQuery } from "@tanstack/react-query";
import { providersQueryKey, fetchProvidersApi } from "./providers.api";
import { useMaintenanceStore } from "@/store/maintenance/maintenance.store";

export function useProvidersQuery(estado: "ACTIVO" | "INACTIVO" | "" = "ACTIVO") {
  const setProviders = useMaintenanceStore((s) => s.setProviders);

  return useQuery({
    queryKey: [...providersQueryKey, estado],
    queryFn: () => fetchProvidersApi(estado),
    staleTime: 1000 * 60,
    onSuccess: (data) => setProviders(data ?? []),
  });
}
