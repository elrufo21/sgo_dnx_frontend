import React, { useMemo } from "react";
import type { SendNoteItem } from "@/types/sendNote";

export interface SendNoteTotalsPanelProps {
  tableData: SendNoteItem[];
  descuento: number;
  adicional: number;
  efectivo: number;
  deposito: number;
  onChangeDescuento: (value: number) => void;
  onChangeAdicional: (value: number) => void;
  onChangeEfectivo: (value: number) => void;
  onChangeDeposito: (value: number) => void;
}

const formatMoney = (value: number) =>
  new Intl.NumberFormat("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

export default function SendNoteTotalsPanel({
  tableData,
  descuento,
  adicional,
  efectivo,
  deposito,
  onChangeDescuento,
  onChangeAdicional,
  onChangeEfectivo,
  onChangeDeposito,
}: SendNoteTotalsPanelProps) {
  const { opGravada, subTotal, igv, total } = useMemo(() => {
    const items = tableData?.filter((i) => i.productId !== null) ?? [];
    const opGravadaCalc = items.reduce((acc, item) => {
      const qty = Number(item.cantidad ?? 0) || 0;
      const costo = Number(item.preCosto ?? 0) || 0;
      const desc = Number(item.descuento ?? 0) || 0;
      const line = Math.max(0, costo * qty - desc);
      return acc + line;
    }, 0);
    const sub = Math.max(
      0,
      opGravadaCalc + (Number(adicional) || 0) - (Number(descuento) || 0)
    );
    const igvCalc = sub * 0.18;
    const totalCalc = sub + igvCalc;

    return {
      opGravada: opGravadaCalc,
      subTotal: sub,
      igv: igvCalc,
      total: totalCalc,
    };
  }, [tableData, descuento, adicional]);

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
      <div className="grid grid-cols-[1.1fr,1fr] gap-1.5 text-[13px] text-gray-700">
        <LabelCell title="Op Gravada" />
        <ValueCell value={formatMoney(opGravada)} muted />

        <LabelCell title="Descuento" />
        <ValueEditable
          value={descuento}
          onChange={onChangeDescuento}
          placeholder="0.00"
        />

        <LabelCell title="Adic. 0.0" />
        <ValueEditable
          value={adicional}
          onChange={onChangeAdicional}
          placeholder="0.00"
        />

        <LabelCell title="Sub Total" />
        <ValueCell value={formatMoney(subTotal)} muted />

        <LabelCell title="IGV (18%)" />
        <ValueCell value={formatMoney(igv)} muted />

        <LabelCell title="Efectivo" />
        <ValueEditable
          value={efectivo}
          onChange={onChangeEfectivo}
          placeholder="0.00"
        />

        <LabelCell title="Deposito" />
        <ValueEditable
          value={deposito}
          onChange={onChangeDeposito}
          placeholder="0.00"
        />

        <div className="col-span-2 border-t border-gray-200 pt-2 grid grid-cols-[1.1fr,1fr] items-center">
          <span className="font-semibold text-gray-800">Total pago</span>
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
