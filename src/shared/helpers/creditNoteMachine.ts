import { PRINT_AGENT_BASE_URL } from "@/config";

export async function getCreditNoteMachineName(): Promise<string> {
  try {
    const response = await fetch(`${PRINT_AGENT_BASE_URL}/v1/system`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error();
    const data = await response.json() as { hostname?: unknown };
    const name = typeof data.hostname === "string" ? data.hostname.trim() : "";
    if (name) return name;
  } catch {
    // The local agent identifies the issuing computer.
  }
  throw new Error("No se detectó el agente DXN. Inícialo para identificar esta computadora y su serie de nota de crédito.");
}
