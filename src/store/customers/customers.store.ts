import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import type { ApiClient, Client } from "@/types/customer";
import { create } from "zustand";

interface ClientsState {
  clients: Client[];
  loading: boolean;
  fetchClients: (estado?: "ACTIVO" | "INACTIVO" | "") => Promise<void>;
  addClient: (
    client: Omit<Client, "id">,
  ) => Promise<{ ok: boolean; error?: string }>;
  updateClient: (
    id: number,
    data: Partial<Client>,
  ) => Promise<{ ok: boolean; error?: string }>;
  deleteClient: (id: number) => Promise<boolean>;
}

const mapApiToClient = (item: unknown): Client => {
  const payload = (item ?? {}) as Record<string, unknown>;
  return {
    id: Number(payload.clienteId ?? payload.ClienteId ?? payload.id ?? 0),
    clienteCodigo: String(payload.clienteCodigo ?? payload.ClienteCodigo ?? ""),
    nombreRazon: String(payload.clienteRazon ?? payload.ClienteRazon ?? ""),
    ruc: String(payload.clienteRuc ?? payload.ClienteRuc ?? ""),
    dni: String(payload.clienteDni ?? payload.ClienteDni ?? ""),
    direccionFiscal: String(
      payload.clienteDireccion ?? payload.ClienteDireccion ?? "",
    ),
    direccionDespacho: String(
      payload.clienteDespacho ?? payload.ClienteDespacho ?? "",
    ),
    telefonoMovil: String(
      payload.clienteTelefono ?? payload.ClienteTelefono ?? "",
    ),
    email: String(payload.clienteCorreo ?? payload.ClienteCorreo ?? ""),
    registradoPor: String(
      payload.clienteUsuario ?? payload.ClienteUsuario ?? "",
    ),
    estado: String(payload.clienteEstado ?? payload.ClienteEstado ?? "ACTIVO"),
    fecha:
      payload.clienteFecha === null || payload.ClienteFecha === null
        ? null
        : String(payload.clienteFecha ?? payload.ClienteFecha ?? ""),
  };
};

const mapClientToApi = (client: Partial<Client>): ApiClient => ({
  clienteId: client.id ?? 0,
  clienteCodigo: client.clienteCodigo ?? "",
  clienteRazon: client.nombreRazon ?? "",
  clienteRuc: client.ruc ?? "",
  clienteDni: client.dni ?? "",
  clienteDireccion: client.direccionFiscal ?? "",
  clienteTelefono: client.telefonoMovil ?? "",
  clienteCorreo: client.email ?? "",
  clienteEstado: client.estado ?? "ACTIVO",
  clienteDespacho: client.direccionDespacho ?? "",
  clienteUsuario: client.registradoPor ?? "",
  clienteFecha: client.fecha ?? null,
});

const parseClientRegisterResponse = (
  result: unknown,
  fallback: ApiClient,
): ApiClient => {
  if (result && typeof result === "object") {
    const payload = result as Record<string, unknown>;
    const parsedId =
      Number(payload.clienteId ?? payload.ClienteId ?? payload.id) ||
      fallback.clienteId;
    const parsedFechaRaw = payload.clienteFecha ?? payload.ClienteFecha;

    return {
      clienteId: parsedId,
      clienteCodigo: String(
        payload.clienteCodigo ??
          payload.ClienteCodigo ??
          fallback.clienteCodigo ??
          "",
      ),
      clienteRazon: String(
        payload.clienteRazon ??
          payload.ClienteRazon ??
          payload.nombreRazon ??
          payload.nombre ??
          fallback.clienteRazon,
      ),
      clienteRuc: String(
        payload.clienteRuc ?? payload.ClienteRuc ?? fallback.clienteRuc,
      ),
      clienteDni: String(
        payload.clienteDni ?? payload.ClienteDni ?? fallback.clienteDni,
      ),
      clienteDireccion: String(
        payload.clienteDireccion ??
          payload.ClienteDireccion ??
          fallback.clienteDireccion,
      ),
      clienteTelefono: String(
        payload.clienteTelefono ??
          payload.ClienteTelefono ??
          fallback.clienteTelefono,
      ),
      clienteCorreo: String(
        payload.clienteCorreo ??
          payload.ClienteCorreo ??
          fallback.clienteCorreo,
      ),
      clienteEstado: String(
        payload.clienteEstado ??
          payload.ClienteEstado ??
          fallback.clienteEstado,
      ),
      clienteDespacho: String(
        payload.clienteDespacho ??
          payload.ClienteDespacho ??
          fallback.clienteDespacho,
      ),
      clienteUsuario: String(
        payload.clienteUsuario ??
          payload.ClienteUsuario ??
          fallback.clienteUsuario,
      ),
      clienteFecha:
        parsedFechaRaw === null || parsedFechaRaw === undefined
          ? fallback.clienteFecha
          : String(parsedFechaRaw),
    };
  }

  if (typeof result === "string") {
    const normalized = result.trim();
    if (!normalized || normalized.toLowerCase().includes("existe")) {
      return fallback;
    }

    const [idRaw = "", razonRaw = ""] = normalized.split("|");
    const parsedId = Number(idRaw.trim());
    return {
      ...fallback,
      clienteId:
        Number.isFinite(parsedId) && parsedId > 0
          ? parsedId
          : fallback.clienteId,
      clienteRazon: razonRaw.trim() || fallback.clienteRazon,
    };
  }

  return fallback;
};

const parseExistsMessage = (payload: unknown): string | null => {
  if (typeof payload !== "string") return null;
  const lower = payload.toLowerCase();
  if (lower.includes("dni")) return "Ese DNI ya existe.";
  if (lower.includes("ruc")) return "Ese RUC ya existe.";
  if (lower.includes("existe")) return "El cliente ya existe.";
  return null;
};

export const useClientsStore = create<ClientsState>((set) => ({
  clients: [],
  loading: false,

  fetchClients: async (estado = "ACTIVO") => {
    set({ loading: true });
    try {
      const query =
        estado && estado.trim() !== ""
          ? `?estado=${encodeURIComponent(estado)}`
          : "";
      const response = await apiRequest<ApiClient[]>({
        url: `${API_BASE_URL}/Cliente/list${query}`,
        method: "GET",
        fallback: [],
      });
      const data = Array.isArray(response) ? response : [];
      set({ clients: data.map(mapApiToClient), loading: false });
    } catch (error) {
      console.error("Error loading clients", error);
      set({ loading: false });
    }
  },

  addClient: async (client) => {
    try {
      set({ loading: true });
      const payload = mapClientToApi(client);
      const created = await apiRequest<unknown>({
        url: `${API_BASE_URL}/Cliente/register`,
        method: "POST",
        data: payload,
        config: {
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
          },
        },
        fallback: payload,
      });

      if (
        typeof created === "string" &&
        created.toLowerCase().includes("existe")
      ) {
        return { ok: false, error: parseExistsMessage(created) ?? undefined };
      }

      const parsedClient = parseClientRegisterResponse(created, payload);
      set((state) => ({
        clients: [...state.clients, mapApiToClient(parsedClient)],
      }));
      return { ok: true };
    } catch (error) {
      console.error("Error creating client", error);
      return { ok: false, error: "No se pudo crear el cliente." };
    } finally {
      set({ loading: false });
    }
  },

  updateClient: async (id, data) => {
    try {
      set({ loading: true });
      const payload = mapClientToApi({ ...data, id });
      const updated = await apiRequest<unknown>({
        url: `${API_BASE_URL}/Cliente/register`,
        method: "POST",
        data: payload,
        config: {
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
          },
        },
        fallback: payload,
      });

      if (
        typeof updated === "string" &&
        updated.toLowerCase().includes("existe")
      ) {
        return { ok: false, error: parseExistsMessage(updated) ?? undefined };
      }

      const parsedClient = parseClientRegisterResponse(updated, payload);
      set((state) => ({
        clients: state.clients.map((c) =>
          c.id === id ? mapApiToClient(parsedClient) : c,
        ),
      }));
      return { ok: true };
    } catch (error) {
      console.error("Error updating client", error);
      return { ok: false, error: "No se pudo actualizar el cliente." };
    } finally {
      set({ loading: false });
    }
  },

  deleteClient: async (id) => {
    const result = await apiRequest({
      url: `${API_BASE_URL}/Cliente/${id}`,
      method: "DELETE",
      config: { headers: { Accept: "*/*" } },
      fallback: true,
    });

    if (result === false) {
      return false;
    }

    set((state) => ({
      clients: state.clients.filter((c) => c.id !== id),
    }));

    return result !== false;
  },
}));
