import { useQuery } from "@tanstack/react-query";
import {
  fetchHolidaysApi,
  holidaysQueryKey,
} from "./holidays.api";
import { useMaintenanceStore } from "@/store/maintenance/maintenance.store";

export function useHolidaysQuery() {
  const setHolidays = useMaintenanceStore((s) => s.setHolidays);

  return useQuery({
    queryKey: holidaysQueryKey,
    queryFn: fetchHolidaysApi,
    staleTime: 1000 * 60,
    select: (data) => [...data].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id),
    onSuccess: (data) => setHolidays(data ?? []),
  });
}
