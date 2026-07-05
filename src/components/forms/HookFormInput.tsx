import type {
  ChangeEvent,
  FocusEvent,
  InputHTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from "react";
import { useRef } from "react";
import type { FieldValues, Path, RegisterOptions } from "react-hook-form";
import { Controller, useFormContext } from "react-hook-form";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import {
  focusNextInput,
  focusPreviousInput,
} from "@/shared/helpers/focusNextInput";

type HookFormInputProps<T extends FieldValues> = {
  name: Path<T>;
  label: string;
  rules?: RegisterOptions<T>;
  helperText?: string;
  endAdornment?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name">;

export function HookFormInput<T extends FieldValues>({
  name,
  label,
  rules,
  helperText,
  className,
  onKeyDown,
  onChange,
  onBlur,
  type = "text",
  disabled,
  placeholder,
  endAdornment,
  ...inputProps
}: HookFormInputProps<T>) {
  const isComposingRef = useRef(false);
  const {
    control,
    formState: { isSubmitting },
  } = useFormContext<T>();
  const normalizedType = String(type ?? "text").toLowerCase();
  const isTextLike =
    normalizedType === "password" ||
    normalizedType === "text" ||
    normalizedType === "email" ||
    normalizedType === "search" ||
    normalizedType === "tel" ||
    normalizedType === "url" ||
    normalizedType === "number";
  const requiresShrinkLabel =
    normalizedType === "date" ||
    normalizedType === "time" ||
    normalizedType === "datetime-local" ||
    normalizedType === "month" ||
    normalizedType === "week";
  const explicitAutoComplete =
    typeof inputProps.autoComplete === "string"
      ? inputProps.autoComplete
      : undefined;
  const isAuthAutoCompleteField =
    explicitAutoComplete === "username" ||
    explicitAutoComplete === "current-password";
  const maskedNameRef = useRef(
    `sgo_${Math.random().toString(36).slice(2, 14)}`,
  );
  const resolvedDomName = isAuthAutoCompleteField
    ? String(name)
    : maskedNameRef.current;
  const shouldMaskPassword = normalizedType === "password";
  const resolvedInputType = shouldMaskPassword ? "text" : type;
  const resolvedAutoComplete =
    explicitAutoComplete ??
    (normalizedType === "password"
      ? "one-time-code"
      : isTextLike
        ? "one-time-code"
        : undefined);

  return (
    <div className="mt-1">
      {" "}
      <Controller
        control={control}
        name={name}
        rules={rules}
        render={({ field, fieldState }) => {
          const isNumberType = type === "number";
          const displayValue =
            field.value === null || field.value === undefined
              ? ""
              : field.value;

          const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
            field.onChange(event.target.value);
            onChange?.(event);
          };

          const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
            const currentValue = event.currentTarget.value;
            const comparableFieldValue =
              field.value === null || field.value === undefined
                ? ""
                : String(field.value);
            if (currentValue !== comparableFieldValue) {
              field.onChange(currentValue);
            }
            field.onBlur();
            onBlur?.(event);
          };

          const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
            onKeyDown?.(event);
            if (event.defaultPrevented) return;
            if (
              isComposingRef.current ||
              event.nativeEvent.isComposing ||
              event.key === "Process"
            ) {
              return;
            }
            const source = event.target as HTMLElement;
            const input = event.target as HTMLInputElement;

            const shouldMoveHorizontal = (
              direction: "left" | "right",
            ): boolean => {
              const start = input.selectionStart;
              const end = input.selectionEnd;
              if (start === null || end === null) return true;
              if (start !== end) return false;
              return direction === "left"
                ? start === 0
                : end === input.value.length;
            };

            if (event.key === "ArrowUp") {
              event.preventDefault();
              focusPreviousInput(source);
              return;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              focusNextInput(source);
              return;
            }

            if (event.key === "ArrowLeft" && shouldMoveHorizontal("left")) {
              event.preventDefault();
              focusPreviousInput(source);
              return;
            }

            if (event.key === "ArrowRight" && shouldMoveHorizontal("right")) {
              event.preventDefault();
              focusNextInput(source);
              return;
            }

            if (event.key === "Enter") {
              event.preventDefault();
              const moved = focusNextInput(source);
              if (!moved) {
                event.currentTarget.form?.requestSubmit();
              }
            }
          };

          return (
            <TextField
              fullWidth
              size="small"
              variant="outlined"
              label={label}
              InputLabelProps={
                requiresShrinkLabel ? { shrink: true } : undefined
              }
              type={resolvedInputType}
              value={displayValue}
              onChange={handleChange}
              onBlur={handleBlur}
              onCompositionStart={() => {
                isComposingRef.current = true;
              }}
              onCompositionEnd={(event) => {
                isComposingRef.current = false;
                const currentValue = event.currentTarget.value;
                if (currentValue !== (field.value ?? "")) {
                  field.onChange(currentValue);
                }
              }}
              onKeyDown={handleKeyDown}
              name={resolvedDomName}
              inputRef={field.ref}
              disabled={disabled || isSubmitting}
              placeholder={placeholder}
              autoComplete={resolvedAutoComplete}
              error={!!fieldState.error}
              helperText={fieldState.error?.message ?? helperText}
              InputProps={
                endAdornment
                  ? {
                      endAdornment: (
                        <InputAdornment position="end">
                          {endAdornment}
                        </InputAdornment>
                      ),
                    }
                  : undefined
              }
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "0.45rem",
                  backgroundColor: "#fff",
                  "& fieldset": {
                    borderWidth: "1px",
                    borderColor: "#e5e7eb",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#3b82f6",
                    boxShadow: "0 0 0 2px rgba(59,130,246,0.25)",
                  },
                },
                "& .MuiOutlinedInput-input": {
                  fontSize: "0.875rem",
                  py: 1,
                  ...(shouldMaskPassword
                    ? { WebkitTextSecurity: "disc" }
                    : {}),
                },
                ...(isNumberType
                  ? {
                      "& input[type=number]": {
                        MozAppearance: "textfield",
                      },
                      "& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button":
                        {
                          WebkitAppearance: "none",
                          margin: 0,
                        },
                    }
                  : {}),
              }}
              inputProps={{
                ...inputProps,
                className,
                "data-auto-next": "true",
                ...(normalizedType === "email"
                  ? { "data-no-uppercase": "true" }
                  : {}),
                name: resolvedDomName,
                autoComplete: resolvedAutoComplete,
                ...(isTextLike
                  ? {
                      "aria-autocomplete": "none",
                      autoCorrect: "off",
                      autoCapitalize: "off",
                      spellCheck: false,
                      "data-lpignore": "true",
                      "data-1p-ignore": "true",
                      "data-bwignore": "true",
                      "data-form-type": "other",
                    }
                  : {}),
              }}
            />
          );
        }}
      />
    </div>
  );
}
