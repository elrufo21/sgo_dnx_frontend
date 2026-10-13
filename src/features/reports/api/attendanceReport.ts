import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";

export type AttendanceReportRow = {
  id: number;
  fecha: string;
  personalId: number;
  nombres: string;
  horaIngreso: string;
  salidaRefrigerio: string;
  retornoRefrigerio: string;
  horaSalida: string;
  nroMarcacion: number;
  estadoAsistencia: string;
  estadoRefrigerio: string;
  cantidadTardanzas: number;
};

type AttendanceResponse = {
  fecha: string;
  asistencias: AttendanceReportRow[];
};

export type AttendancePersonOption = {
  personalId: number;
  nombres: string;
};

type AttendancePeopleResponse = {
  personas: AttendancePersonOption[];
};

export async function fetchAttendanceReport(
  fecha: string,
): Promise<AttendanceReportRow[]> {
  const query = new URLSearchParams({ fecha });
  const response = await apiRequest<AttendanceResponse>({
    url: buildApiUrl(`/AttendanceReport?${query.toString()}`),
  });
  if (!response || !Array.isArray(response.asistencias)) {
    throw new Error("No se pudo cargar el reporte de asistencia.");
  }
  return response.asistencias;
}

export async function fetchAttendanceReportRange(
  fechaInicio: string,
  fechaFin: string,
  personalId?: number,
): Promise<AttendanceReportRow[]> {
  const query = new URLSearchParams({ fechaInicio, fechaFin });
  if (personalId) query.set("personalId", String(personalId));
  const response = await apiRequest<{ asistencias: AttendanceReportRow[] }>(
    { url: buildApiUrl(`/AttendanceReport?${query.toString()}`) },
  );
  if (!response || !Array.isArray(response.asistencias)) {
    throw new Error("No se pudo cargar el reporte de asistencia.");
  }
  return response.asistencias;
}

export async function fetchAttendancePeople(): Promise<AttendancePersonOption[]> {
  const response = await apiRequest<AttendancePeopleResponse>({
    url: buildApiUrl("/AttendanceReport/personas"),
  });
  if (!response || !Array.isArray(response.personas)) {
    throw new Error("No se pudo cargar la lista de personal.");
  }
  return response.personas;
}

export function attendanceDate(value: string): string {
  const trimmed = value.trim();
  const isoDate = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDate) return isoDate[1];

  const localDate = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (localDate) return `${localDate[3]}-${localDate[2]}-${localDate[1]}`;

  return trimmed.slice(0, 10);
}
