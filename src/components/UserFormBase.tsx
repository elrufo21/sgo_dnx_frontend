import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Save, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "@/shared/ui/toast";
import { useEmployeesStore } from "@/store/employees/employees.store";
import type { User } from "@/store/users/users.store";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { HookFormAutocomplete } from "@/components/forms/HookFormAutocomplete";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { focusFirstInput } from "@/shared/helpers/focusFirstInput";
import { useDialogStore } from "@/store/app/dialog.store";

interface UserFormBaseProps {
  initialData?: Partial<User>;
  mode: "create" | "edit";
  onSave: (data: Omit<User, "UsuarioID"> | Partial<User>) => Promise<boolean> | boolean;
  onNew?: () => void;
  onDelete?: () => void;
  variant?: "page" | "modal";
  fieldsMode?: "full" | "password-only";
}

type UserFormValues = {
  PersonalId: string | number;
  UsuarioAlias: string;
  UsuarioClave: string;
  ConfirmClave: string;
  UsuarioEstado: string;
  UsuarioSerie: string;
  EnviaBoleta: number;
  EnviarFactura: number;
  EnviaNC: number;
  EnviaND: number;
  Administrador: number;
  UsuarioFechaReg: string;
};

const PASSWORD_POLICY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
const PASSWORD_POLICY_MESSAGE =
  "La contrasena debe tener minimo 6 caracteres, una mayuscula, una minuscula y un numero";

const buildDefaults = (
  mode: "create" | "edit",
  initialData?: Partial<User>
): UserFormValues => ({
  PersonalId: initialData?.PersonalId ?? "",
  UsuarioAlias: initialData?.UsuarioAlias ?? "",
  UsuarioClave: initialData?.UsuarioClave ?? "",
  ConfirmClave: initialData?.UsuarioClave ?? "",
  UsuarioEstado: mode === "create" ? "ACTIVO" : initialData?.UsuarioEstado ?? "ACTIVO",
  UsuarioSerie: initialData?.UsuarioSerie ?? "B001",
  EnviaBoleta: initialData?.EnviaBoleta ?? 0,
  EnviarFactura: initialData?.EnviarFactura ?? 0,
  EnviaNC: initialData?.EnviaNC ?? 0,
  EnviaND: initialData?.EnviaND ?? 0,
  Administrador: initialData?.Administrador ?? 0,
  UsuarioFechaReg: initialData?.UsuarioFechaReg ?? new Date().toISOString(),
});

export default function UserFormBase({
  initialData,
  mode,
  onSave,
  onNew,
  onDelete,
  variant = "page",
  fieldsMode = "full",
}: UserFormBaseProps) {
  const { employees, fetchEmployees } = useEmployeesStore();
  const setDialogData = useDialogStore((s) => s.setData);
  const setMobileActions = useDialogStore((s) => s.setMobileActions);

  const containerRef = useRef<HTMLDivElement>(null);
  const isModal = variant === "modal";

  const [showPass, setShowPass] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);

  const defaults = useMemo(
    () => buildDefaults(mode, initialData),
    [mode, initialData]
  );

  const formMethods = useForm<UserFormValues>({
    defaultValues: defaults,
  });

  const {
    reset,
    watch,
    formState: { isSubmitting },
  } = formMethods;

  const focusInitialField = () => {
    const scope = containerRef.current;
    if (!scope) return;

    window.requestAnimationFrame(() => {
      const firstField = scope.querySelector<HTMLElement>(
        '[data-auto-next="true"]',
      );
      if (!firstField) return;

      firstField.focus({ preventScroll: true });
      if (
        firstField instanceof HTMLInputElement ||
        firstField instanceof HTMLTextAreaElement
      ) {
        firstField.select?.();
      }
    });
  };

  useEffect(() => {
    if (!employees.length) {
      fetchEmployees();
    }
  }, [employees.length, fetchEmployees]);

  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  useEffect(() => {
    focusInitialField();
  }, [mode, initialData, fieldsMode, employees.length]);

  useEffect(() => {
    if (!isModal) return;
    setDialogData(defaults);
    const subscription = watch((values) => {
      setDialogData({
        ...values,
        UsuarioAlias: values.UsuarioAlias?.replace(/\s+/g, "") ?? "",
      });
    });
    return () => subscription.unsubscribe();
  }, [isModal, defaults, setDialogData, watch]);

  const onSubmit = async (values: UserFormValues) => {
    const clave = values.UsuarioClave ?? "";

    if (!PASSWORD_POLICY_REGEX.test(clave)) {
      toast.error(PASSWORD_POLICY_MESSAGE);
      return;
    }

    if (clave !== (values.ConfirmClave ?? "")) {
      toast.error("Las contrasenas no coinciden");
      return;
    }

    const payload: Omit<User, "UsuarioID"> = {
      PersonalId: Number(values.PersonalId) || 0,
      UsuarioAlias: values.UsuarioAlias?.replace(/\s+/g, "") ?? "",
      UsuarioClave: clave,
      UsuarioFechaReg:
        initialData?.UsuarioFechaReg ?? values.UsuarioFechaReg ?? new Date().toISOString(),
      UsuarioEstado: values.UsuarioEstado ?? "ACTIVO",
      UsuarioSerie: values.UsuarioSerie ?? "B001",
      EnviaBoleta: values.EnviaBoleta ?? 0,
      EnviarFactura: values.EnviarFactura ?? 0,
      EnviaNC: values.EnviaNC ?? 0,
      EnviaND: values.EnviaND ?? 0,
      Administrador: values.Administrador ?? 0,
    };

    const ok = await onSave(payload);
    if (!ok) return;

    if (mode === "create") {
      reset(buildDefaults("create"));
      onNew?.();
    }

    focusFirstInput(containerRef.current);
  };

  const handleNew = useCallback(() => {
    reset(buildDefaults("create"));
    onNew?.();
    focusFirstInput(containerRef.current);
  }, [onNew, reset]);

  useEffect(() => {
    if (!isModal) return;

    const previousConfirmText = useDialogStore.getState().confirmText;
    useDialogStore.setState({ confirmText: "Guardar" });

    if (mode !== "edit") {
      setMobileActions(
        <button
          type="button"
          onClick={handleNew}
          aria-label="Nuevo"
          title="Nuevo"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
        </button>,
      );
    } else {
      setMobileActions(<></>);
    }

    return () => {
      setMobileActions(null);
      useDialogStore.setState({ confirmText: previousConfirmText });
    };
  }, [handleNew, isModal, mode, setMobileActions]);

  return (
    <div
      ref={containerRef}
      className={isModal ? "h-auto" : "h-auto py-8 px-4 sm:px-6 lg:px-8"}
    >
      <div className={isModal ? "w-full" : "w-full mx-auto"}>
        <div
          className={`bg-white ${
            isModal
              ? "overflow-hidden"
              : "overflow-visible rounded-2xl shadow-xl"
          }`}
        >
          <HookForm
            methods={formMethods}
            onSubmit={onSubmit}
            preventSubmitOnEnter={false}
          >
            {!isModal && (
              <div className="sticky top-20 sm:top-2 z-30 bg-[#B23636] text-white px-4 py-3 rounded-t-2xl flex items-center justify-between shadow-lg shadow-black/10">
                <div className="flex items-center gap-3">
                  <BackArrowButton />
                  <h1 className="text-base font-semibold">
                    {mode === "create" ? "Crear usuario" : "Editar usuario"}
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
            )}

            <div className="p-6 sm:p-8">
              <div className="space-y-4">
                {fieldsMode === "full" && (
                  <HookFormAutocomplete
                    name="PersonalId"
                    label="Personal"
                    placeholder="Buscar personal"
                    options={employees.map((p) => ({
                      label:
                        `${p.personalNombres ?? ""} ${p.personalApellidos ?? ""}`.trim() ||
                        p.personalCodigo ||
                        `Personal ${p.personalId}`,
                      value: p.personalId,
                      data: p,
                    }))}
                    rules={{
                      required: "Seleccione personal",
                      validate: (value) =>
                        Number(value) > 0 || "Seleccione personal",
                    }}
                    data-focus-first
                  />
                )}

                {fieldsMode === "full" && (
                  <HookFormInput
                    name="UsuarioAlias"
                    label="Usuario / Alias"
                    placeholder="Ej: jramirez"
                    onKeyDown={(e) => {
                      if (e.key === " ") {
                        e.preventDefault();
                      }
                    }}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\s+/g, "");
                      e.target.value = value;
                    }}
                    rules={{ required: "El alias es obligatorio" }}
                  />
                )}

                <HookFormInput
                  name="UsuarioClave"
                  label="Contrasena"
                  type={showPass ? "text" : "password"}
                  autoComplete="one-time-code"
                  placeholder="Ingrese contrasena"
                  rules={{
                    required: "La contrasena es obligatoria",
                    validate: (value) =>
                      PASSWORD_POLICY_REGEX.test(value ?? "") ||
                      PASSWORD_POLICY_MESSAGE,
                  }}
                  endAdornment={
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      className="text-gray-500 hover:text-gray-700"
                      tabIndex={-1}
                    >
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  }
                />

                <HookFormInput
                  name="ConfirmClave"
                  label="Confirmar contrasena"
                  type={showPassConfirm ? "text" : "password"}
                  autoComplete="one-time-code"
                  placeholder="Repita la contrasena"
                  rules={{
                    required: "La confirmacion de contrasena es obligatoria",
                    validate: (value) => {
                      if (!PASSWORD_POLICY_REGEX.test(value ?? "")) {
                        return PASSWORD_POLICY_MESSAGE;
                      }
                      return (
                        value === watch("UsuarioClave") ||
                        "Las contrasenas no coinciden"
                      );
                    },
                  }}
                  endAdornment={
                    <button
                      type="button"
                      onClick={() => setShowPassConfirm((v) => !v)}
                      className="text-gray-500 hover:text-gray-700"
                      tabIndex={-1}
                    >
                      {showPassConfirm ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  }
                />

                {fieldsMode === "full" && (
                  <HookFormSelect
                    name="UsuarioEstado"
                    label="Estado"
                    options={[
                      { value: "ACTIVO", label: "Activo" },
                      { value: "INACTIVO", label: "Inactivo" },
                    ]}
                    disabled={mode === "create"}
                  />
                )}
              </div>
            </div>
          </HookForm>
        </div>
      </div>
    </div>
  );
}

