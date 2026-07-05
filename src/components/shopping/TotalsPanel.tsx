import React, { useMemo } from "react";
import type { ShoppingItem } from "@/types/shopping";

export interface TotalsPanelProps {
  tableData: ShoppingItem[];
  descuento: number;
  percepcion: number;
  onChangeDescuento: (value: number) => void;
  onChangePercepcion: (value: number) => void;
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

export default function TotalsPanel({
  tableData,
  descuento,
  percepcion,
  onChangeDescuento,
  onChangePercepcion,
}: TotalsPanelProps) {
  const { valorVenta, subTotal, igv, total } = useMemo(() => {
    const items = tableData?.filter((i) => i.productId !== null) ?? [];
    const valorVentaCalc = items.reduce((acc, item) => {
      const cantidad = Number(item.cantidad ?? 0) || 0;
      const costo = Number(item.preCosto ?? 0) || 0;
      const desc = Number(item.descuento ?? 0) || 0;
      const lineTotal = Math.max(0, costo * cantidad - desc);
      return acc + lineTotal;
    }, 0);
    const sub = Math.max(0, valorVentaCalc - (Number(descuento) || 0));
    const igvCalc = sub * 0.18;
    const totalCalc = sub + igvCalc + (Number(percepcion) || 0);
    return {
      valorVenta: valorVentaCalc,
      subTotal: sub,
      igv: igvCalc,
      total: totalCalc,
    };
  }, [tableData, descuento, percepcion]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm">
      <div className="grid grid-cols-[1.1fr,1fr] gap-1.5 text-[13px] text-gray-700">
        <LabelCell title="Valor venta" />
        <ValueCell value={formatMoney(valorVenta)} muted />

        <LabelCell title="Descuento" />
        <ValueEditable
          value={descuento}
          onChange={onChangeDescuento}
          placeholder="0.00"
        />

        <LabelCell title="Sub total" />
        <ValueCell value={formatMoney(subTotal)} muted />

        <LabelCell title="IGV (18%)" />
        <ValueCell value={formatMoney(igv)} muted />

        <LabelCell title="Percepcion" />
        <ValueEditable
          value={percepcion}
          onChange={onChangePercepcion}
          placeholder="0.00"
          accent
        />

        <div className="col-span-2 border-t border-gray-200 pt-2 grid grid-cols-[1.1fr,1fr] items-center">
          <span className="font-semibold text-gray-800">Total</span>
          <div className="text-right font-semibold text-gray-900 text-sm">
            {formatMoney(total)}
          </div>
        </div>
      </div>
    </div>
  );
}

function LabelCell({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="font-medium">{title}</span>
      {children}
    </div>
  );
}

function ValueCell({
  value,
  muted = false,
  accent = false,
}: {
  value: string;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <div
      className={`text-right rounded-md px-2 py-1 ${
        accent
          ? "bg-purple-600 text-white font-semibold"
          : muted
          ? "bg-slate-50 text-slate-600"
          : "bg-white text-gray-900 font-medium"
      } border border-slate-200`}
    >
      {value}
    </div>
  );
}

function ValueEditable({
  value,
  onChange,
  placeholder,
  accent = false,
}: {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  accent?: boolean;
}) {
  return (
    <input
      type="number"
      step="0.01"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className={`w-full px-2 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-100 text-right ${
        accent ? " font-semibold" : "bg-white"
      }`}
      placeholder={placeholder}
    />
  );
}
