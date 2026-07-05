import React, { useMemo } from "react";
import { useForm } from "react-hook-form";
import type { FieldConfig, FormConfig, FormMode } from "./types";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";

const toRules = (field: FieldConfig) => {
  const rules: any = {};
  field.validators?.forEach((v) => {
    if (v.type === "required") rules.required = v.message || "Requerido";
    if (v.type === "pattern")
      rules.pattern = { value: v.value, message: v.message };
    if (v.type === "min") rules.min = { value: v.value, message: v.message };
    if (v.type === "max") rules.max = { value: v.value, message: v.message };
    if (v.type === "custom")
      rules.validate = (val: any, all: any) => v.fn(val, all);
  });
  return rules;
};

const useOptions = (options?: FieldConfig["options"]) => {
  if (!options) return [];
  if (options.type === "static") return options.options;
  // Otros tipos (store/async) se pueden resolver luego.
  return [];
};

const FieldRenderer = ({
  field,
  mode,
  values,
}: {
  field: FieldConfig;
  mode: FormMode;
  values: any;
}) => {
  if (field.hidden?.({ mode, values })) return null;
  const disabled = field.disabled?.({ mode, values }) ?? mode === "view";

  const common = {
    name: field.name,
    label: field.label,
    placeholder: field.placeholder,
    rules: toRules(field),
    disabled,
    ...field.extraProps,
  };

  switch (field.type) {
    case "select":
      return <HookFormSelect {...common} options={useOptions(field.options)} />;
    case "textarea":
      return <HookFormInput {...common} type="text" />;
    case "number":
    case "date":
    case "text":
    default:
      return <HookFormInput {...common} type={field.type} />;
  }
};

export function FormRenderer({
  config,
  mode,
  initialValues,
  onSubmit,
  onDelete,
  onNew,
}: {
  config: FormConfig;
  mode: FormMode;
  initialValues?: any;
  onSubmit: (data: any) => void | Promise<void>;
  onDelete?: () => void;
  onNew?: () => void;
}) {
  const defaults = useMemo(
    () =>
      config.defaults
        ? config.defaults(initialValues, mode)
        : initialValues ?? {},
    [config, initialValues, mode]
  );

  const methods = useForm({ defaultValues: defaults });
  const {
    handleSubmit,
    watch,
    formState: { isSubmitting },
  } = methods;
  const values = watch();

  return (
    <HookForm methods={methods} onSubmit={handleSubmit(onSubmit)}>
      <div className="bg-[#B23636]  text-white px-4 py-3 rounded-t-2xl flex items-center justify-between">
        <h1 className="text-base font-semibold">
          {mode === "create" ? config.title.create : config.title.edit}
        </h1>
        <div className="flex items-center gap-2">
          {mode === "edit" &&
            onDelete &&
            config.actions?.showDelete !== false && (
              <button
                type="button"
                onClick={onDelete}
                className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
              >
                Eliminar
              </button>
            )}
          {mode !== "edit" && onNew && config.actions?.showNew !== false && (
            <button
              type="button"
              onClick={onNew}
              className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 transition-colors"
            >
              Nuevo
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-70"
          >
            Guardar
          </button>
        </div>
      </div>

      <div className="p-6 sm:p-8 grid gap-6">
        {config.sections.map((section) => (
          <div
            key={section.id}
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${
                section.columns ?? 2
              }, minmax(0, 1fr))`,
            }}
          >
            {section.title && (
              <div className="col-span-full text-sm font-semibold text-slate-700">
                {section.title}
              </div>
            )}
            {section.fields.map((fname) => {
              const field = config.fields.find((f) => f.name === fname);
              if (!field) return null;
              return (
                <FieldRenderer
                  key={fname}
                  field={field}
                  mode={mode}
                  values={values}
                />
              );
            })}
          </div>
        ))}
      </div>
    </HookForm>
  );
}
