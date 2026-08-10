import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { formatDateTime } from "@/shared/helpers/formatDate";
import type { ApiClient, Client } from "@/types/customer";
import { create } from "zustand";

type FetchClientsParams =
  | ("ACTIVO" | "INACTIVO" | "")
  | {
      estado?: "ACTIVO" | "INACTIVO" | "";
      search?: string;
      page?: number;
      pageSize?: number;
    };

interface ClientsState {
  clients: Client[];
  totalClients: number;
  allClientsLoaded: boolean;
  loading: boolean;
  fetchClients: (params?: FetchClientsParams) => Promise<void>;
  searchClients: (
    search: string,
    estado?: "ACTIVO" | "INACTIVO" | "",
    pageSize?: number,
  ) => Promise<Client[]>;
  fetchClientById: (id: number) => Promise<Client | null>;
  fetchClientByCodigo: (codigo: string) => Promise<Client | null>;
  fetchClientMonthlyPvs: (id: number) => Promise<number>;
  addClient: (
    client: Omit<Client, "id">,
  ) => Promise<{ ok: boolean; error?: string; client?: Client }>;
  updateClient: (
    id: number,
    data: Partial<Client>,
  ) => Promise<{ ok: boolean; error?: string; client?: Client }>;
  deleteClient: (id: number) => Promise<boolean>;
}

const mapApiToClient = (item: unknown): Client => {
  const payload = (item ?? {}) as Record<string, unknown>;
  const docuRaw = String(
    payload.clienteDocu ??
      payload.ClienteDocu ??
      payload.documentoPredeterminado ??
      payload.DocumentoPredeterminado ??
      "",
  ).trim().toUpperCase();
  const documentoPredeterminado = docuRaw || "BOLETA";

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
    fecha: formatDateTime(payload.clienteFecha ?? payload.ClienteFecha) || null,
    documentoPredeterminado,
  };
};

const toApiDateTime = (value?: string | null) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const match = text.match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/,
  );
  if (!match) return text;
  const [, day, month, year, hours = "00", minutes = "00", seconds = "00"] =
    match;
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
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
  clienteFecha: toApiDateTime(client.fecha),
  clienteDocu: client.documentoPredeterminado || "BOLETA",
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
      clienteDocu: String(
        payload.clienteDocu ??
          payload.ClienteDocu ??
          fallback.clienteDocu ??
          "BOLETA",
      ),
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

const isApiError = (value: unknown) =>
  Boolean(
    value &&
      typeof value === "object" &&
      ("isAxiosError" in value || ("response" in value && "config" in value)),
  );

const parseParams = (params: FetchClientsParams = "ACTIVO") =>
  typeof params === "string"
    ? { estado: params, search: "", page: 1, pageSize: 50 }
    : {
        estado: params.estado ?? "ACTIVO",
        search: params.search ?? "",
        page: params.page ?? 1,
        pageSize: params.pageSize ?? 50,
      };

const buildClientListUrl = (params: FetchClientsParams = "ACTIVO") => {
  const parsed = parseParams(params);
  const query = new URLSearchParams();
  if (parsed.estado) query.set("estado", parsed.estado);
  if (parsed.search.trim()) query.set("search", parsed.search.trim());
  query.set("page", String(parsed.page));
  query.set("pageSize", String(parsed.pageSize));
  return `${API_BASE_URL}/Cliente/list?${query.toString()}`;
};

const parseClientListResponse = (response: unknown) => {
  const payload = (response ?? {}) as Record<string, unknown>;
  const items = Array.isArray(response)
    ? response
    : Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.Items)
        ? payload.Items
        : [];
  const total = Array.isArray(response)
    ? response.length
    : Number(payload.total ?? payload.Total ?? items.length);

  return {
    items: items.map(mapApiToClient),
    total: Number.isFinite(total) ? total : items.length,
  };
};

const parseComboClients = (value: unknown): Client[] =>
  String(value ?? "")
    .split(/[¬\n\r]+/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row) => {
      const parts = row.split("|");
      return {
        id: Number(parts[0]) || 0,
        nombreRazon: String(parts[1] ?? "").trim(),
        ruc: String(parts[2] ?? "").trim(),
        dni: String(parts[3] ?? "").trim(),
        direccionFiscal: String(parts[4] ?? "").trim(),
        telefonoMovil: String(parts[5] ?? "").trim(),
        email: String(parts[6] ?? "").trim(),
        estado: String(parts[7] ?? "").trim() || "ACTIVO",
        direccionDespacho: String(parts[8] ?? "").trim(),
        registradoPor: String(parts[9] ?? "").trim(),
        fecha: formatDateTime(parts[10]) || null,
        clienteCodigo: String(parts[11] ?? "").trim(),
        documentoPredeterminado:
          String(parts[12] ?? "").trim().toUpperCase() || "BOLETA",
      };
    })
    .filter((client) => client.id || client.nombreRazon);

const mergeClients = (current: Client[], incoming: Client[]) => {
  const map = new Map<number, Client>();
  current.forEach((client) => map.set(client.id, client));
  incoming.forEach((client) => map.set(client.id, client));
  return Array.from(map.values());
};

const normalizeClientSearch = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const filterClients = (clients: Client[], term: string, estado: string) => {
  const tokens = normalizeClientSearch(term).split(/\s+/).filter(Boolean);
  const estadoFilter = estado.trim();
  return clients.filter((client) => {
    if (estadoFilter && client.estado !== estadoFilter) return false;
    const haystack = normalizeClientSearch(
      `${client.clienteCodigo} ${client.nombreRazon} ${client.ruc} ${client.dni} ${client.telefonoMovil} ${client.email}`,
    );
    return tokens.every((token) => haystack.includes(token));
  });
};

export const useClientsStore = create<ClientsState>((set, get) => ({
  clients: [],
  totalClients: 0,
  allClientsLoaded: false,
  loading: false,

  fetchClients: async (params = "ACTIVO") => {
    set({ loading: true });
    try {
      const paged =
        typeof params !== "string" &&
        (params.page !== undefined ||
          params.pageSize !== undefined ||
          params.search !== undefined);
      const response = await apiRequest<unknown>({
        url: paged ? buildClientListUrl(params) : `${API_BASE_URL}/Cliente`,
        method: "GET",
        fallback: [],
      });
      const { items, total } = paged
        ? parseClientListResponse(response)
        : (() => {
            const clients = parseComboClients(response);
            return { items: clients, total: clients.length };
          })();
      set({
        clients: items,
        totalClients: total,
        allClientsLoaded: !paged,
        loading: false,
      });
    } catch (error) {
      console.error("Error loading clients", error);
      set({ loading: false });
    }
  },

  searchClients: async (search, estado = "ACTIVO", pageSize = 20) => {
    const term = search.trim();
    if (term.length < 2) return [];
    const current = get().clients;
    if (get().allClientsLoaded) {
      return filterClients(current, term, estado).slice(0, pageSize);
    }
    const response = await apiRequest<unknown>({
      url: buildClientListUrl({ estado, search: term, page: 1, pageSize }),
      method: "GET",
      fallback: [],
    });
    const { items: found } = parseClientListResponse(response);
    set((state) => ({ clients: mergeClients(state.clients, found) }));
    return found;
  },

  fetchClientById: async (id) => {
    try {
      set({ loading: true });
      const response = await apiRequest<ApiClient | null>({
        url: `${API_BASE_URL}/Cliente/${id}`,
        method: "GET",
        fallback: null,
      });
      const client = response ? mapApiToClient(response) : null;
      if (client) set((state) => ({ clients: mergeClients(state.clients, [client]) }));
      return client;
    } finally {
      set({ loading: false });
    }
  },

  fetchClientByCodigo: async (codigo) => {
    const normalized = codigo.trim();
    if (!normalized) return null;
    const response = await apiRequest<ApiClient | null>({
      url: `${API_BASE_URL}/Cliente/by-codigo/${encodeURIComponent(normalized)}`,
      method: "GET",
      fallback: null,
    });
    const client = response ? mapApiToClient(response) : null;
    if (!client?.id && !client?.clienteCodigo && !client?.nombreRazon) {
      return null;
    }
    if (client) set((state) => ({ clients: mergeClients(state.clients, [client]) }));
    return client;
  },

  fetchClientMonthlyPvs: async (id) => {
    if (!id) return 0;
    const response = await apiRequest<unknown>({
      url: `${API_BASE_URL}/Cliente/${id}/pvs-mes`,
      method: "GET",
      fallback: { total: 0 },
    });
    const payload = (response ?? {}) as Record<string, unknown>;
    const total = Number(payload.total ?? payload.Total ?? response ?? 0);
    return Number.isFinite(total) ? total : 0;
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
      });

      if (!created || isApiError(created)) {
        return { ok: false, error: "No se pudo crear el cliente." };
      }

      if (
        typeof created === "string" &&
        created.toLowerCase().includes("existe")
      ) {
        return { ok: false, error: parseExistsMessage(created) ?? undefined };
      }

      const parsedClient = parseClientRegisterResponse(created, payload);
      const createdClient = mapApiToClient(parsedClient);
      if (!createdClient.id) {
        return { ok: false, error: "No se pudo crear el cliente." };
      }
      set((state) => ({
        clients: [...state.clients, createdClient],
      }));
      return { ok: true, client: createdClient };
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
      });

      if (!updated || isApiError(updated)) {
        return { ok: false, error: "No se pudo actualizar el cliente." };
      }

      if (
        typeof updated === "string" &&
        updated.toLowerCase().includes("existe")
      ) {
        return { ok: false, error: parseExistsMessage(updated) ?? undefined };
      }

      const parsedClient = parseClientRegisterResponse(updated, payload);
      const updatedClient = mapApiToClient(parsedClient);
      set((state) => ({
        clients: state.clients.map((c) =>
          c.id === id ? updatedClient : c,
        ),
      }));
      return { ok: true, client: updatedClient };
    } catch (error) {
      console.error("Error updating client", error);
      return { ok: false, error: "No se pudo actualizar el cliente." };
    } finally {
      set({ loading: false });
    }
  },

  deleteClient: async (id) => {
    try {
      set({ loading: true });
      const result = await apiRequest({
        url: `${API_BASE_URL}/Cliente/${id}`,
        method: "DELETE",
        config: { headers: { Accept: "*/*" } },
        fallback: false,
      });

      if (result !== true) {
        return false;
      }

      set((state) => ({
        clients: state.clients.filter((c) => c.id !== id),
      }));

      return true;
    } finally {
      set({ loading: false });
    }
  },
}));
