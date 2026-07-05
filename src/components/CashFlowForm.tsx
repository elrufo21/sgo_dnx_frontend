import React, { useEffect, useMemo, useRef, useState } from "react";
import { Save, Printer, X, Plus, Trash2 } from "lucide-react";
import { useUsersStore } from "@/store/users/users.store";
import { BackArrowButton } from "@/components/common/BackArrowButton";

// Mock components para demostración
const HookFormInput = ({
  name,
  label,
  labelClassName,
  inputClassName,
  value,
  onChange,
  readOnly,
  disabled,
  ...props
}) => (
  <div className="space-y-1">
    <label
      className={labelClassName || "block text-sm font-semibold text-gray-700"}
    >
      {label}
    </label>
    <input
      name={name}
      value={value}
      onChange={onChange}
      className={
        inputClassName ||
        "w-full px-3 py-2 border border-gray-200 rounded-md focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
      }
      readOnly={readOnly}
      disabled={disabled}
      {...props}
    />
  </div>
);

const HookFormAutocomplete = ({
  name,
  label,
  options,
  placeholder,
  className,
  value,
  onChange,
  disabled,
}) => (
  <div className="space-y-1">
    <label className="block text-xs font-semibold text-gray-700">{label}</label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`w-full px-2 py-1.5 border border-gray-200 rounded-md focus:border-blue-500 outline-none ${className}`}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const HookFormSelect = ({
  name,
  label,
  options,
  labelClassName,
  selectClassName,
  value,
  onChange,
  disabled,
}) => (
  <div className="space-y-1">
    <label
      className={labelClassName || "block text-sm font-semibold text-gray-700"}
    >
      {label}
    </label>
    <select
      name={name}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={`w-full px-2 py-1.5 border border-gray-200 rounded-md outline-none ${selectClassName}`}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

const DEFAULT_CONTEO = [
  { cantidad: "", denominacion: 200.0 },
  { cantidad: "", denominacion: 100.0 },
  { cantidad: "", denominacion: 50.0 },
  { cantidad: "", denominacion: 20.0 },
  { cantidad: "", denominacion: 10.0 },
  { cantidad: "", denominacion: 5.0 },
  { cantidad: "", denominacion: 2.0 },
  { cantidad: "", denominacion: 1.0 },
  { cantidad: "", denominacion: 0.5 },
  { cantidad: "", denominacion: 0.2 },
  { cantidad: "", denominacion: 0.1 },
];

const DEFAULT_VENTA_TOTAL = {
  efectivo: 0,
  tarjeta: 0,
  deposito: 0,
};

export default function CashFlowForm({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  const containerRef = useRef(null);
  const monedaInputRefs = useRef([]);
  const { users, fetchUsers } = useUsersStore();
  const [nuevoMovimiento, setNuevoMovimiento] = useState({
    id: Date.now(),
    descripcion: "",
    importe: 0,
  });
  const [tipoMovimiento, setTipoMovimiento] = useState("ingresos");

  const [formData, setFormData] = useState({
    caja: "",
    encargado: "",
    sencillo: 0,
    estado: "ABIERTA",
    fechaApertura: new Date().toISOString(),
    fechaCierre: "",
    observaciones: "",
    conteoMonedas: DEFAULT_CONTEO,
    ingresos: [
      { id: Date.now(), descripcion: "Ingreso inicial", importe: 150 },
      { id: Date.now() + 1, descripcion: "Venta referencial", importe: 320 },
    ],
    gastos: [],
    ventaTotal: DEFAULT_VENTA_TOTAL,
  });

  const handleCantidadChange = (index, valor) => {
    const cantidad = valor === "" ? "" : parseInt(valor, 10) || 0;
    const updated = [...formData.conteoMonedas];
    updated[index] = { ...updated[index], cantidad };
    setFormData((prev) => ({ ...prev, conteoMonedas: updated }));
  };

  const focusMonedaAt = (index: number) => {
    const input = monedaInputRefs.current[index];
    if (input) {
      input.focus();
      input.select?.();
    }
  };

  const focusNextMoneda = (index: number) => {
    focusMonedaAt(index + 1);
  };

  const focusPrevMoneda = (index: number) => {
    if (index <= 0) return;
    focusMonedaAt(index - 1);
  };

  useEffect(() => {
    if (users.length === 0) {
      fetchUsers();
    }
  }, [users.length, fetchUsers]);

  const eliminarMovimiento = (id, tipo) => {
    if (tipo === "ingresos") {
      setFormData((prev) => ({
        ...prev,
        ingresos: prev.ingresos.filter((item) => item.id !== id),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        gastos: prev.gastos.filter((item) => item.id !== id),
      }));
    }
  };

  const totalEfectivo = formData.conteoMonedas.reduce((sum, item) => {
    const cantidad = Number(item.cantidad || 0);
    return sum + cantidad * item.denominacion;
  }, 0);
  const totalIngresos = formData.ingresos.reduce(
    (sum, item) => sum + item.importe,
    0
  );
  const totalGastos = formData.gastos.reduce(
    (sum, item) => sum + item.importe,
    0
  );
  const efectivoCaja = totalIngresos - totalGastos;
  const ventasBO_FA =
    (formData.ventaTotal.efectivo ?? 0) +
    (formData.ventaTotal.tarjeta ?? 0) +
    (formData.ventaTotal.deposito ?? 0);
  const diferencial = totalEfectivo - totalIngresos;
  const diferencialClass =
    diferencial > 0
      ? "text-blue-700"
      : diferencial < 0
      ? "text-red-600"
      : "text-slate-800";
  const totalVenta = ventasBO_FA;
  const totalBilletes = formData.conteoMonedas
    .filter((item) => item.denominacion >= 10)
    .reduce((sum, item) => {
      const cantidad = Number(item.cantidad || 0);
      return sum + cantidad * item.denominacion;
    }, 0);
  const totalSencillo = formData.conteoMonedas
    .filter((item) => item.denominacion <= 5)
    .reduce((sum, item) => {
      const cantidad = Number(item.cantidad || 0);
      return sum + cantidad * item.denominacion;
    }, 0);

  const userOptions = useMemo(
    () =>
      (users ?? []).map((u) => ({
        label: u.UsuarioAlias ?? `Usuario ${u.UsuarioID}`,
        value: String(u.UsuarioID),
        data: u,
      })),
    [users]
  );

  const setFechaCierre = () => {
    setFormData((prev) => ({
      ...prev,
      estado: "CERRADA",
      fechaCierre: new Date().toISOString(),
    }));
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Pendiente";
    return new Date(dateString).toLocaleString("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  return (
    <div
      ref={containerRef}
      className=" bg-gray-50 flex flex-col overflow-visible"
    >
      <div className="sticky top-2 z-30 bg-[#B23636] text-white px-2 sm:px-4 py-2 flex items-center justify-between flex-shrink-0 shadow-lg shadow-black/10">
        <div className="flex items-center gap-2">
          <BackArrowButton className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/30 bg-white/10 text-white hover:bg-white/20 transition-colors" />
          <h1 className="text-xs sm:text-sm font-semibold">
            Nuevo Control de Flujo de Caja
          </h1>
        </div>
        <div className="flex gap-1 sm:gap-2">
          <button
            className="p-1 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
            title="Guardar"
          >
            <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          <button className="p-1 hover:bg-slate-700 rounded" title="Imprimir">
            <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
          {formData.estado === "ABIERTA" && (
            <button
              onClick={setFechaCierre}
              type="button"
              className="p-1 hover:bg-slate-700 rounded"
              title="Cerrar Caja"
            >
              <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2 sm:p-3">
          <div className="space-y-3">
            <div className="bg-white rounded border border-gray-200 p-2 mb-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 mb-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                  <div className="col-span-2">
                    <HookFormAutocomplete
                      name="encargado"
                      label="Encargado"
                      value={formData.encargado}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          encargado: e.target.value,
                        }))
                      }
                      options={userOptions}
                      placeholder="Seleccionar usuario"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <HookFormInput
                      name="sencillo"
                      label="Sencillo"
                      type="number"
                      value={formData.sencillo}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          sencillo: parseFloat(e.target.value) || 0,
                        }))
                      }
                      inputClassName="text-xs py-1.5 px-2 w-full border border-gray-200 rounded-md"
                      labelClassName="text-xs font-semibold text-gray-700"
                      step="any"
                    />
                  </div>
                  <div className="">
                    <HookFormSelect
                      name="estado"
                      label="Estado"
                      value={formData.estado}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          estado: e.target.value,
                        }))
                      }
                      options={[
                        { value: "ABIERTA", label: "ABIERTA" },
                        { value: "CERRADA", label: "CERRADA" },
                      ]}
                      labelClassName="text-xs font-semibold text-gray-700"
                      selectClassName={`text-center font-medium text-xs ${
                        formData.estado === "ABIERTA"
                          ? "bg-green-50 text-green-700 border-green-200 focus:border-green-400"
                          : "bg-red-50 text-red-700 border-red-200 focus:border-red-400"
                      }`}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 mb-3">
                  <div>
                    <HookFormInput
                      name="fechaApertura"
                      label="Apertura"
                      value={formatDate(formData.fechaApertura)}
                      onChange={() => {}}
                      readOnly
                      inputClassName="text-xs py-1.5 px-2 w-full border border-gray-200 rounded-md"
                      labelClassName="text-xs font-semibold text-gray-700"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-1">
                    <HookFormInput
                      name="fechaCierre"
                      label="Cierre"
                      value={formatDate(formData.fechaCierre)}
                      onChange={() => {}}
                      readOnly
                      inputClassName="text-xs py-1.5 px-2 w-full border border-gray-200 rounded-md"
                      labelClassName="text-xs font-semibold text-gray-700"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3"></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-white rounded border border-gray-200 p-2">
                <h3 className="text-xs font-semibold mb-2 text-gray-700">
                  Conteo Monedas
                </h3>
                <div className="border border-gray-200 rounded overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs table-fixed min-w-[280px]">
                      <thead className="bg-slate-50 text-slate-700 border-b border-gray-200">
                        <tr>
                          <th className="py-1 px-2 text-center font-semibold text-xs w-1/3">
                            Efectivo
                          </th>
                          <th className="py-1 px-2 text-center font-semibold text-xs w-1/3">
                            Billete
                          </th>
                          <th className="py-1 px-2 text-center font-semibold text-xs w-1/3">
                            Monto
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {formData.conteoMonedas.map((item, idx) => {
                          const cantidad = Number(item.cantidad || 0);
                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-0.5 px-2 w-1/3">
                                <input
                                  ref={(el) =>
                                    (monedaInputRefs.current[idx] = el)
                                  }
                                  type="number"
                                  value={
                                    item.cantidad === "" ? "" : item.cantidad
                                  }
                                  onChange={(e) =>
                                    handleCantidadChange(idx, e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      focusNextMoneda(idx);
                                    } else if (e.key === "ArrowDown") {
                                      e.preventDefault();
                                      focusNextMoneda(idx);
                                    } else if (e.key === "ArrowUp") {
                                      e.preventDefault();
                                      focusPrevMoneda(idx);
                                    }
                                  }}
                                  className="w-full min-w-0 px-1 py-0.5 border border-gray-200 rounded text-center focus:border-slate-500 focus:outline-none text-xs"
                                />
                              </td>
                              <td className="py-0.5 px-2 text-right text-gray-700 text-xs w-1/3">
                                {item.denominacion.toFixed(2)}
                              </td>
                              <td className="py-0.5 px-2 text-right font-semibold text-slate-800 text-xs w-1/3">
                                {(cantidad * item.denominacion).toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-slate-900 text-white font-semibold text-right px-2 py-1.5 text-xs">
                    Total S/ {totalEfectivo.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Segunda fila - Columna derecha: Otros Movimientos */}
              <div className="bg-white rounded border border-gray-200 p-2">
                <h3 className="text-xs font-semibold mb-2 text-gray-700">
                  Otros Movimientos
                </h3>
                <div className="flex gap-1 mb-2">
                  <button
                    type="button"
                    onClick={() => setTipoMovimiento("ingresos")}
                    className={`flex-1 py-1 text-xs rounded font-medium ${
                      tipoMovimiento === "ingresos"
                        ? "bg-slate-800 text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    Ingresos
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoMovimiento("gastos")}
                    className={`flex-1 py-1 text-xs rounded font-medium ${
                      tipoMovimiento === "gastos"
                        ? "bg-slate-800 text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    Gastos
                  </button>
                </div>

                <div className="border border-gray-200 rounded overflow-hidden h-[min(40vh,265px)] min-h-[180px] overflow-y-auto mb-2">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[280px]">
                      <thead className="sticky top-0 bg-slate-800 text-white">
                        <tr>
                          <th className="text-left py-1 px-2 font-medium text-xs">
                            Descripción
                          </th>
                          <th className="text-right py-1 px-2 font-medium text-xs whitespace-nowrap">
                            Importe
                          </th>
                          <th className="w-7 py-1 px-1"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tipoMovimiento === "ingresos"
                          ? formData.ingresos
                          : formData.gastos
                        ).map((item, idx) => (
                          <tr
                            key={item.id}
                            className={
                              idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                            }
                          >
                            <td className="py-1 px-2 text-xs break-words">
                              {item.descripcion}
                            </td>
                            <td className="text-right py-1 px-2 font-medium text-xs whitespace-nowrap">
                              S/ {item.importe.toFixed(2)}
                            </td>
                            <td className="py-1 px-1">
                              <button
                                type="button"
                                onClick={() =>
                                  eliminarMovimiento(item.id, tipoMovimiento)
                                }
                                className="p-0.5 text-red-600 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-slate-800 text-white p-2 rounded">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-xs font-medium">
                      Efectivo en Caja
                    </span>
                    <span className="text-base sm:text-lg font-bold whitespace-nowrap">
                      S/ {efectivoCaja.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tercera fila - Columna izquierda: Detalles, Columna derecha: Venta Total */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="bg-white rounded border border-gray-200 p-2">
                <h3 className="text-xs font-semibold mb-2 text-gray-700">
                  Detalles
                </h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 w-24 sm:w-28 flex-shrink-0">
                      Tot. Billetes:
                    </span>
                    <input
                      disabled
                      value={`S/ ${totalBilletes.toFixed(2)}`}
                      className="flex-1 px-2 py-1 border  rounded text-right font-semibold text-slate-800 bg-white text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold  w-24 sm:w-28 flex-shrink-0">
                      Tot. Sencillo:
                    </span>
                    <input
                      disabled
                      value={`S/ ${totalSencillo.toFixed(2)}`}
                      className="flex-1 px-2 py-1 border rounded text-right font-semibold text-slate-800 bg-gray-50 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 w-24 sm:w-28 flex-shrink-0">
                      Diferencial:
                    </span>
                    <input
                      disabled
                      value={`S/ ${diferencial.toFixed(2)}`}
                      className={`flex-1 px-2 py-1 border  rounded text-right font-semibold text-xs ${diferencialClass}`}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                    <span className="text-xs font-bold text-slate-800 sm:w-28 flex-shrink-0">
                      Observaciones:
                    </span>
                    <textarea
                      value={formData.observaciones}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          observaciones: e.target.value,
                        }))
                      }
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:border-slate-500 focus:outline-none w-full"
                      rows={2}
                      placeholder="Escriba sus observaciones..."
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded border border-gray-200 p-2">
                <h3 className="text-xs font-semibold mb-2 text-gray-700">
                  Venta Total
                </h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-gray-700 flex-shrink-0">
                      Ingresos:
                    </span>
                    <input
                      type="number"
                      value={formData.ventaTotal.efectivo || ""}
                      disabled
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          ventaTotal: {
                            ...prev.ventaTotal,
                            efectivo: parseFloat(e.target.value) || 0,
                          },
                        }))
                      }
                      className="w-28 sm:w-32 px-2 py-1 border border-gray-300 rounded text-right font-semibold focus:border-slate-500 focus:outline-none"
                      step="0.01"
                    />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-gray-700 flex-shrink-0">
                      Tarjeta:
                    </span>
                    <input
                      type="number"
                      value={formData.ventaTotal.tarjeta || ""}
                      disabled
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          ventaTotal: {
                            ...prev.ventaTotal,
                            tarjeta: parseFloat(e.target.value) || 0,
                          },
                        }))
                      }
                      className="w-28 sm:w-32 px-2 py-1 border border-gray-300 rounded text-right font-semibold text-blue-700 focus:border-slate-500 focus:outline-none"
                      step="0.01"
                    />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-gray-700 flex-shrink-0">
                      Depósitos y/o Yape:
                    </span>
                    <input
                      type="number"
                      value={formData.ventaTotal.deposito || ""}
                      disabled
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          ventaTotal: {
                            ...prev.ventaTotal,
                            deposito: parseFloat(e.target.value) || 0,
                          },
                        }))
                      }
                      className="w-28 sm:w-32 px-2 py-1 border border-gray-300 rounded text-right font-semibold text-green-700 focus:border-slate-500 focus:outline-none"
                      step="0.01"
                    />
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-semibold text-gray-700 flex-shrink-0">
                      Salidas:
                    </span>
                    <div className="w-28 sm:w-32 px-2 py-1 bg-red-500 text-white rounded text-right font-bold">
                      S/ {totalGastos.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-1.5 border-t border-gray-200 gap-2">
                    <span className="text-xs font-bold flex-shrink-0">
                      Total:
                    </span>
                    <div className="w-28 sm:w-32 px-2 py-1 border border-gray-300 rounded text-right font-bold bg-white">
                      S/ {totalVenta.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

