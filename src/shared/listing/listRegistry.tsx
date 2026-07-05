import { useCallback, useState, type ReactNode } from "react";
import { toast } from "@/shared/ui/toast";
import { useEmployeesStore } from "@/store/employees/employees.store";
import { useMaintenanceStore } from "@/store/maintenance/maintenance.store";
import { useDialogStore } from "@/store/app/dialog.store";
import { useCategoriesQuery } from "@/features/maintenance/categories/useCategoriesQuery";
import { useAreasQuery } from "@/features/maintenance/areas/useAreasQuery";
import { useProvidersQuery } from "@/features/maintenance/providers/useProvidersQuery";
import { useHolidaysQuery } from "@/features/maintenance/holidays/useHolidaysQuery";
import { useClientsStore } from "@/store/customers/customers.store";
import { useUsersStore } from "@/store/users/users.store";
import CategoriaForm from "@/components/maintenance/CategoriaForm";
import AreaForm from "@/components/maintenance/AreaForm";
import ProviderForm from "@/components/maintenance/ProviderForm";
import HolidayForm from "@/components/maintenance/HolidayForm";
import UserFormBase from "@/components/UserFormBase";
import { employeeListConfig } from "@/features/maintenance/employees/employee.list.config";
import { categoryListConfig } from "@/features/maintenance/categories/categories.list.config";
import { areaListConfig } from "@/features/maintenance/areas/area.list.config";
import { providerListConfig } from "@/features/maintenance/providers/provider.list.config";
import { holidaysListConfig } from "@/features/maintenance/holidays/holidays.list.config";
import { userListConfig } from "@/features/maintenance/users/user.list.config";
import { customerListConfig } from "@/features/customers/customer.list.config";
import type { ModuleListConfig } from "@/shared/config/listConfig";
import type {
  Area,
  Category,
  Holiday,
  Provider,
  ProviderBankAccount,
} from "@/types/maintenance";
import type { User } from "@/store/users/users.store";

const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
const PASSWORD_POLICY_MESSAGE =
  "La contrasena debe tener minimo 6 caracteres, una mayuscula, una minuscula y un numero";

const useEmployeeListDeps = () => {
  const { employees, fetchEmployees, deleteEmployee } = useEmployeesStore();
  return {
    data: employees,
    fetchData: fetchEmployees,
    deleteItem: deleteEmployee,
  };
};

const useCategoryListDeps = () => {
  const openDialog = useDialogStore((s) => s.openDialog);
  const {
    addCategory,
    updateCategory,
    deleteCategory,
  } = useMaintenanceStore();
  const { data = [], refetch } = useCategoriesQuery();

  const onCreate = useCallback(() => {
    openDialog({
      title: "Crear categoria",
      content: <CategoriaForm variant="modal" mode="create" onSave={() => {}} />,
      confirmText: "Crear",
      cancelText: "Cancelar",
      maxWidth: "md",
      fullWidth: true,
      onConfirm: async (rawData) => {
        const data = (rawData ?? {}) as Partial<Category>;
        const nombreSublinea = (data.nombreSublinea ?? "").trim().toUpperCase();
        if (!nombreSublinea) {
          toast.error("El nombre de la categoria es obligatorio");
          return false;
        }
        const created = await addCategory({
          nombreSublinea,
          codigoSunat: data.codigoSunat ?? "",
        } as Omit<Category, "id">);
        if (!created) {
          return false;
        }
        await refetch();
        toast.success("Categoria creada correctamente");
        return true;
      },
    });
  }, [openDialog, addCategory, refetch]);

  const onEdit = useCallback(
    (row: Category, id: number) => {
      openDialog({
        title: "Editar categoria",
        content: (
          <CategoriaForm
            variant="modal"
            mode="edit"
            initialData={row}
            onSave={() => {}}
          />
        ),
        confirmText: "Guardar",
        cancelText: "Cancelar",
        maxWidth: "md",
        fullWidth: true,
        onConfirm: async (rawData) => {
          const data = (rawData ?? {}) as Partial<Category>;
          const nombreSublinea = (data.nombreSublinea ?? "").trim().toUpperCase();
          if (!nombreSublinea) {
            toast.error("El nombre de la categoria es obligatorio");
            return false;
          }
          const updated = await updateCategory(id, {
            ...data,
            nombreSublinea,
          });
          if (!updated) {
            return false;
          }
          await refetch();
          toast.success("Categoria actualizada");
          return true;
        },
      });
    },
    [openDialog, refetch, updateCategory]
  );

  return {
    data,
    fetchData: refetch,
    deleteItem: deleteCategory,
    onCreate,
    onEdit,
  };
};

const useAreaListDeps = () => {
  const openDialog = useDialogStore((s) => s.openDialog);
  const { addArea, updateArea, deleteArea } = useMaintenanceStore();
  const { data = [], refetch } = useAreasQuery();

  const onCreate = useCallback(() => {
    openDialog({
      title: "Crear area",
      content: <AreaForm variant="modal" mode="create" onSave={() => {}} />,
      confirmText: "Crear",
      cancelText: "Cancelar",
      maxWidth: "sm",
      fullWidth: true,
      onConfirm: async (rawData) => {
        const data = (rawData ?? {}) as Partial<Area>;
        const area = (data.area ?? "").trim().toUpperCase();
        if (!area) {
          toast.error("El nombre del area es obligatorio");
          return false;
        }
        const created = await addArea({ area } as Omit<Area, "id">);
        if (!created) {
          return false;
        }
        await refetch();
        toast.success("Area creada correctamente");
        return true;
      },
    });
  }, [openDialog, addArea, refetch]);

  const onEdit = useCallback(
    (row: Area, id: number) => {
      openDialog({
        title: "Editar area",
        content: (
          <AreaForm
            variant="modal"
            mode="edit"
            initialData={row}
            onSave={() => {}}
          />
        ),
        confirmText: "Guardar",
        cancelText: "Cancelar",
        maxWidth: "sm",
        fullWidth: true,
        onConfirm: async (rawData) => {
          const data = (rawData ?? {}) as Partial<Area>;
          const area = (data.area ?? "").trim().toUpperCase();
          if (!area) {
            toast.error("El nombre del area es obligatorio");
            return false;
          }
          const updated = await updateArea(id, { area });
          if (!updated) {
            return false;
          }
          await refetch();
          toast.success("Area actualizada");
          return true;
        },
      });
    },
    [openDialog, refetch, updateArea]
  );

  return {
    data,
    fetchData: refetch,
    deleteItem: deleteArea,
    onCreate,
    onEdit,
  };
};

const useProviderListDeps = () => {
  const openDialog = useDialogStore((s) => s.openDialog);
  const {
    addProvider,
    updateProvider,
    deleteProvider,
    fetchProviderAccounts,
  } = useMaintenanceStore();
  const [estado, setEstado] = useState<"ACTIVO" | "INACTIVO">("ACTIVO");
  const { data = [], refetch } = useProvidersQuery(estado);
  const fetchData = useCallback(() => refetch(), [refetch]);

  const onCreate = useCallback(() => {
    openDialog({
      title: "Crear proveedor",
      content: <ProviderForm variant="modal" mode="create" onSave={() => {}} />,
      confirmText: "Crear",
      cancelText: "Cancelar",
      maxWidth: "lg",
      fullWidth: true,
      onConfirm: async (rawData) => {
        const data = (rawData ?? {}) as Provider & {
          cuentasBancarias?: ProviderBankAccount[];
        };
        const razon = (data.razon ?? "").trim().toUpperCase();
        if (!razon) {
          toast.error("La razon social es obligatoria");
          return false;
        }
        const created = await addProvider({
          ...data,
          razon,
          contacto: data.contacto?.toUpperCase() ?? "",
          direccion: data.direccion?.toUpperCase() ?? "",
          estado: data.estado?.toUpperCase() ?? "ACTIVO",
        });
        if (!created) {
          return false;
        }
        await refetch();
        toast.success("Proveedor creado correctamente");
        return true;
      },
    });
  }, [openDialog, addProvider, refetch]);

  const onEdit = useCallback(
    async (row: Provider, id: number) => {
      const initialAccounts = await fetchProviderAccounts(id);
      openDialog({
        title: "Editar proveedor",
        content: (
          <ProviderForm
            variant="modal"
            mode="edit"
            initialData={row}
            initialAccounts={initialAccounts}
            onSave={() => {}}
          />
        ),
        confirmText: "Guardar",
        cancelText: "Cancelar",
        maxWidth: "lg",
        fullWidth: true,
        onConfirm: async (rawData) => {
          const data = (rawData ?? {}) as Partial<Provider> & {
            cuentasBancarias?: ProviderBankAccount[];
          };
          const razon = (data.razon ?? "").trim().toUpperCase();
          if (!razon) {
            toast.error("La razon social es obligatoria");
            return false;
          }
          const updated = await updateProvider(id, {
            ...data,
            razon,
            contacto: data.contacto?.toUpperCase() ?? "",
            direccion: data.direccion?.toUpperCase() ?? "",
            estado: data.estado?.toUpperCase() ?? "ACTIVO",
          });
          if (!updated) {
            return false;
          }
          await refetch();
          toast.success("Proveedor actualizado");
          return true;
        },
      });
    },
    [fetchProviderAccounts, openDialog, refetch, updateProvider]
  );

  return {
    data,
    fetchData,
    deleteItem: deleteProvider,
    onCreate,
    onEdit,
    renderFilters: (
      <div className="flex items-center gap-2">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as "ACTIVO" | "INACTIVO")}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          <option value="ACTIVO">Activos</option>
          <option value="INACTIVO">Inactivos</option>
        </select>
      </div>
    ),
  };
};

const useHolidayListDeps = () => {
  const openDialog = useDialogStore((s) => s.openDialog);
  const { addHoliday, updateHoliday, deleteHoliday } = useMaintenanceStore();
  const { data = [], refetch } = useHolidaysQuery();

  const onCreate = useCallback(() => {
    openDialog({
      title: "Crear feriado",
      content: <HolidayForm variant="modal" mode="create" onSave={() => {}} />,
      confirmText: "Crear",
      cancelText: "Cancelar",
      maxWidth: "sm",
      fullWidth: true,
      onConfirm: async (rawData) => {
        const data = (rawData ?? {}) as Partial<Holiday>;
        const motivo = (data.motivo ?? "").trim().toUpperCase();
        if (!motivo || !data.fecha) {
          toast.error("Fecha y motivo son obligatorios");
          return false;
        }
        const created = await (addHoliday({
          fecha: data.fecha,
          motivo,
        } as Omit<Holiday, "id">) as any);
        if (created === false) {
          return false;
        }
        await refetch();
        toast.success("Feriado creado correctamente");
        return true;
      },
    });
  }, [openDialog, addHoliday, refetch]);

  const onEdit = useCallback(
    (row: Holiday, id: number) => {
      openDialog({
        title: "Editar feriado",
        content: (
          <HolidayForm
            variant="modal"
            mode="edit"
            initialData={row}
            onSave={() => {}}
          />
        ),
        confirmText: "Guardar",
        cancelText: "Cancelar",
        maxWidth: "sm",
        fullWidth: true,
        onConfirm: async (rawData) => {
          const data = (rawData ?? {}) as Partial<Holiday>;
          const motivo = (data.motivo ?? "").trim().toUpperCase();
          if (!motivo || !data.fecha) {
            toast.error("Fecha y motivo son obligatorios");
            return false;
          }
          const updated = await (updateHoliday(id, {
            fecha: data.fecha,
            motivo,
          }) as any);
          if (updated === false) {
            return false;
          }
          await refetch();
          toast.success("Feriado actualizado");
          return true;
        },
      });
    },
    [openDialog, refetch, updateHoliday]
  );

  return {
    data,
    fetchData: refetch,
    deleteItem: deleteHoliday,
    onCreate,
    onEdit,
  };
};

const useCustomerListDeps = () => {
  const { clients, fetchClients, deleteClient } = useClientsStore();
  return {
    data: clients,
    fetchData: fetchClients,
    deleteItem: deleteClient,
  };
};

const useUserListDeps = () => {
  const openDialog = useDialogStore((s) => s.openDialog);
  const {
    users,
    fetchUsers,
    addUser,
    updateUser,
    deleteUser,
  } = useUsersStore();
  const [estado, setEstado] = useState<"ACTIVO" | "INACTIVO">("ACTIVO");

  const fetchData = useCallback(() => fetchUsers(estado), [fetchUsers, estado]);

  const onCreate = useCallback(() => {
    openDialog({
      title: "Crear usuario",
      content: <UserFormBase variant="modal" mode="create" onSave={() => true} />,
      confirmText: "Crear",
      cancelText: "Cancelar",
      maxWidth: "sm",
      fullWidth: true,
      onConfirm: async (rawData) => {
        const data = (rawData ?? {}) as Partial<User> & {
          ConfirmClave?: string;
        };
        const alias = (data.UsuarioAlias ?? "").trim();
        const clave = data.UsuarioClave ?? "";
        const confirm = data.ConfirmClave ?? "";

        if (!Number(data.PersonalId)) {
          toast.error("Seleccione personal");
          return false;
        }
        if (!alias) {
          toast.error("El alias es obligatorio");
          return false;
        }
        if (!clave || !confirm || clave !== confirm) {
          toast.error("Las contrasenas no coinciden");
          return false;
        }
        if (!PASSWORD_POLICY_REGEX.test(clave)) {
          toast.error(PASSWORD_POLICY_MESSAGE);
          return false;
        }

        const created = await addUser({
          PersonalId: Number(data.PersonalId),
          UsuarioAlias: alias,
          UsuarioClave: clave,
          UsuarioFechaReg: data.UsuarioFechaReg ?? new Date().toISOString(),
          UsuarioEstado: data.UsuarioEstado ?? "ACTIVO",
          UsuarioSerie: data.UsuarioSerie ?? "B001",
          EnviaBoleta: data.EnviaBoleta ?? 0,
          EnviarFactura: data.EnviarFactura ?? 0,
          EnviaNC: data.EnviaNC ?? 0,
          EnviaND: data.EnviaND ?? 0,
          Administrador: data.Administrador ?? 0,
          area: data.area,
        });

        if (!created) {
          return false;
        }

        await fetchUsers(estado);
        toast.success("Usuario creado correctamente");
        return true;
      },
    });
  }, [openDialog, addUser, fetchUsers, estado]);

  const onEdit = useCallback(
    (row: User, id: number) => {
      openDialog({
        title: "Editar usuario",
        content: (
          <UserFormBase
            variant="modal"
            mode="edit"
            initialData={row}
            onSave={() => true}
          />
        ),
        confirmText: "Guardar",
        cancelText: "Cancelar",
        maxWidth: "sm",
        fullWidth: true,
        onConfirm: async (rawData) => {
          const data = (rawData ?? {}) as Partial<User> & {
            ConfirmClave?: string;
          };
          const alias = (data.UsuarioAlias ?? "").trim();
          const clave = data.UsuarioClave ?? "";
          const confirm = data.ConfirmClave ?? "";

          if (!Number(data.PersonalId)) {
            toast.error("Seleccione personal");
            return false;
          }
          if (!alias) {
            toast.error("El alias es obligatorio");
            return false;
          }
          if (!clave || !confirm || clave !== confirm) {
            toast.error("Las contrasenas no coinciden");
            return false;
          }
          if (!PASSWORD_POLICY_REGEX.test(clave)) {
            toast.error(PASSWORD_POLICY_MESSAGE);
            return false;
          }

          const updated = await updateUser(id, {
            PersonalId: Number(data.PersonalId),
            UsuarioAlias: alias,
            UsuarioClave: clave,
            UsuarioFechaReg: data.UsuarioFechaReg ?? row.UsuarioFechaReg,
            UsuarioEstado: data.UsuarioEstado ?? row.UsuarioEstado ?? "ACTIVO",
            UsuarioSerie: data.UsuarioSerie ?? row.UsuarioSerie ?? "B001",
            EnviaBoleta: data.EnviaBoleta ?? row.EnviaBoleta ?? 0,
            EnviarFactura: data.EnviarFactura ?? row.EnviarFactura ?? 0,
            EnviaNC: data.EnviaNC ?? row.EnviaNC ?? 0,
            EnviaND: data.EnviaND ?? row.EnviaND ?? 0,
            Administrador: data.Administrador ?? row.Administrador ?? 0,
            area: row.area,
          });

          if (!updated) {
            return false;
          }

          await fetchUsers(estado);
          toast.success("Usuario actualizado");
          return true;
        },
      });
    },
    [openDialog, updateUser, fetchUsers, estado]
  );

  return {
    data: users,
    fetchData,
    deleteItem: deleteUser,
    onCreate,
    onEdit,
    renderFilters: (
      <div className="flex items-center gap-2">
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value as "ACTIVO" | "INACTIVO")}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        >
          <option value="ACTIVO">Activos</option>
          <option value="INACTIVO">Inactivos</option>
        </select>
      </div>
    ),
  };
};

type ListDeps<T> = {
  data: T[];
  fetchData: () => Promise<unknown> | void;
  deleteItem: (id: number) => Promise<boolean | void> | boolean | void;
  renderFilters?: ReactNode;
  onCreate?: () => void;
  onEdit?: (row: T, id: number) => void | Promise<void>;
};

type ListModuleEntry<T> = {
  config: ModuleListConfig<T>;
  useDeps: () => ListDeps<T>;
};

export const listRegistry = {
  employees: {
    config: employeeListConfig,
    useDeps: useEmployeeListDeps,
  } satisfies ListModuleEntry<any>,

  categories: {
    config: categoryListConfig,
    useDeps: useCategoryListDeps,
  } satisfies ListModuleEntry<any>,

  areas: {
    config: areaListConfig,
    useDeps: useAreaListDeps,
  } satisfies ListModuleEntry<any>,

  providers: {
    config: providerListConfig,
    useDeps: useProviderListDeps,
  } satisfies ListModuleEntry<any>,

  holidays: {
    config: holidaysListConfig,
    useDeps: useHolidayListDeps,
  } satisfies ListModuleEntry<any>,

  customers: {
    config: customerListConfig,
    useDeps: useCustomerListDeps,
  } satisfies ListModuleEntry<any>,

  users: {
    config: userListConfig,
    useDeps: useUserListDeps,
  } satisfies ListModuleEntry<any>,
} as const;

export type ListModuleKey = keyof typeof listRegistry;
