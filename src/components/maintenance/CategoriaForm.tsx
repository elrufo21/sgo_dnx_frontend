import { useCallback, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { Save, Plus, Trash2 } from "lucide-react";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import type { Category } from "@/types/maintenance";
import { focusFirstInput } from "@/shared/helpers/focusFirstInput";
import { useDialogStore } from "@/store/app/dialog.store";

interface CategoriaFormProps {
  initialData?: Partial<Category>;
  mode: "create" | "edit";
  onSave: (data: Category) => void;
  onNew?: () => void;
  onDelete?: () => void;

  variant?: "page" | "modal";
}

const buildDefaults = (data?: Partial<Category>): Category => ({
  id:
    Number.isNaN(Number(data?.id ?? data?.idSubLinea))
      ? 0
      : Number(data?.id ?? data?.idSubLinea ?? 0),
  nombreSublinea: data?.nombreSublinea ?? "",
  codigoSunat: data?.codigoSunat ?? "",
});

export default function CategoriaForm({
  initialData,
  mode,
  onSave,
  onNew,
  onDelete,
  variant = "page",
}: CategoriaFormProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const setDialogData = useDialogStore((s) => s.setData);
  const setMobileActions = useDialogStore((s) => s.setMobileActions);

  const isModal = variant === "modal";

  const defaults = useMemo(
    () => buildDefaults(initialData),
    [initialData]
  );

  const formMethods = useForm<Category>({
    defaultValues: defaults,
  });

  const {
    reset,
    watch,
    formState: { isSubmitting },
  } = formMethods;

  useEffect(() => {
    reset(defaults);
  }, [defaults, reset]);

  useEffect(() => {
    focusFirstInput(containerRef.current);
  }, [mode, initialData]);

  useEffect(() => {
    if (!isModal) return;
    setDialogData(defaults);
    const subscription = watch((values) => {
      setDialogData({
        ...values,
        nombreSublinea: values.nombreSublinea?.toUpperCase() ?? "",
      });
    });
    return () => subscription.unsubscribe();
  }, [isModal, watch, setDialogData]);

  const handleNew = useCallback(() => {
    reset(buildDefaults());
    focusFirstInput(containerRef.current);
    onNew?.();
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

  const onSubmit = async (values: Category) => {
    const payload: Category = {
      ...values,
      nombreSublinea: values.nombreSublinea?.toUpperCase() ?? "",
      codigoSunat: values.codigoSunat ?? "",
    };
    await onSave(payload);
    if (mode === "create") {
      handleNew();
      return;
    }
    focusFirstInput(containerRef.current);
  };

  const Header = () =>
    isModal ? null : (
      <div className="sticky top-20 sm:top-2 z-30 bg-[#B23636] text-white px-4 py-3 rounded-t-2xl flex items-center justify-between shadow-lg shadow-black/10">
        <div className="flex items-center gap-3">
          <BackArrowButton />
          <h1 className="text-base font-semibold">
            {mode === "create" ? "Crear Categoria" : "Editar Categoria"}
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
    );

  return (
    <div
      ref={containerRef}
      className={
        isModal
          ? "h-auto"
          : "h-auto py-8 px-4 sm:px-6 lg:px-8"
      }
    >
      <div className="max-w-4xl mx-auto">
        <div
          className={`bg-white ${
            variant !== "modal"
              ? "rounded-2xl shadow-xl overflow-visible"
              : "overflow-hidden"
          }`}
        >
          <HookForm methods={formMethods} onSubmit={onSubmit}>
            <Header />
            <div className="p-6 sm:p-8">
              <div className="space-y-4">
                <HookFormInput<Category>
                  data-focus-first
                  name="nombreSublinea"
                  label="Nombre de categoria"
                  placeholder="Ingrese nombre"
                  rules={{ required: "El nombre es obligatorio" }}
                />

                <HookFormInput<Category>
                  name="codigoSunat"
                  label="Codigo SUNAT"
                  placeholder="Ej: 1232"
                />
              </div>
            </div>
          </HookForm>
        </div>
      </div>
    </div>
  );
}

