import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { Save, Plus, Trash2 } from "lucide-react";

import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { useMaintenanceStore } from "@/store/maintenance/maintenance.store";
import type { Computer } from "@/types/maintenance";
import { focusFirstInput } from "@/shared/helpers/focusFirstInput";
import { getLocalDateISO, toLocalDateInputValue } from "@/shared/helpers/localDate";

type ComputerFormValues = Omit<Computer, "id">;

const formatDateInput = (value?: string, fallback?: string) => {
  return toLocalDateInputValue(value, fallback ?? getLocalDateISO());
};

const normalizeSerie = (
  value: string | undefined,
  prefix: string,
  fallback: string
) => {
  const fallbackMatch = fallback.match(/^([A-Za-z]*)(\d+)$/);
  const fallbackNum = fallbackMatch?.[2] || "01";
  const digits = value?.match(/(\d+)/)?.[1] ?? fallbackNum;
  const numeric = digits
    .slice(-fallbackNum.length)
    .padStart(fallbackNum.length, "0");
  return `${prefix}${numeric}`.slice(0, prefix.length + fallbackNum.length);
};

interface ComputerFormProps {
  mode: "create" | "edit";
  initialData?: Partial<Computer>;
  onSave: (data: Omit<Computer, "id">) => void;
  onNew?: () => void;
  onDelete?: () => void;
}

export default function ComputerForm({
  mode,
  initialData,
  onSave,
  onNew,
  onDelete,
}: ComputerFormProps) {
  const { fetchAreas, computers, fetchComputers } = useMaintenanceStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const today = useMemo(() => getLocalDateISO(), []);

  useEffect(() => {
    fetchAreas();
    fetchComputers();
  }, [fetchAreas, fetchComputers]);

  const computeNextSerie = useCallback(
    (
      selector: (item: Computer) => string | undefined,
      fallback: string,
      forcedPrefix?: string
    ): string => {
      const fallbackMatch = fallback.match(/^([A-Za-z]*)(\d+)$/);
      const fallbackPrefix = forcedPrefix || fallbackMatch?.[1] || "FA";
      const fallbackNum = fallbackMatch?.[2] || "01";
      const digitLength = fallbackNum.length;

      if (!computers || computers.length === 0) {
        return `${fallbackPrefix}${fallbackNum}`.slice(
          0,
          fallbackPrefix.length + digitLength
        );
      }

      const parsed = computers
        .map(selector)
        .filter((s): s is string => Boolean(s))
        .map((serie) => {
          const match = serie.match(/^([A-Za-z]*)(\d+)$/);
          if (!match) return null;
          const num = match[2];
          return {
            prefix: fallbackPrefix,
            num,
            numeric: parseInt(num, 10),
          };
        })
        .filter(Boolean) as { prefix: string; num: string; numeric: number }[];

      if (parsed.length === 0)
        return `${fallbackPrefix}${fallbackNum}`.slice(
          0,
          fallbackPrefix.length + digitLength
        );

      const max = parsed.reduce((prev, curr) =>
        curr.numeric > prev.numeric ? curr : prev
      );
      const nextNum = String(max.numeric + 1).padStart(digitLength, "0");
      const trimmedNum = nextNum.slice(-digitLength);
      return `${fallbackPrefix}${trimmedNum}`.slice(
        0,
        fallbackPrefix.length + digitLength
      );
    },
    [computers]
  );

  const nextSerieFactura = useMemo(
    () => computeNextSerie((c) => c.serieFactura, "FA01", "FA"),
    [computeNextSerie]
  );

  const nextSerieBoleta = useMemo(
    () => computeNextSerie((c) => c.serieBoleta, "BA01", "BA"),
    [computeNextSerie]
  );

  const buildValues = useCallback(
    (data?: Partial<Computer>): ComputerFormValues => ({
      maquina: data?.maquina ?? "",
      registro: formatDateInput(data?.registro, today),
      serieFactura: data?.serieFactura
        ? normalizeSerie(data.serieFactura, "FA", "FA01")
        : nextSerieFactura,
      serieNc: data?.serieNc
        ? normalizeSerie(data.serieNc, "FZ", "FZ01")
        : "FZ01",
      serieBoleta: data?.serieBoleta
        ? normalizeSerie(data.serieBoleta, "BA", "BA01")
        : nextSerieBoleta,
      ticketera: data?.ticketera ?? "",
      areaId: data?.areaId ?? 0,
    }),
    [nextSerieBoleta, nextSerieFactura, today]
  );

  const formMethods = useForm<ComputerFormValues>({
    defaultValues:
      mode === "edit" && initialData ? buildValues(initialData) : buildValues(),
  });

  const {
    reset,
    formState: { isSubmitting },
  } = formMethods;

  useEffect(() => {
    focusFirstInput(containerRef.current);
  }, [mode, initialData]);

  useEffect(() => {
    if (mode !== "edit" || !initialData) return;
    reset(buildValues(initialData));
  }, [buildValues, initialData, mode, reset]);

  useEffect(() => {
    if (mode !== "create") return;
    reset(buildValues(), { keepDirtyValues: true });
  }, [buildValues, mode, reset]);

  const handleSubmit = async (values: ComputerFormValues) => {
    const payload: ComputerFormValues = {
      ...values,
      maquina: values.maquina?.toUpperCase() ?? "",
      ticketera: values.ticketera?.toUpperCase() ?? "",
    };
    await onSave(payload);
    focusFirstInput(containerRef.current);
  };

  const handleNew = () => {
    reset(buildValues());
    onNew?.();
    focusFirstInput(containerRef.current);
  };

  return (
    <div ref={containerRef} className="h-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl overflow-visible">
        <HookForm methods={formMethods} onSubmit={handleSubmit}>
          <div className="sticky top-20 sm:top-2 z-30 bg-[#B23636] text-white px-4 py-3 rounded-t-2xl flex items-center justify-between shadow-lg shadow-black/10">
            <div className="flex items-center gap-3">
              <BackArrowButton />
              <h1 className="text-base font-semibold">
                {mode === "create"
                  ? "Registrar nueva Computadora"
                  : "Editar Computadora"}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {mode === "edit" && onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/20 transition-colors"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Eliminar</span>
                </button>
              )}
              {mode !== "edit" && (
                <button
                  type="button"
                  onClick={handleNew}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-white/10 hover:bg-white/20 transition-colors"
                  title="Nuevo"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Nuevo</span>
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 disabled:opacity-70 transition-colors"
                title="Guardar"
              >
                <Save className="w-4 h-4" />
                <span className="hidden sm:inline">Guardar</span>
              </button>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="space-y-4">
              <HookFormInput<ComputerFormValues>
                data-focus-first="true"
                name="maquina"
                label="Maquina *"
                placeholder="Ej: PC-001"
                rules={{ required: "La maquina es obligatoria" }}
              />
              <HookFormInput<ComputerFormValues>
                name="serieFactura"
                label="Serie Factura"
                placeholder="Ej: FA05"
                maxLength={4}
                rules={{
                  required: "La serie de factura es obligatoria",
                  pattern: {
                    value: /^FA/i,
                    message: "Debe iniciar con FA",
                  },
                  maxLength: {
                    value: 4,
                    message: "Maximo 4 caracteres",
                  },
                  minLength: {
                    value: 4,
                    message: "Debe tener 4 caracteres",
                  },
                }}
              />
              <HookFormInput<ComputerFormValues>
                name="serieBoleta"
                label="Serie Boleta"
                placeholder="Ej: BA01"
                maxLength={4}
                rules={{
                  required: "La serie de boleta es obligatoria",
                  pattern: {
                    value: /^BA/i,
                    message: "Debe iniciar con BA",
                  },
                  maxLength: {
                    value: 4,
                    message: "Maximo 4 caracteres",
                  },
                  minLength: {
                    value: 4,
                    message: "Debe tener 4 caracteres",
                  },
                }}
              />
              <HookFormInput<ComputerFormValues>
                name="serieNc"
                label="Serie NC"
                placeholder="Ej: FZ01"
                maxLength={4}
                rules={{
                  required: "La serie de FZ es obligatoria",
                  pattern: {
                    value: /^FZ/i,
                    message: "Debe iniciar con FZ",
                  },
                  maxLength: {
                    value: 4,
                    message: "Maximo 4 caracteres",
                  },
                  minLength: {
                    value: 4,
                    message: "Debe tener 4 caracteres",
                  },
                }}
              />
              <HookFormInput<ComputerFormValues>
                name="ticketera"
                label="Ticketera"
                placeholder="Ej: TICKET-01"
              />
            </div>
          </div>
        </HookForm>
      </div>
    </div>
  );
}

