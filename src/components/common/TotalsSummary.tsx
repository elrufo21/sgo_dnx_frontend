import type { ReactNode } from "react";

type TotalItem = { label: string; value: ReactNode; className?: string };

export function TotalsSummary({ items }: { items: [TotalItem, TotalItem] | [TotalItem, TotalItem, TotalItem] }) {
  return (
    <div className="flex justify-end">
      <div className={`grid w-full max-w-3xl grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white ${items.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {items.map((item, index) => (
          <div key={item.label} className={`px-4 py-3 text-right ${index < items.length - 1 ? "border-b border-slate-200 sm:border-b-0 sm:border-r" : ""} ${item.className ?? ""}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
            <p className={`text-xl font-semibold ${index === items.length - 1 ? "text-slate-900" : "text-slate-800"}`}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
