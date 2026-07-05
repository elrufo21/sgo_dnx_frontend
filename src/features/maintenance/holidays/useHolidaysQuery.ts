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
    onSuccess: (data) => setHolidays(data ?? []),
  });
}
