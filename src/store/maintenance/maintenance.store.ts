import { create } from "zustand";
import type {
  Category,
  Area,
  Computer,
  Provider,
  ProviderBankAccount,
  Holiday,
  BankEntity,
} from "@/types/maintenance";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import { queryClient } from "@/shared/queryClient";
import {
  categoriesQueryKey,
  fetchCategoriesApi,
} from "@/features/maintenance/categories/categories.api";
import {
  areasQueryKey,
  fetchAreasApi,
} from "@/features/maintenance/areas/areas.api";
import {
  computersQueryKey,
  fetchComputersApi,
} from "@/features/maintenance/computers/computers.api";
import {
  providersQueryKey,
  fetchProvidersApi,
} from "@/features/maintenance/providers/providers.api";
import {
  holidaysQueryKey,
  fetchHolidaysApi,
  saveHolidayApi,
  deleteHolidayApi,
} from "@/features/maintenance/holidays/holidays.api";
import { API_BASE_URL } from "@/config";

const providerAccountHeaders = {
  Accept: "*/*",
  "Content-Type": "application/json",
};

const isDuplicateHoliday = (result: unknown) => {
  const message =
    typeof result === "string"
      ? result
      : (result as any)?.error ??
        (result as any)?.message ??
        (result as any)?.response?.data ??
        "";

  if (typeof message !== "string") return false;
  const normalized = message.toLowerCase().trim();
  return (
    normalized === "existe feriado" ||
    normalized === "existe_feriado" ||
    normalized === "existe fecha" ||
    normalized.includes("existe feriado") ||
    normalized.includes("existe_feriado") ||
    normalized.includes("existe_fecha")
  );
};

const isDuplicateCategoryResponse = (result: unknown) =>
  typeof result === "string" && result.toLowerCase().includes("existe");

const parseCategoryRegisterResponse = (
  result: unknown,
  fallback: { id: number; nombreSublinea: string; codigoSunat: string }
): Category => {
  if (result && typeof result === "object") {
    const payload = result as Record<string, unknown>;
    const parsedId =
      Number(payload.id ?? payload.idSubLinea ?? fallback.id) || fallback.id;
    const parsedName =
      String(
        payload.nombreSublinea ?? payload.nombre ?? fallback.nombreSublinea
      ) || fallback.nombreSublinea;
    const parsedCode =
      String(payload.codigoSunat ?? fallback.codigoSunat) || fallback.codigoSunat;

    return {
      id: parsedId,
      idSubLinea: parsedId,
      nombreSublinea: parsedName,
      codigoSunat: parsedCode,
    };
  }

  if (typeof result === "string") {
    const [idRaw = "", nameRaw = ""] = result.trim().split("|");
    const parsedId = Number(idRaw.trim());
    if (Number.isFinite(parsedId) && parsedId > 0) {
      const parsedName = nameRaw.trim() || fallback.nombreSublinea;
      return {
        id: parsedId,
        idSubLinea: parsedId,
        nombreSublinea: parsedName,
        codigoSunat: fallback.codigoSunat,
      };
    }
  }

  return {
    id: fallback.id,
    idSubLinea: fallback.id,
    nombreSublinea: fallback.nombreSublinea,
    codigoSunat: fallback.codigoSunat,
  };
};

const mapProviderAccount = (
  item: any,
  fallbackProviderId?: number
): ProviderBankAccount => ({
  cuentaId: Number(item?.cuentaId ?? item?.id ?? 0) || undefined,
  proveedorId:
    Number(item?.proveedorId ?? fallbackProviderId ?? 0) || fallbackProviderId,
  entidad: String(item?.entidad ?? item?.entidadBancaria ?? ""),
  tipoCuenta: String(item?.tipoCuenta ?? item?.tipo ?? ""),
  moneda: String(item?.moneda ?? item?.monedaId ?? ""),
  nroCuenta: String(item?.nroCuenta ?? item?.numeroCuenta ?? ""),
});
type ProviderWithAccounts = Provider & {
  cuentasBancarias?: ProviderBankAccount[];
};

interface MaintenanceState {
  categories: Category[];
  areas: Area[];
  computers: Computer[];
  providers: Provider[];
  holidays: Holiday[];
  bankEntities: BankEntity[];
  loading: boolean;
  setCategories: (items: Category[]) => void;
  setAreas: (items: Area[]) => void;
  setComputers: (items: Computer[]) => void;
  setProviders: (items: Provider[]) => void;
  setHolidays: (items: Holiday[]) => void;
  setBankEntities: (items: BankEntity[]) => void;

  fetchCategories: () => Promise<void>;
  fetchAreas: () => Promise<void>;
  fetchComputers: () => Promise<void>;
  fetchProviders: (estado?: "ACTIVO" | "INACTIVO" | "") => Promise<void>;
  fetchHolidays: () => Promise<void>;
  fetchBankEntities: () => Promise<void>;

  addCategory: (data: Omit<Category, "id">) => Promise<boolean>;
  updateCategory: (id: number, data: Partial<Category>) => Promise<boolean>;
  deleteCategory: (idSubLinea: number) => Promise<boolean>;

  addArea: (data: Omit<Area, "id">) => Promise<boolean>;
  updateArea: (id: number, data: Partial<Area>) => Promise<boolean>;
  deleteArea: (id: number) => Promise<boolean>;

  addComputer: (data: Omit<Computer, "id">) => Promise<void>;
  updateComputer: (id: number, data: Partial<Computer>) => Promise<void>;
  deleteComputer: (id: number) => Promise<boolean>;

  addProvider: (
    data: ProviderWithAccounts & {
      imageFile?: File | null;
      imageRemoved?: boolean;
    }
  ) => Promise<boolean>;
  updateProvider: (
    id: number,
    data: Partial<ProviderWithAccounts> & {
      imageFile?: File | null;
      imageRemoved?: boolean;
    }
  ) => Promise<boolean>;
  fetchProviderAccounts: (providerId: number) => Promise<ProviderBankAccount[]>;
  deleteProvider: (id: number) => Promise<boolean>;

  addHoliday: (data: Omit<Holiday, "id">) => Promise<void>;
  updateHoliday: (id: number, data: Partial<Holiday>) => Promise<void>;
  deleteHoliday: (id: number) => Promise<boolean>;
}

export const useMaintenanceStore = create<MaintenanceState>((set, get) => {
  const sendProviderAccounts = async (
    providerId: number | undefined,
    accounts?: ProviderBankAccount[]
  ): Promise<boolean> => {
    if (!providerId || !accounts?.length) return true;
    const accountsToSend = accounts.filter((a) => a.action);
    if (!accountsToSend.length) return true;
    for (const account of accountsToSend) {
      const payload = {
        cuentaId: account.cuentaId ?? 0,
        proveedorId: providerId,
        entidad: account.entidad,
        tipoCuenta: account.tipoCuenta,
        moneda: account.moneda,
        nroCuenta: account.nroCuenta,
      };

      if (account.action === "i") {
        const created = await apiRequest<any>({
          url: `${API_BASE_URL}/Proveedor/registerCuenta`,
          method: "POST",
          data: payload,
          config: {
            headers: providerAccountHeaders,
          },
          fallback: account,
        });
        if (
          typeof created === "string" &&
          created.toLowerCase().includes("existe cuenta")
        ) {
          toast.error("La cuenta bancaria ya existe");
          return false;
        }
      } else if (account.action === "u") {
        const updated = await apiRequest<any>({
          url: `${API_BASE_URL}/Proveedor/registerCuenta`,
          method: "POST",
          data: payload,
          config: {
            headers: providerAccountHeaders,
          },
          fallback: account,
        });
        if (
          typeof updated === "string" &&
          updated.toLowerCase().includes("existe cuenta")
        ) {
          toast.error("La cuenta bancaria ya existe");
          return false;
        }
      } else if (account.action === "d") {
        if (!account.cuentaId) continue;
        await apiRequest({
          url: `${API_BASE_URL}/Proveedor/cuentas/${account.cuentaId}`,
          method: "DELETE",
          config: {
            headers: {
              Accept: "*/*",
            },
          },
          fallback: account,
        });
      }
    }
    return true;
  };

  const fetchProviderAccountsFn = async (
    providerId: number
  ): Promise<ProviderBankAccount[]> => {
    const response = await apiRequest<any[]>({
      url: `${API_BASE_URL}/Proveedor/${providerId}/cuentas`,
      method: "GET",
      config: {
        headers: {
          Accept: "text/plain",
        },
      },
      fallback: [],
    });
    if (!Array.isArray(response)) return [];
    return response.map((item) => mapProviderAccount(item, providerId));
  };

  return {
    categories: [],
    areas: [],
    computers: [],
    providers: [],
    holidays: [],
    bankEntities: [],
    loading: false,
    setCategories: (items) => set({ categories: items }),
    setAreas: (items) => set({ areas: items }),
    setComputers: (items) => set({ computers: items }),
    setProviders: (items) => set({ providers: items }),
    setHolidays: (items) => set({ holidays: items }),
    setBankEntities: (items) => set({ bankEntities: items }),

    fetchCategories: async () => {
      set({ loading: true });

      try {
        const response = await queryClient.fetchQuery({
          queryKey: categoriesQueryKey,
          queryFn: fetchCategoriesApi,
        });
        set({
          categories: response ?? [],
          loading: false,
        });
      } catch (err) {
        console.error("❌ Error al obtener categorías", err);
        set({ loading: false });
      }
    },

    fetchAreas: async () => {
      set({ loading: true });
      try {
        const response = await queryClient.fetchQuery({
          queryKey: areasQueryKey,
          queryFn: fetchAreasApi,
        });
        set({ areas: response ?? [], loading: false });
      } catch (err) {
        console.error("Error al obtener áreas", err);
        set({ loading: false });
      }
    },

    fetchComputers: async () => {
      set({ loading: true });
      try {
        const response = await queryClient.fetchQuery({
          queryKey: computersQueryKey,
          queryFn: fetchComputersApi,
        });
        set({ computers: response ?? [], loading: false });
      } catch (err) {
        console.error(err);
        set({ loading: false });
      }
    },
    fetchProviders: async (estado = "ACTIVO") => {
      set({ loading: true });
      try {
        const response = await queryClient.fetchQuery({
          queryKey: [...providersQueryKey, estado],
          queryFn: () => fetchProvidersApi(estado),
        });
        set({ providers: response ?? [], loading: false });
      } catch (err) {
        console.error(err);
        set({ loading: false });
      }
    },
    fetchHolidays: async () => {
      set({ loading: true });
      try {
        const response = await queryClient.fetchQuery({
          queryKey: holidaysQueryKey,
          queryFn: fetchHolidaysApi,
        });
        set({ holidays: response ?? [], loading: false });
      } catch (err) {
        console.error("Error al obtener feriados", err);
        set({ loading: false });
      }
    },
    fetchBankEntities: async () => {
      // Endpoint no disponible actualmente; usar fallback local para evitar llamadas erróneas.
      set({
        bankEntities: [
          { id: 1, nombre: "BCP" },
          { id: 2, nombre: "Interbank" },
          { id: 3, nombre: "Scotiabank" },
        ],
      });
    },

    // CRUD
    addCategory: async (data) => {
      const fallbackId = Date.now();
      const fallbackCategory = {
        id: fallbackId,
        nombreSublinea: data.nombreSublinea,
        codigoSunat: data.codigoSunat,
      };
      const payload = {
        idSubLinea: 0,
        nombreSublinea: data.nombreSublinea,
        codigoSunat: data.codigoSunat,
      };

      const created = await apiRequest<unknown>({
        url: `${API_BASE_URL}/Linea/registerlinea`,
        method: "POST",
        data: payload,
        config: {
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
          },
        },
        fallback: fallbackCategory,
      });

      if (isDuplicateCategoryResponse(created)) {
        toast.error("Ya existe esa categoria");
        return false;
      }

      const nextCategory = parseCategoryRegisterResponse(created, fallbackCategory);

      set((state) => ({
        categories: [...state.categories, nextCategory],
      }));

      await queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
      return true;
    },

    updateCategory: async (id, data) => {
      const previousCategory = get().categories.find(
        (c) => String(c.id ?? c.idSubLinea) === String(id)
      );
      const fallbackCategory = {
        id,
        nombreSublinea:
          data.nombreSublinea ??
          data.nombre ??
          previousCategory?.nombreSublinea ??
          "",
        codigoSunat: data.codigoSunat ?? previousCategory?.codigoSunat ?? "",
      };

      const payload = {
        idSubLinea: id,
        nombreSublinea: fallbackCategory.nombreSublinea,
        codigoSunat: fallbackCategory.codigoSunat,
      };

      const updated = await apiRequest<unknown>({
        url: `${API_BASE_URL}/Linea/registerlinea`,
        method: "POST",
        data: payload,
        config: {
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
          },
        },
        fallback: fallbackCategory,
      });

      if (isDuplicateCategoryResponse(updated)) {
        toast.error("Ya existe esa categoria");
        return false;
      }

      const nextCategory = parseCategoryRegisterResponse(updated, fallbackCategory);

      set((state) => ({
        categories: state.categories.map((c) =>
          String(c.id ?? c.idSubLinea) === String(id)
            ? {
                ...c,
                ...data,
                ...nextCategory,
              }
            : c
        ),
      }));

      await queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
      return true;
    },

    deleteCategory: async (idSubLinea) => {
      const result = await apiRequest({
        url: `${API_BASE_URL}/Linea/${idSubLinea}`,
        method: "DELETE",
        config: {
          headers: {
            Accept: "*/*",
          },
        },
        fallback: null,
      });
      if (!result) {
        return false;
      } else {
        set((state) => ({
          categories: state.categories.filter(
            (c) => String(c.id) !== String(idSubLinea)
          ),
        }));

        await queryClient.invalidateQueries({ queryKey: categoriesQueryKey });
        return true;
      }
    },

    addArea: async (data) => {
      const payload = {
        areaId: 0,
        areaNombre: data.area,
      };

      const created = await apiRequest<{
        areaId?: number;
        areaNombre?: string;
      }>({
        url: `${API_BASE_URL}/Area/registerarea`,
        method: "POST",
        data: payload,
        config: {
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
          },
        },
        fallback: { ...data, id: Date.now() },
      });

      if (
        typeof created === "string" &&
        created.toLowerCase().includes("existe")
      ) {
        toast.error("Ya existe esta area");
        return false;
      }

      const hasCreatedId =
        created &&
        typeof created === "object" &&
        ("areaId" in (created as any) || "id" in (created as any));

      if (hasCreatedId) {
        const idValue = (created as any).id ?? (created as any).areaId;
        const areaValue =
          (created as any).nombre ?? (created as any).areaNombre ?? data.area;
        set((state) => ({
          areas: [...state.areas, { id: idValue, area: areaValue }],
        }));
      } else {
        set((state) => ({
          areas: [...state.areas, { ...data, id: Date.now() }],
        }));
      }
      await queryClient.invalidateQueries({ queryKey: areasQueryKey });
      return true;
    },
    updateArea: async (id, data) => {
      const payload = {
        areaId: id,
        areaNombre: data.area ?? "",
      };

      const updated = await apiRequest<{
        areaId?: number;
        areaNombre?: string;
      }>({
        url: `${API_BASE_URL}/Area/registerarea`,
        method: "POST",
        data: payload,
        config: {
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
          },
        },
        fallback: { ...data, id },
      });

      if (
        typeof updated === "string" &&
        updated.toLowerCase().includes("existe")
      ) {
        toast.error("Ya existe esta area");
        return false;
      }

      set((state) => ({
        areas: state.areas.map((a) => {
          if (a.id !== id) return a;
          const hasUpdatedId =
            updated &&
            typeof updated === "object" &&
            ("areaId" in (updated as any) || "id" in (updated as any));
          if (hasUpdatedId) {
            return {
              id: (updated as any).id ?? (updated as any).areaId ?? id,
              area:
                (updated as any).nombre ??
                (updated as any).areaNombre ??
                data.area ??
                a.area,
            };
          }
          return { ...a, ...data };
        }),
      }));

      await queryClient.invalidateQueries({ queryKey: areasQueryKey });
      return true;
    },
    deleteArea: async (id) => {
      const result = await apiRequest({
        url: `${API_BASE_URL}/Area/${id}`,
        method: "DELETE",
        config: {
          headers: {
            Accept: "*/*",
          },
        },
        fallback: null,
      });

      if (!result) {
        return false;
      }

      set((state) => ({ areas: state.areas.filter((a) => a.id !== id) }));
      await queryClient.invalidateQueries({ queryKey: areasQueryKey });
      return true;
    },

    addComputer: async (data) => {
      const payload = {
        idMaquina: 0,
        nombreMaquina: data.maquina,
        registro: data.registro,
        serieFactura: data.serieFactura,
        serieNC: data.serieNc,
        serieBoleta: data.serieBoleta,
        tiketera: data.ticketera,
      };

      const created = await apiRequest<{
        idMaquina?: number;
        nombreMaquina?: string;
        registro?: string;
        serieFactura?: string;
        serieNC?: string;
        serieBoleta?: string;
        tiketera?: string;
      }>({
        url: `${API_BASE_URL}/Maquina/registermaquina`,
        method: "POST",
        data: payload,
        config: {
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
          },
        },
        fallback: { ...data, id: Date.now() },
      });

      if (
        typeof created === "string" &&
        created.toLowerCase().includes("existe")
      ) {
        toast.error("Ya existe esta maquina registrada");
        return false;
      }

      if (
        created &&
        typeof created === "object" &&
        ("idMaquina" in created || "id" in created)
      ) {
        set((state) => ({
          computers: [
            ...state.computers,
            {
              id: (created as any).id ?? (created as any).idMaquina,
              maquina: (created as any).nombreMaquina ?? data.maquina,
              registro: (created as any).registro ?? data.registro,
              serieFactura: (created as any).serieFactura ?? data.serieFactura,
              serieNc: (created as any).serieNC ?? data.serieNc,
              serieBoleta: (created as any).serieBoleta ?? data.serieBoleta,
              ticketera: (created as any).tiketera ?? data.ticketera,
              areaId: data.areaId ?? 0,
            },
          ],
        }));
      } else {
        set((state) => ({
          computers: [...state.computers, { ...data, id: Date.now() }],
        }));
      }

      await queryClient.invalidateQueries({ queryKey: computersQueryKey });
      return true;
    },
    updateComputer: async (id, data) => {
      const payload = {
        idMaquina: id,
        nombreMaquina: data.maquina ?? "",
        registro: data.registro ?? "",
        serieFactura: data.serieFactura ?? "",
        serieNC: data.serieNc ?? "",
        serieBoleta: data.serieBoleta ?? "",
        tiketera: data.ticketera ?? "",
      };

      const updated = await apiRequest<{
        idMaquina?: number;
        nombreMaquina?: string;
        registro?: string;
        serieFactura?: string;
        serieNC?: string;
        serieBoleta?: string;
        tiketera?: string;
      }>({
        url: `${API_BASE_URL}/Maquina/registermaquina`,
        method: "POST",
        data: payload,
        config: {
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
          },
        },
        fallback: { ...data, id },
      });

      if (
        typeof updated === "string" &&
        updated.toLowerCase().includes("existe")
      ) {
        toast.error("Ya existe un registro con ese nombre");
        return false;
      }

      set((state) => ({
        computers: state.computers.map((c) => {
          if (c.id !== id) return c;
          if (
            updated &&
            typeof updated === "object" &&
            ("idMaquina" in (updated as any) || "id" in (updated as any))
          ) {
            return {
              id: (updated as any).id ?? (updated as any).idMaquina ?? id,
              maquina:
                (updated as any).nombreMaquina ?? data.maquina ?? c.maquina,
              registro:
                (updated as any).registro ?? data.registro ?? c.registro,
              serieFactura:
                (updated as any).serieFactura ??
                data.serieFactura ??
                c.serieFactura,
              serieNc: (updated as any).serieNC ?? data.serieNc ?? c.serieNc,
              serieBoleta:
                (updated as any).serieBoleta ??
                data.serieBoleta ??
                c.serieBoleta,
              ticketera:
                (updated as any).tiketera ?? data.ticketera ?? c.ticketera,
              areaId: c.areaId,
            };
          }
          return { ...c, ...data };
        }),
      }));

      await queryClient.invalidateQueries({ queryKey: computersQueryKey });
      return true;
    },
    deleteComputer: async (id) => {
      const result = await apiRequest({
        url: `${API_BASE_URL}/Maquina/${id}`,
        method: "DELETE",
        config: {
          headers: {
            Accept: "*/*",
          },
        },
        fallback: null,
      });

      if (!result) {
        return false;
      }

      set((state) => ({
        computers: state.computers.filter((c) => c.id !== id),
      }));
      await queryClient.invalidateQueries({ queryKey: computersQueryKey });
      return true;
    },

    addProvider: async (
      data: ProviderWithAccounts & {
        imageFile?: File | null;
        imageRemoved?: boolean;
      }
    ) => {
      const payload = {
        proveedorId: 0,
        proveedorRazon: data.razon,
        proveedorRuc: data.ruc,
        proveedorContacto: data.contacto,
        proveedorCelular: data.celular,
        proveedorTelefono: data.telefono,
        proveedorCorreo: data.correo,
        proveedorDireccion: data.direccion,
        proveedorEstado: data.estado,
        eliminarImagen: data.imageRemoved ? "true" : undefined,
      };

      const hasFile = data.imageFile instanceof File;
      const requestData = hasFile ? new FormData() : payload;
      const requestConfig = hasFile
        ? undefined
        : {
            headers: {
              Accept: "*/*",
              "Content-Type": "application/json",
            },
          };

      if (hasFile && requestData instanceof FormData) {
        Object.entries(payload).forEach(([key, value]) => {
          if (value === undefined) return;
          requestData.append(key, value ?? "");
        });
        requestData.append("imagen", data.imageFile as File);
      }

      const created = await apiRequest<any>({
        url: `${API_BASE_URL}/Proveedor/register`,
        method: "POST",
        data: requestData as any,
        config: requestConfig,
        fallback: { ...data, id: Date.now() },
      });

      if (
        typeof created === "string" &&
        created.toLowerCase().includes("existe") &&
        created.toLowerCase().includes("ruc")
      ) {
        toast.error(created);
        return false;
      }

      const hasCreatedId =
        created &&
        typeof created === "object" &&
        ("proveedorId" in (created as any) || "id" in (created as any));
      const providerId = hasCreatedId
        ? Number((created as any).id ?? (created as any).proveedorId)
        : undefined;

      if (data.cuentasBancarias?.length) {
        const okAccounts = await sendProviderAccounts(
          providerId,
          data.cuentasBancarias
        );
        if (!okAccounts) return false;
      }

      const mapped = hasCreatedId
        ? {
            id: (created as any).id ?? (created as any).proveedorId,
            razon:
              (created as any).proveedorRazon ??
              (created as any).razon ??
              data.razon,
            ruc: (created as any).proveedorRuc ?? data.ruc,
            contacto: (created as any).proveedorContacto ?? data.contacto,
            celular: (created as any).proveedorCelular ?? data.celular,
            telefono: (created as any).proveedorTelefono ?? data.telefono,
            correo: (created as any).proveedorCorreo ?? data.correo,
            direccion: (created as any).proveedorDireccion ?? data.direccion,
            estado: (created as any).proveedorEstado ?? data.estado,
            imagen:
              (created as any).proveedorImagen ??
              (created as any).imagen ??
              null,
            images:
              (created as any).proveedorImagen || (created as any).imagen
                ? [
                    String(
                      (created as any).proveedorImagen ??
                        (created as any).imagen
                    ),
                  ]
                : [],
            cuentasBancarias: data.cuentasBancarias,
          }
        : { ...data, id: Date.now(), images: [], imagen: null };

      set((state) => ({
        providers: [...state.providers, mapped as Provider],
      }));

      await queryClient.invalidateQueries({ queryKey: providersQueryKey });
      return true;
    },

    updateProvider: async (
      id,
      data: Partial<ProviderWithAccounts> & {
        imageFile?: File | null;
        imageRemoved?: boolean;
      }
    ) => {
      const payload = {
        proveedorId: id,
        proveedorRazon: data.razon ?? "",
        proveedorRuc: data.ruc ?? "",
        proveedorContacto: data.contacto ?? "",
        proveedorCelular: data.celular ?? "",
        proveedorTelefono: data.telefono ?? "",
        proveedorCorreo: data.correo ?? "",
        proveedorDireccion: data.direccion ?? "",
        proveedorEstado: data.estado ?? "",
        eliminarImagen: data.imageRemoved ? "true" : undefined,
      };

      const hasFile = data.imageFile instanceof File;
      const requestData = hasFile ? new FormData() : payload;
      const requestConfig = hasFile
        ? undefined
        : {
            headers: {
              Accept: "*/*",
              "Content-Type": "application/json",
            },
          };

      if (hasFile && requestData instanceof FormData) {
        Object.entries(payload).forEach(([key, value]) => {
          if (value === undefined) return;
          requestData.append(key, value ?? "");
        });
        requestData.append("imagen", data.imageFile as File);
      }

      const updated = await apiRequest<any>({
        url: `${API_BASE_URL}/Proveedor/register`,
        method: "POST",
        data: requestData as any,
        config: requestConfig,
        fallback: { ...data, id },
      });

      if (
        typeof updated === "string" &&
        updated.toLowerCase().includes("existe") &&
        updated.toLowerCase().includes("ruc")
      ) {
        toast.error(updated);
        return false;
      }

      if (data.cuentasBancarias?.length) {
        const okAccounts = await sendProviderAccounts(
          id,
          data.cuentasBancarias
        );
        if (!okAccounts) return false;
      }

      set((state) => ({
        providers: state.providers.map((p) => {
          if (p.id !== id) return p;
          const hasUpdatedId =
            updated &&
            typeof updated === "object" &&
            ("proveedorId" in (updated as any) || "id" in (updated as any));
          if (hasUpdatedId) {
            return {
              id: (updated as any).id ?? (updated as any).proveedorId ?? id,
              razon:
                (updated as any).proveedorRazon ??
                (updated as any).razon ??
                data.razon ??
                p.razon,
              ruc: (updated as any).proveedorRuc ?? data.ruc ?? p.ruc,
              contacto:
                (updated as any).proveedorContacto ??
                data.contacto ??
                p.contacto,
              celular:
                (updated as any).proveedorCelular ?? data.celular ?? p.celular,
              telefono:
                (updated as any).proveedorTelefono ??
                data.telefono ??
                p.telefono,
              correo:
                (updated as any).proveedorCorreo ?? data.correo ?? p.correo,
              direccion:
                (updated as any).proveedorDireccion ??
                data.direccion ??
                p.direccion,
              estado:
                (updated as any).proveedorEstado ?? data.estado ?? p.estado,
              imagen:
                (updated as any).proveedorImagen ??
                (updated as any).imagen ??
                p.imagen ??
                null,
              images:
                (updated as any).proveedorImagen || (updated as any).imagen
                  ? [
                      String(
                        (updated as any).proveedorImagen ??
                          (updated as any).imagen
                      ),
                    ]
                  : p.images ?? [],
              cuentasBancarias: data.cuentasBancarias ?? p.cuentasBancarias,
            };
          }
          return {
            ...p,
            ...data,
            cuentasBancarias: data.cuentasBancarias ?? p.cuentasBancarias,
          };
        }),
      }));

      await queryClient.invalidateQueries({ queryKey: providersQueryKey });
      return true;
    },

    deleteProvider: async (id) => {
      const result = await apiRequest({
        url: `${API_BASE_URL}/Proveedor/${id}`,
        method: "DELETE",
        config: {
          headers: {
            Accept: "*/*",
          },
        },
        fallback: null,
      });

      if (!result) {
        return false;
      }

      set((state) => ({
        providers: state.providers.filter((p) => p.id !== id),
      }));
      await queryClient.invalidateQueries({ queryKey: providersQueryKey });
      return true;
    },

    addHoliday: async (data) => {
      const created = await saveHolidayApi({
        id: 0,
        fecha: data.fecha,
        motivo: data.motivo?.toUpperCase?.() ?? data.motivo,
      });

      if (isDuplicateHoliday(created)) {
        toast.error("Esa fecha ya está registrada");
        return false;
      }

      set((state) => ({
        holidays: [
          ...state.holidays.filter((h) => String(h.id) !== String(created.id)),
          created as any,
        ],
      }));

      await queryClient.invalidateQueries({ queryKey: holidaysQueryKey });
      return true;
    },

    updateHoliday: async (id, data) => {
      const updated = await saveHolidayApi({
        id,
        fecha: data.fecha ?? "",
        motivo: data.motivo?.toUpperCase?.() ?? data.motivo ?? "",
      });

      if (isDuplicateHoliday(updated)) {
        toast.error("Esa fecha ya está registrada");
        return false;
      }

      set((state) => ({
        holidays: state.holidays.map((h) =>
          String(h.id) === String(id) ? { ...h, ...updated } : h
        ),
      }));

      await queryClient.invalidateQueries({ queryKey: holidaysQueryKey });
      return true;
    },

    deleteHoliday: async (id) => {
      const result = await deleteHolidayApi(id);
      if (!result) return false;

      set((state) => ({
        holidays: state.holidays.filter((h) => h.id !== id),
      }));

      await queryClient.invalidateQueries({ queryKey: holidaysQueryKey });
      return true;
    },
    fetchProviderAccounts: fetchProviderAccountsFn,
  };
});
