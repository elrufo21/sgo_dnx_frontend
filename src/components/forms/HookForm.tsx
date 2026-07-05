import type { ReactNode, KeyboardEvent } from "react";
import type {
  FieldValues,
  SubmitHandler,
  UseFormReturn,
} from "react-hook-form";
import { FormProvider } from "react-hook-form";

interface HookFormProps<T extends FieldValues> {
  methods: UseFormReturn<T>;
  onSubmit: SubmitHandler<T>;
  children: ReactNode;
  className?: string;
  formId?: string;
  preventSubmitOnEnter?: boolean;
}

export function HookForm<T extends FieldValues>({
  methods,
  onSubmit,
  children,
  className,
  formId,
  preventSubmitOnEnter = false,
}: HookFormProps<T>) {
  const handleKeyDownCapture = (event: KeyboardEvent<HTMLFormElement>) => {
    if (!preventSubmitOnEnter) return;
    if (event.key !== "Enter") return;

    const target = event.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    const type = (target as HTMLInputElement | null)?.type?.toLowerCase();
    const isButtonLike = tag === "button" || type === "submit" || type === "button";
    const isTextArea = tag === "textarea";

    if (isTextArea || isButtonLike) return;

    event.preventDefault();
  };

  return (
    <FormProvider {...methods}>
      <form
        className={className}
        id={formId}
        onSubmit={methods.handleSubmit(onSubmit)}
        onKeyDownCapture={handleKeyDownCapture}
        autoComplete="off"
        data-lpignore="true"
        data-1p-ignore="true"
        data-bwignore="true"
        data-form-type="other"
        noValidate
      >
        {children}
      </form>
    </FormProvider>
  );
}
