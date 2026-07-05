import { BackArrowButton } from "@/components/common/BackArrowButton";
import { toast } from "@/shared/ui/toast";
import { useBillingConfigStore } from "@/store/configuration/billingConfig.store";
import type { BillingProcessType } from "@/types/billingConfig";
import { Download, FileUp, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const processOptions: Array<{ value: BillingProcessType; label: string }> = [
  { value: "BETA", label: "BETA" },
  { value: "PRODUCCION", label: "PRODUCCIÓN" },
];

const MAX_CERTIFICATE_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_CERTIFICATE_EXTENSIONS = [".pfx", ".p12"];

const hasAllowedCertificateExtension = (filename: string) => {
  const normalized = String(filename).trim().toLowerCase();
  return ALLOWED_CERTIFICATE_EXTENSIONS.some((ext) => normalized.endsWith(ext));
};

const resolveDownloadName = (rawName: string) => {
  const normalized = String(rawName ?? "").trim();
  if (!normalized || normalized === "-" || normalized === "Certificado cargado") {
    return "certificado-sunat.p12";
  }
  return hasAllowedCertificateExtension(normalized) ? normalized : `${normalized}.p12`;
};

const decodeBase64ToBytes = (base64Value: string) => {
  const cleaned = base64Value.replace(/\s+/g, "");
  const binary = window.atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

export default function BillingSettingsPage() {
  const { config, loading, saving, fetchConfig, saveConfig } =
    useBillingConfigStore();
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState("");
  const [certificatePasswordTouched, setCertificatePasswordTouched] =
    useState(false);
  const [solUser, setSolUser] = useState("");
  const [solUserTouched, setSolUserTouched] = useState(false);
  const [solPassword, setSolPassword] = useState("");
  const [solPasswordTouched, setSolPasswordTouched] = useState(false);
  const [processType, setProcessType] = useState<BillingProcessType | "">("");
  const [processTypeTouched, setProcessTypeTouched] = useState(false);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const effectiveCertificatePassword = certificatePasswordTouched
    ? certificatePassword
    : certificatePassword || config?.certificatePassword || "";

  const effectiveSolUser = solUserTouched ? solUser : solUser || config?.solUser || "";

  const effectiveSolPassword = solPasswordTouched
    ? solPassword
    : solPassword || config?.solPassword || "";

  const effectiveProcessType = processTypeTouched
    ? processType || ("BETA" as BillingProcessType)
    : (processType ||
        config?.processType ||
        ("BETA" as BillingProcessType));

  const selectedProcessType =
    processType || config?.processType || ("BETA" as BillingProcessType);

  const certificateStatus = useMemo(() => {
    if (!config?.hasCertificate) return "Sin certificado cargado";
    return config.certificateName || "Certificado cargado";
  }, [config]);

  const selectedCertificateLabel = useMemo(() => {
    if (certificateFile) return certificateFile.name;
    if (config?.hasCertificate) {
      const normalizedName = String(config.certificateName ?? "").trim();
      if (
        normalizedName &&
        normalizedName !== "-" &&
        normalizedName !== "Certificado cargado"
      ) {
        return `Actual: ${normalizedName}`;
      }
      return "Actual: certificado cargado";
    }
    return "Ningún archivo seleccionado";
  }, [certificateFile, config]);

  const handleRefresh = useCallback(() => {
    void fetchConfig();
  }, [fetchConfig]);

  const handleDownloadCertificate = useCallback(() => {
    const certificateBase64 = config?.certificateBase64 ?? "";
    if (!certificateBase64.trim()) {
      toast.error("No hay certificado disponible para descargar.");
      return;
    }

    try {
      const certificateBytes = decodeBase64ToBytes(certificateBase64);
      const blob = new Blob([certificateBytes], { type: "application/x-pkcs12" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = resolveDownloadName(config?.certificateName ?? "");
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("No se pudo descargar el certificado", error);
      toast.error("No se pudo descargar el certificado.");
    }
  }, [config]);

  const handleSave = useCallback(async () => {
    const hasNewCertificate = certificateFile instanceof File;

    if (!hasNewCertificate) {
      toast.error("Debes cargar un certificado .pfx o .p12.");
      return;
    }
    if (!hasAllowedCertificateExtension(certificateFile.name)) {
      toast.error("El certificado debe ser .p12 o .pfx.");
      return;
    }
    if (certificateFile.size > MAX_CERTIFICATE_SIZE_BYTES) {
      toast.error("El certificado no debe superar 2MB.");
      return;
    }
    if (!effectiveSolUser.trim()) {
      toast.error("Debes ingresar el usuario SOL.");
      return;
    }
    if (!effectiveSolPassword.trim()) {
      toast.error("Debes ingresar la clave SOL.");
      return;
    }
    if (hasNewCertificate && !effectiveCertificatePassword.trim()) {
      toast.error("Debes ingresar la clave del certificado.");
      return;
    }

    const ok = await saveConfig({
      certificateFile,
      certificatePassword: effectiveCertificatePassword.trim(),
      solUser: effectiveSolUser.trim(),
      solPassword: effectiveSolPassword.trim(),
      processType: selectedProcessType,
    });

    if (!ok) {
      toast.error("No se pudo guardar la configuración de facturación.");
      return;
    }

    toast.success("Configuración de facturación guardada correctamente.");
    setCertificateFile(null);
  }, [
    certificateFile,
    effectiveCertificatePassword,
    effectiveSolPassword,
    effectiveSolUser,
    saveConfig,
    selectedProcessType,
  ]);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackArrowButton />
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Facturación</h1>
            <p className="text-sm text-slate-500">
              Gestiona certificado digital y credenciales SOL.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          onClick={handleRefresh}
          disabled={loading || saving}
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Estado del certificado
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {certificateStatus}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Vence: {config?.certificateExpiresAt ?? "-"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Última actualización: {config?.updatedAt ?? "-"}
          </p>
          <button
            type="button"
            onClick={handleDownloadCertificate}
            disabled={!config?.certificateBase64}
            className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            Descargar certificado
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Usuario SOL actual
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {config?.solUser || "-"}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Tipo de proceso
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-800">
            {config?.processType ?? effectiveProcessType}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-700">
              Certificado digital (.pfx/.p12)
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#B23636]/25 bg-[#B23636]/10 px-3 text-sm font-medium text-[#B23636] hover:bg-[#B23636]/15">
                <FileUp className="h-4 w-4" />
                Seleccionar archivo
                <input
                  type="file"
                  accept=".pfx,.p12,application/x-pkcs12"
                  className="hidden"
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    if (!nextFile) {
                      setCertificateFile(null);
                      return;
                    }

                    if (!hasAllowedCertificateExtension(nextFile.name)) {
                      toast.error("Solo se permite certificado .p12 o .pfx.");
                      event.currentTarget.value = "";
                      setCertificateFile(null);
                      return;
                    }

                    if (nextFile.size > MAX_CERTIFICATE_SIZE_BYTES) {
                      toast.error("El certificado no debe superar 2MB.");
                      event.currentTarget.value = "";
                      setCertificateFile(null);
                      return;
                    }

                    setCertificateFile(nextFile);
                  }}
                />
              </label>
              <span className="truncate text-sm text-slate-600">
                {selectedCertificateLabel}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Clave del certificado
            </label>
            <input
              type="password"
              value={effectiveCertificatePassword}
              onChange={(event) => {
                setCertificatePasswordTouched(true);
                setCertificatePassword(event.target.value);
              }}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#B23636] focus:ring-2 focus:ring-[#B23636]/20"
              placeholder="Ingrese clave del certificado"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Usuario SOL</label>
            <input
              type="text"
              value={effectiveSolUser}
              onChange={(event) => {
                setSolUserTouched(true);
                setSolUser(event.target.value);
              }}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#B23636] focus:ring-2 focus:ring-[#B23636]/20"
              placeholder="Ingrese usuario SOL"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Clave SOL</label>
            <input
              type="password"
              value={effectiveSolPassword}
              onChange={(event) => {
                setSolPasswordTouched(true);
                setSolPassword(event.target.value);
              }}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#B23636] focus:ring-2 focus:ring-[#B23636]/20"
              placeholder="Ingrese clave SOL"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Ambiente SUNAT
            </label>
            <select
              value={effectiveProcessType}
              onChange={(event) => {
                setProcessTypeTouched(true);
                setProcessType(event.target.value as BillingProcessType);
              }}
              className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-[#B23636] focus:ring-2 focus:ring-[#B23636]/20"
            >
              {processOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#B23636] px-4 text-sm font-semibold text-white hover:bg-[#9f2e2e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
        </div>
      </div>
    </div>
  );
}
