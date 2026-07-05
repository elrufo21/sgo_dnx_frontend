import type { Provider } from "@/types/maintenance";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { buildApiUrl } from "@/config";

export const providersQueryKey = ["providers"] as const;

type ProviderApiResponse = {
  proveedorId?: number;
  proveedorRazon?: string;
  proveedorRuc?: string;
  proveedorContacto?: string;
  proveedorCelular?: string;
  proveedorTelefono?: string;
  proveedorCorreo?: string;
  proveedorDireccion?: string;
  proveedorEstado?: string;
} & Record<string, unknown>;

export const fetchProvidersApi = async (
  estado: "ACTIVO" | "INACTIVO" | "" = "ACTIVO"
): Promise<Provider[]> => {
  const query =
    estado && estado.trim() !== ""
      ? `?estado=${encodeURIComponent(estado)}`
      : "";
  const response = await apiRequest<ProviderApiResponse[]>({
    url: `${buildApiUrl("/Proveedor/list")}${query}`,
    method: "GET",
    fallback: [],
  });

  return (
    response?.map((item) => ({
      id: Number(item.proveedorId ?? (item as any).id ?? 0),
      razon: String(item.proveedorRazon ?? (item as any).proveedorRazon ?? (item as any).nombre ?? ""),
      ruc: String(item.proveedorRuc ?? ""),
      contacto: String(item.proveedorContacto ?? ""),
      celular: String(item.proveedorCelular ?? ""),
      telefono: String(item.proveedorTelefono ?? ""),
      correo: String(item.proveedorCorreo ?? ""),
      direccion: String(item.proveedorDireccion ?? ""),
      estado: String(item.proveedorEstado ?? ""),
      imagen: (item as any).proveedorImagen ?? (item as any).imagen ?? null,
      images:
        (item as any).proveedorImagen || (item as any).imagen
          ? [String((item as any).proveedorImagen ?? (item as any).imagen)]
          : [],
    })) ?? []
  );
};
