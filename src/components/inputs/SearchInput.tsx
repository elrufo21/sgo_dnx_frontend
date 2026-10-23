import { forwardRef, type InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";

type SearchInputProps = InputHTMLAttributes<HTMLInputElement> & {
  onClear?: () => void;
};

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ onClear, value, ...props }, ref) => (
    <div className="relative w-full lg:w-[26rem] xl:w-[34rem]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        {...props}
        ref={ref}
        data-no-uppercase="true"
        className="h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-9 text-sm text-slate-800 outline-none transition focus:border-[#B23636] focus:ring-2 focus:ring-[#B23636]/20 disabled:bg-slate-50"
        value={value}
      />
      {onClear && value ? (
        <button
          type="button"
          onClick={onClear}
          disabled={props.disabled}
          className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  ),
);

SearchInput.displayName = "SearchInput";
export default SearchInput;
