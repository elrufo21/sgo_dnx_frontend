import { create } from "zustand";

import { apiRequest } from "@/shared/helpers/apiRequest";
import { buildApiUrl } from "@/config";
import { queryClient } from "@/shared/queryClient";
import type { Employee, Personal } from "@/types/employees";

export const employeesQueryKey = ["employees"] as const;

interface EmployeesState {
  employees: Employee[];
  loading: boolean;

  fetchEmployees: (estado?: "ACTIVO" | "INACTIVO" | "") => Promise<void>;
  addEmployee: (
    employee: Omit<Employee, "personalId"> & {
      imageFile?: File | null;
      imageRemoved?: boolean;
    }
  ) => Promise<boolean>;
  updateEmployee: (
    id: number,
    data: Partial<Employee> & {
      imageFile?: File | null;
      imageRemoved?: boolean;
    }
  ) => Promise<boolean>;
  deleteEmployee: (id: number) => Promise<boolean>;
}

const mapApiToEmployee = (item: any): Personal => ({
  personalId: item?.personalId ?? item?.id ?? item?.PersonalId ?? 0,
  personalNombres:
    item?.personalNombres ?? item?.PersonalNombres ?? item?.nombres ?? "",
  personalApellidos:
    item?.personalApellidos ?? item?.PersonalApellidos ?? item?.apellidos ?? "",
  areaId: item?.areaId ?? item?.AreaId ?? null,
  personalCodigo:
    item?.personalCodigo ?? item?.PersonalCodigo ?? item?.codigo ?? "",
  personalNacimiento:
    item?.personalNacimiento ?? item?.PersonalNacimiento ?? null,
  personalIngreso: item?.personalIngreso ?? item?.PersonalIngreso ?? null,
  personalDni:
    item?.personalDni ??
    item?.personalDNI ??
    item?.PersonalDNI ??
    item?.dni ??
    "",
  personalDireccion:
    item?.personalDireccion ?? item?.PersonalDireccion ?? item?.direccion ?? "",
  personalTelefono:
    item?.personalTelefono ?? item?.PersonalTelefono ?? item?.telefono ?? "",
  personalEmail:
    item?.personalEmail ?? item?.PersonalEmail ?? item?.correo ?? "",
  personalEstado:
    item?.personalEstado ?? item?.PersonalEstado ?? item?.estado ?? "ACTIVO",
  personalImagen:
    item?.personalImagen ?? item?.PersonalImagen ?? item?.foto ?? null,
  companiaId: item?.companiaId ?? item?.CompaniaId ?? null,
});

const buildPersonalFormData = (
  data: Partial<Employee> & { imageFile?: File | null; imageRemoved?: boolean },
  idOverride?: number
) => {
  const payload = {
    personalId: idOverride ?? data.personalId ?? 0,
    personalNombres: data.personalNombres ?? "",
    personalApellidos: data.personalApellidos ?? "",
    areaId: data.areaId ?? 0,
    personalCodigo:
      (data.personalCodigo ?? "").toString().trim().toUpperCase() ?? "",
    personalNacimiento: data.personalNacimiento ?? "",
    personalIngreso: data.personalIngreso ?? "",
    personalDNI: data.personalDni ?? "",
    personalDireccion: data.personalDireccion ?? "",
    personalTelefono: data.personalTelefono ?? "",
    personalEmail: data.personalEmail ?? "",
    personalEstado: data.personalEstado ?? "ACTIVO",
    companiaId: data.companiaId ?? 1,
  };

  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    formData.append(
      key,
      value === null || value === undefined ? "" : String(value)
    );
  });

  if (data.imageFile instanceof File) {
    formData.append("imagen", data.imageFile);
  }
  if (data.imageRemoved) {
    formData.append("eliminarImagen", "true");
  }

  return { formData, payload };
};

export const useEmployeesStore = create<EmployeesState>((set) => ({
  employees: [],
  loading: false,

  fetchEmployees: async (estado = "ACTIVO") => {
    set({ loading: true });
    try {
      const response = await queryClient.fetchQuery({
        queryKey: employeesQueryKey,
        queryFn: async () => {
          const query =
            estado && estado.trim() !== ""
              ? `?estado=${encodeURIComponent(estado)}`
              : "";
          const data = await apiRequest<Personal[]>({
            url: `${buildApiUrl("/Personal/list")}${query}`,
            method: "GET",
            fallback: [],
          });
          return data ?? [];
        },
      });
      set({
        employees: (response ?? []).map(mapApiToEmployee),
        loading: false,
      });
    } catch (error) {
      console.error("Error loading employees", error);
      set({ loading: false });
    }
  },

  addEmployee: async (employee) => {
    const { formData, payload } = buildPersonalFormData(employee, 0);

    const created = await apiRequest<Personal>({
      url: buildApiUrl("/Personal/registerpersonal"),
      method: "POST",
      data: formData,
      fallback: { ...payload, personalId: Date.now() },
    });

    if (
      typeof created === "string" &&
      created.toLowerCase().includes("existe dni")
    ) {
      return false;
    }

    set((state) => ({
      employees: [...state.employees, mapApiToEmployee(created ?? payload)],
    }));
    await queryClient.invalidateQueries({ queryKey: employeesQueryKey });
    return true;
  },

  updateEmployee: async (id, data) => {
    const { formData, payload } = buildPersonalFormData(data, id);

    const updated = await apiRequest<Personal>({
      url: buildApiUrl("/Personal/registerpersonal"),
      method: "POST",
      data: formData,
      fallback: { ...payload },
    });

    if (
      typeof updated === "string" &&
      updated.toLowerCase().includes("existe dni")
    ) {
      return false;
    }

    set((state) => ({
      employees: state.employees.map((e) =>
        String(e.personalId) === String(id)
          ? mapApiToEmployee(updated ?? payload)
          : e
      ),
    }));
    await queryClient.invalidateQueries({ queryKey: employeesQueryKey });
    return true;
  },

  deleteEmployee: async (id) => {
    const result = await apiRequest({
      url: buildApiUrl(`/Personal/${id}`),
      method: "DELETE",
      config: {
        headers: {
          Accept: "*/*",
        },
      },
      fallback: null,
    });

    if (result === false || (result as any)?.status === 500) {
      return false;
    }

    set((state) => ({
      employees: state.employees.filter(
        (e) => String(e.personalId) !== String(id)
      ),
    }));

    await queryClient.invalidateQueries({ queryKey: employeesQueryKey });
    return true;
  },
}));

export interface User {
  UsuarioID: number;
  PersonalId: number;
  UsuarioAlias: string;
  UsuarioClave: string;
  UsuarioFechaReg: string;
  UsuarioEstado: string;
  UsuarioSerie: string;
  EnviaBoleta: number;
  EnviarFactura: number;
  EnviaNC: number;
  EnviaND: number;
  Administrador: number;
  area?: string;
}
