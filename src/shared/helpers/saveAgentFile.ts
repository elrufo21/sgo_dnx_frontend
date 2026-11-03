import { PRINT_AGENT_BASE_URL, PRINT_AGENT_TOKEN } from "@/config";
import { toast } from "sonner";

export async function saveAgentFile(blob: Blob, fileName: string): Promise<boolean> {
  try {
    if (!PRINT_AGENT_TOKEN) throw new Error("El agente no está configurado.");
    const encoded = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",", 2)[1] || "");
      reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
      reader.readAsDataURL(blob);
    });
    let response: Response;
    try {
      response = await fetch(`${PRINT_AGENT_BASE_URL}/v1/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${PRINT_AGENT_TOKEN}` },
        body: JSON.stringify({ fileName, fileBase64: encoded }),
      });
    } catch {
      throw new Error("No se pudo conectar al agente DNX. Comprueba que esté instalado y encendido.");
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.path) throw new Error(result.error || "Actualiza el agente DNX para guardar archivos.");
    toast.success(`Archivo guardado: ${result.path}`, { duration: 10000 });
    return true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "No se pudo guardar el archivo.");
    return false;
  }
}
