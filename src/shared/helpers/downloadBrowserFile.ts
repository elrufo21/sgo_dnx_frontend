import { toast } from "@/shared/ui/toast";

export async function downloadBrowserFile(blob: Blob, fileName: string): Promise<boolean> {
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  } catch {
    toast.error("No se pudo iniciar la descarga.");
    return false;
  }
}
