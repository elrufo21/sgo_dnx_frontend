import { create } from "zustand";

import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import type { User } from "../employees/employees.store";
import { toast } from "@/shared/ui/toast";
export type { User } from "../employees/employees.store";

interface UsersState {
  users: User[];
  loading: boolean;

  fetchUsers: (estado?: "ACTIVO" | "INACTIVO" | "") => Promise<void>;
  addUser: (user: Omit<User, "UsuarioID">) => Promise<boolean>;
  updateUser: (id: number, data: Partial<User>) => Promise<boolean>;
  deleteUser: (id: number) => Promise<boolean>;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const pickNumber = (...values: unknown[]): number => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const pickString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string") return value;
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
};

const mapApiToUser = (item: unknown): User => {
  const row = asRecord(item);
  return ({
    UsuarioID: pickNumber(
      row.usuarioID,
      row.usuarioId,
      row.UsuarioID,
      row.UsuarioId,
      row.userId,
      row.UserId,
      row.id,
    ),
    PersonalId: pickNumber(
      row.personalId,
      row.personalID,
      row.PersonalId,
      row.PersonalID,
      row.idPersonal,
      row.IdPersonal,
    ),
    UsuarioAlias: pickString(
      row.usuarioAlias,
      row.usuario,
      row.alias,
      row.UsuarioAlias,
      row.Usuario,
      row.Alias,
    ),
    UsuarioClave: pickString(row.usuarioClave, row.UsuarioClave),
    UsuarioFechaReg: pickString(row.usuarioFechaReg, row.UsuarioFechaReg),
    UsuarioEstado: pickString(row.usuarioEstado, row.UsuarioEstado),
    UsuarioSerie: pickString(row.usuarioSerie, row.UsuarioSerie) || "B001",
    EnviaBoleta: pickNumber(row.enviaBoleta, row.EnviaBoleta),
    EnviarFactura: pickNumber(row.enviarFactura, row.EnviarFactura),
    EnviaNC: pickNumber(row.enviaNC, row.EnviaNC),
    EnviaND: pickNumber(row.enviaND, row.EnviaND),
    Administrador: pickNumber(row.administrador, row.Administrador),
    area: pickString(row.area, row.Area),
  });
};

const isAliasDuplicateResponse = (result: unknown) => {
  const root = asRecord(result);
  const nestedResponse = asRecord(root.response);
  const status =
    (typeof root.status === "number" ? root.status : null) ??
    (typeof nestedResponse.status === "number" ? nestedResponse.status : null);

  if (status === 409) return true;

  const message =
    typeof result === "string"
      ? result
      : (typeof root.message === "string"
          ? root.message
          : typeof nestedResponse.data === "string"
            ? nestedResponse.data
            : "");

  return (
    typeof message === "string" &&
    message.toLowerCase().includes("alias de usuario ya existe")
  );
};

const mapUserToApiPayload = (user: Partial<User>) => ({
  usuarioID: user.UsuarioID ?? 0,
  personalId: user.PersonalId ?? 0,
  usuarioAlias: user.UsuarioAlias ?? "",
  usuarioClave: user.UsuarioClave ?? "",
  usuarioFechaReg: user.UsuarioFechaReg ?? new Date().toISOString(),
  usuarioEstado: user.UsuarioEstado ?? "ACTIVO",
});

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  loading: false,

  fetchUsers: async (estado = "ACTIVO") => {
    set({ loading: true });

    try {
      const query =
        estado && estado.trim() !== ""
          ? `?estado=${encodeURIComponent(estado)}`
          : "";
      const response = await apiRequest<unknown[]>({
        url: `${API_BASE_URL}/UsuariosCrud/list${query}`,
        method: "GET",
        fallback: [],
      });

      const parsed = Array.isArray(response) ? response : [];
      set({ users: parsed.map(mapApiToUser) });
    } catch (err) {
      console.error("Error loading users", err);
    } finally {
      set({ loading: false });
    }
  },

  addUser: async (newUser) => {
    try {
      const payload = mapUserToApiPayload({ ...newUser, UsuarioID: 0 });

      const created = await apiRequest<unknown>({
        url: `${API_BASE_URL}/UsuariosCrud/register`,
        method: "POST",
        data: payload,
        config: {
          headers: {
            Accept: "text/plain",
            "Content-Type": "application/json",
          },
        },
        fallback: null,
      });

      if (isAliasDuplicateResponse(created)) {
        toast.error("El alias de usuario ya existe.");
        return false;
      }

      if (created === null || created === false) {
        return false;
      }

      await get().fetchUsers();
      return true;
    } catch (err) {
      console.error("Error creating user", err);
      return false;
    }
  },

  updateUser: async (id, data) => {
    try {
      const payload = mapUserToApiPayload({ ...data, UsuarioID: id });

      const updated = await apiRequest<unknown>({
        url: `${API_BASE_URL}/UsuariosCrud/${id}`,
        method: "PUT",
        data: payload,
        config: {
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
          },
        },
        fallback: null,
      });

      if (isAliasDuplicateResponse(updated)) {
        toast.error("El alias de usuario ya existe.");
        return false;
      }

      if (updated === null || updated === false) {
        return false;
      }

      await get().fetchUsers();
      return true;
    } catch (err) {
      console.error("Error updating user", err);
      return false;
    }
  },

  deleteUser: async (id) => {
    try {
      const result = await apiRequest({
        url: `${API_BASE_URL}/UsuariosCrud/${id}`,
        method: "DELETE",
        config: {
          headers: {
            Accept: "*/*",
          },
        },
        fallback: null,
      });

      if (result === false) {
        return false;
      }

      set((state) => ({
        users: state.users.filter((u) => String(u.UsuarioID) !== String(id)),
      }));

      return true;
    } catch (err) {
      console.error("Error deleting user", err);
      return false;
    }
  },
}));
