import { apiRequest } from "@/shared/helpers/apiRequest";

export type DocumentLookupType = "ruc" | "dni";

export type DocumentLookupClient = {
  tipoDocumento: DocumentLookupType;
  numeroDocumento: string;
  nombreRazon: string;
  ruc: string;
  dni: string;
  direccionFiscal: string;
  direccionDespacho: string;
};

type DocumentLookupResult =
  | { ok: true; client: DocumentLookupClient }
  | { ok: false; message: string };

const asText = (value: unknown) => String(value ?? "").trim();
const pickFirst = (...values: unknown[]) =>
  values.map(asText).find((value) => value.length > 0) ?? "";

export const consultarDocumentoCliente = async (
  tipoDocumento: DocumentLookupType,
  numeroDocumento: string,
): Promise<DocumentLookupResult> => {
  const token = String(import.meta.env.VITE_API_DOCUMENTO ?? "").trim();
  if (!token) {
    console.error("Falta VITE_API_DOCUMENTO en .env");
    return { ok: false, message: "Falta configurar el token de consulta en .env" };
  }

  const response = await apiRequest<unknown>({
    url: `https://dniruc.apisperu.com/api/v1/${tipoDocumento}/${numeroDocumento}?token=${token}`,
    method: "GET",
    fallback: null,
  });

  if (!response || typeof response !== "object") {
    return { ok: false, message: "No se pudo consultar el documento" };
  }

  const responseRecord = response as Record<string, unknown>;
  const responseContainer = responseRecord.response as
    | Record<string, unknown>
    | undefined;
  const rawResponseData = responseContainer?.data;
  const parsedResponseData =
    typeof rawResponseData === "string"
      ? (() => {
          try {
            return JSON.parse(rawResponseData) as unknown;
          } catch {
            return rawResponseData;
          }
        })()
      : rawResponseData;
  const data =
    parsedResponseData && typeof parsedResponseData === "object"
      ? (parsedResponseData as Record<string, unknown>)
      : responseRecord;
  const rawErrorData = (responseRecord as { response?: { data?: unknown } })
    .response?.data;
  const errorDataRecord =
    rawErrorData && typeof rawErrorData === "object"
      ? (rawErrorData as Record<string, unknown>)
      : null;
  const apiMessage = pickFirst(
    errorDataRecord?.message,
    errorDataRecord?.error,
    data.message,
    data.error,
    (data as { errors?: unknown }).errors,
    (parsedResponseData as { message?: unknown })?.message,
    (parsedResponseData as { error?: unknown })?.error,
    rawResponseData,
  );
  const successFlag =
    (data as { success?: unknown }).success ??
    errorDataRecord?.success ??
    (responseRecord as { success?: unknown }).success;
  const hasExplicitFailure =
    successFlag === false ||
    String(successFlag ?? "").trim().toLowerCase() === "0" ||
    String(successFlag ?? "").trim().toLowerCase() === "false";

  if (hasExplicitFailure) {
    return {
      ok: false,
      message: apiMessage || "No se encontraron datos del documento",
    };
  }

  if (tipoDocumento === "dni") {
    const nombreRazon = [
      asText(data.nombres),
      asText(data.apellidoPaterno),
      asText(data.apellidoMaterno),
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    const dni = pickFirst(data.dni, numeroDocumento);

    if (!nombreRazon && !dni) {
      return {
        ok: false,
        message: apiMessage || "No se encontraron datos para ese DNI",
      };
    }

    return {
      ok: true,
      client: {
        tipoDocumento,
        numeroDocumento,
        nombreRazon,
        ruc: "",
        dni,
        direccionFiscal: "-",
        direccionDespacho: "-",
      },
    };
  }

  const nombreRazon = pickFirst(
    data.razonSocial,
    data.nombreORazonSocial,
    data.nombre_o_razon_social,
    data.nombre,
    data.nombreRazon,
  );
  const direccion = pickFirst(
    data.direccion,
    data.direccionCompleta,
    data.domicilioFiscal,
  );
  const ruc = pickFirst(data.ruc, numeroDocumento);

  if (!nombreRazon && !ruc) {
    return {
      ok: false,
      message: apiMessage || "No se encontraron datos para ese RUC",
    };
  }

  return {
    ok: true,
    client: {
      tipoDocumento,
      numeroDocumento,
      nombreRazon,
      ruc,
      dni: "",
      direccionFiscal: direccion || "-",
      direccionDespacho: direccion || "-",
    },
  };
};
