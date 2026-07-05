import {
  forwardRef,
  useImperativeHandle,
  useRef,
  type InputHTMLAttributes,
} from "react";

type NavigableNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "type"
> & {
  value: string | number;
  onChange: (value: string) => void;
  navGroup?: string;
  selectOnFocus?: boolean;
};

const NavigableNumberInput = forwardRef<
  HTMLInputElement,
  NavigableNumberInputProps
>(
  (
    {
      value,
      onChange,
      navGroup = "navigable-number-input",
      selectOnFocus = true,
      className = "",
      onKeyDown,
      onFocus,
      style,
      ...rest
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => inputRef.current);

    const focusSibling = (direction: "prev" | "next") => {
      const current = inputRef.current;
      if (!current) return;
      const selector = `[data-nav-group="${navGroup}"]`;
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(selector)
      );
      const currentIndex = inputs.indexOf(current);
      if (currentIndex === -1) return;

      const nextIndex =
        direction === "prev" ? currentIndex - 1 : currentIndex + 1;
      const target = inputs[nextIndex];
      if (target) {
        target.focus();
        if (typeof target.select === "function") {
          target.select();
        }
      }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        focusSibling("prev");
      } else if (event.key === "ArrowDown" || event.key === "Enter") {
        event.preventDefault();
        focusSibling("next");
      }

      onKeyDown?.(event);
    };

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      if (selectOnFocus) {
        event.target.select();
      }
      onFocus?.(event);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    };

    return (
      <input
        {...rest}
        ref={inputRef}
        type="number"
        inputMode="decimal"
        data-nav-group={navGroup}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        className={`appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${className}`}
        style={{ ...(style ?? {}), MozAppearance: "textfield" }}
      />
    );
  }
);

NavigableNumberInput.displayName = "NavigableNumberInput";

export default NavigableNumberInput;
