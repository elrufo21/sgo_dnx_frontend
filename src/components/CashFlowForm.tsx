import React, { useCallback, useEffect, useRef, useState } from "react";
import { Lock, Printer, Save, Trash2, Unlock } from "lucide-react";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { useAuthStore } from "@/store/auth/auth.store";
import { useCashFlowStore } from "@/store/cashFlow/cashFlow.store";
import { useUsersStore } from "@/store/users/users.store";
import { useCashFlowProductsWebStore } from "@/store/cashFlowProductsWeb/cashFlowProductsWeb.store";
import { useCashFlowMovementsWebStore } from "@/store/cashFlowMovementsWeb/cashFlowMovementsWeb.store";
import { useDialogStore } from "@/store/app/dialog.store";
import type { ActiveCashFlow } from "@/types/cashFlow";
import { toast } from "@/shared/ui/toast";
import {
  focusNextInput,
  focusPreviousInput,
} from "@/shared/helpers/focusNextInput";
import { useLocation, useNavigate, useParams } from "react-router";

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
      data-auto-next={readOnly || disabled ? undefined : "true"}
    />
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
      onChange={(event) => {
        onChange(event);
        focusNextInput(event.currentTarget);
      }}
      disabled={disabled}
      className={`w-full px-2 py-1.5 border border-gray-200 rounded-md outline-none ${selectClassName}`}
      data-auto-next={disabled ? undefined : "true"}
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

const EDITABLE_INGRESOS = new Set([
  "VITRINA",
  "REVISTAS",
  "COPIAS Y OTROS",
]);

const formatMoney = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function CashFlowProductsTab({ cajaId }: { cajaId: number }) {
  const { products, loading, fetchProducts } = useCashFlowProductsWebStore();

  useEffect(() => {
    void fetchProducts(cajaId);
  }, [cajaId, fetchProducts]);

  if (cajaId <= 0) {
    return (
      <div className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-600">
        Primero abre la caja para ver sus productos.
      </div>
    );
  }

  return (
    <section className="rounded border border-slate-200 bg-white p-3">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">
        Productos de la caja
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-slate-800 text-left text-xs text-white">
            <tr>
              <th className="px-3 py-2">Código</th>
              <th className="px-3 py-2">Descripción</th>
              <th className="px-3 py-2 text-right">Cantidad</th>
              <th className="px-3 py-2">UM</th>
              <th className="px-3 py-2 text-right">PV Total</th>
              <th className="px-3 py-2 text-right">SV Total</th>
              <th className="px-3 py-2 text-right">Importe</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr
                key={`${product.codigo}-${product.descripcion}`}
                className="border-b border-slate-100"
              >
                <td className="px-3 py-2">{product.codigo}</td>
                <td className="px-3 py-2">{product.descripcion}</td>
                <td className="px-3 py-2 text-right">
                  {formatMoney(product.cantidad)}
                </td>
                <td className="px-3 py-2">{product.unidadMedida}</td>
                <td className="px-3 py-2 text-right">
                  {formatMoney(product.pvTotal)}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatMoney(product.svTotal)}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {formatMoney(product.importe)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && !products.length && (
        <p className="py-6 text-center text-sm text-slate-500">
          No hay productos para esta caja.
        </p>
      )}
      {loading && (
        <p className="py-6 text-center text-sm text-slate-500">
          Cargando productos...
        </p>
      )}
    </section>
  );
}

export default function CashFlowForm({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { cajaId } = useParams();
  const openDialog = useDialogStore((state) => state.openDialog);
  const sessionUser = useAuthStore((state) => state.user);
  const {
    openCashFlow,
    closeCashFlow,
    updateCashFlowState,
    getCashFlowDetail,
    deleteCashFlow,
    loading,
  } = useCashFlowStore();
  const { users, fetchUsers } = useUsersStore();
  const { fetchMovements, updateManualIngresos } = useCashFlowMovementsWebStore();
  const containerRef = useRef(null);
  const [tipoMovimiento, setTipoMovimiento] = useState("ingresos");
  const [activeTab, setActiveTab] = useState<"caja" | "productos">("caja");
  const [activeCash, setActiveCash] = useState<ActiveCashFlow | null>(null);
  const [responsableId, setResponsableId] = useState<number | null>(null);
  const viewedCashId = Number(cajaId);
  const [isEditing, setIsEditing] = useState(
    () => !(Number.isInteger(viewedCashId) && viewedCashId > 0),
  );
  const sessionUserId = Number(sessionUser?.id);
  const selectedResponsableId = responsableId ?? sessionUserId;
  const responsableOptions = users.map((user) => ({
    value: String(user.UsuarioID),
    label: user.Nombre?.trim() || user.UsuarioAlias,
  }));
  if (
    sessionUserId > 0 &&
    !responsableOptions.some((user) => user.value === String(sessionUserId))
  ) {
    responsableOptions.unshift({
      value: String(sessionUserId),
      label:
        sessionUser?.displayName ||
        sessionUser?.username ||
        "Usuario de sesión",
    });
  }

  const [formData, setFormData] = useState({
    caja: "",
    sencillo: "" as number | "",
    estado: "ABIERTA",
    fechaApertura: new Date().toISOString(),
    fechaCierre: "",
    observaciones: "",
    conteoMonedas: DEFAULT_CONTEO,
    ingresos: [],
    gastos: [],
    ventaTotal: DEFAULT_VENTA_TOTAL,
  });

  useEffect(() => {
    if (!users.length) void fetchUsers();
  }, [fetchUsers, users.length]);

  const isViewing = Number.isInteger(viewedCashId) && viewedCashId > 0;
  const reloadCashFlow = useCallback(async () => {
    if (!isViewing) return;
    const [caja, movements] = await Promise.all([
      getCashFlowDetail(viewedCashId),
      fetchMovements(viewedCashId),
    ]);
    if (!caja) return;

    setActiveCash(caja);
    setFormData((prev) => ({
      ...prev,
      ...movements,
      sencillo: caja.montoInicial,
      fechaApertura: caja.fechaApertura,
      fechaCierre: caja.fechaCierre,
      estado: caja.estado.trim().toUpperCase().startsWith("CERR")
        ? "CERRADA"
        : caja.estado,
      observaciones: caja.observacion,
      conteoMonedas: DEFAULT_CONTEO.map((item) => ({
        ...item,
        cantidad:
          caja.monedas.find(
            (moneda) => moneda.denominacion === item.denominacion,
          )?.cantidad ?? "",
      })),
      ventaTotal: {
        efectivo: caja.ventasEfectivo,
        tarjeta: caja.ventasTarjeta,
        deposito: caja.ventasDeposito,
      },
    }));
  }, [fetchMovements, getCashFlowDetail, isViewing, viewedCashId]);

  useEffect(() => {
    void reloadCashFlow();
  }, [reloadCashFlow]);

  useEffect(() => {
    setIsEditing(!isViewing);
  }, [isViewing]);

  const isClosed =
    activeCash?.estado.trim().toUpperCase().startsWith("CERR") ?? false;
  const isClosing = isViewing && !isClosed;
  const canEdit = !readOnly && (!isViewing || isEditing);

  const handleCantidadChange = (index, valor) => {
    const cantidad = valor === "" ? "" : parseInt(valor, 10) || 0;
    const updated = [...formData.conteoMonedas];
    updated[index] = { ...updated[index], cantidad };
    setFormData((prev) => ({ ...prev, conteoMonedas: updated }));
  };

  const handleIngresoChange = (id: number, value: string) => {
    const importe = value === "" ? 0 : Number(value);
    if (!Number.isFinite(importe) || importe < 0) return;
    setFormData((prev) => ({
      ...prev,
      ingresos: prev.ingresos.map((item) =>
        item.id === id ? { ...item, importe } : item,
      ),
    }));
  };

  const handleKeyboardNavigation = (
    event: React.KeyboardEvent<HTMLElement>,
  ) => {
    const target = event.target;
    if (
      !(
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) ||
      target.dataset.autoNext !== "true"
    )
      return;

    if (event.key === "Enter" || event.key === "ArrowDown") {
      event.preventDefault();
      focusNextInput(target);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusPreviousInput(target);
    }
  };

  const totalEfectivo = formData.conteoMonedas.reduce((sum, item) => {
    const cantidad = Number(item.cantidad || 0);
    return sum + cantidad * item.denominacion;
  }, 0);
  const totalIngresos = isViewing
    ? (activeCash?.ventasEfectivo ?? 0)
    : formData.ingresos.reduce((sum, item) => sum + item.importe, 0);
  const totalGastos = isViewing
    ? (activeCash?.salidas ?? 0)
    : formData.gastos.reduce((sum, item) => sum + item.importe, 0);
  const ingresosManuales = formData.ingresos
    .filter((item) => EDITABLE_INGRESOS.has(item.descripcion))
    .reduce((sum, item) => sum + Number(item.importe || 0), 0);
  const efectivoCaja = isViewing
    ? (activeCash?.efectivoEsperado ?? 0) + ingresosManuales
    : totalIngresos - totalGastos;
  const ventasBO_FA =
    (formData.ventaTotal.efectivo ?? 0) +
    (formData.ventaTotal.tarjeta ?? 0) +
    (formData.ventaTotal.deposito ?? 0);
  const diferencial = totalEfectivo - efectivoCaja;
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
  const formatAmount = (value: number) =>
    Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const abrirCaja = async () => {
    const usuarioId = selectedResponsableId;
    const responsable = users.find((user) => user.UsuarioID === usuarioId);
    const encargado =
      responsable?.Nombre?.trim() ||
      responsable?.UsuarioAlias ||
      sessionUser?.displayName ||
      sessionUser?.username ||
      "";
    const montoInicial = Number(formData.sencillo);
    if (!Number.isFinite(usuarioId) || usuarioId <= 0 || !encargado) {
      toast.error("No se pudo identificar al usuario de la sesión.");
      return;
    }
    if (!Number.isFinite(montoInicial) || montoInicial < 0) {
      toast.error("Ingresa un monto inicial válido.");
      return;
    }

    const result = await openCashFlow({
      usuarioId,
      encargado,
      usuario: responsable?.UsuarioAlias || encargado,
      montoInicial,
      observacion: formData.observaciones,
    });
    if (!result.ok) {
      toast.error(result.mensaje);
      return;
    }

    toast.success("Caja abierta correctamente.");
    navigate(`/cash_flow_control${location.search}`);
  };

  const cerrarCaja = async () => {
    if (!activeCash) {
      toast.error("No se pudo cargar la caja para cerrarla.");
      return;
    }
    const usuarioId = Number(sessionUser?.id);
    if (!Number.isFinite(usuarioId) || usuarioId <= 0) {
      toast.error("No se pudo identificar al usuario de la sesión.");
      return;
    }

    const result = await closeCashFlow(activeCash.id, {
      usuarioId,
      montoInicial: Number(formData.sencillo || 0),
      observacion: formData.observaciones,
      monedas: formData.conteoMonedas.map((item) => ({
        denominacion: item.denominacion,
        cantidad: Number(item.cantidad || 0),
      })),
    });
    if (!result.ok) {
      toast.error(result.mensaje);
      return;
    }

    toast.success(
      `Caja cerrada. Diferencia: S/ ${result.diferencia.toFixed(2)}`,
    );
    setIsEditing(false);
    await reloadCashFlow();
  };

  const guardarEstadoCaja = async (estado = formData.estado) => {
    if (!activeCash) {
      toast.error("No se pudo cargar la caja.");
      return;
    }

    const result = await updateCashFlowState(activeCash.id, {
      estado,
      montoInicial: Number(formData.sencillo || 0),
      observacion: formData.observaciones,
    });
    if (!result.ok) {
      toast.error(result.mensaje);
      return;
    }

    toast.success("Caja actualizada correctamente.");
    setIsEditing(false);
    await reloadCashFlow();
  };

  const cambiarEstadoCaja = (estado: string) => {
    setFormData((prev) => ({ ...prev, estado }));
  };

  const alternarEdicion = () => {
    if (isEditing) {
      setIsEditing(false);
      void reloadCashFlow();
      return;
    }
    setIsEditing(true);
  };

  const guardarCaja = async () => {
    if (!isViewing) return abrirCaja();
    const result = await updateManualIngresos(
      viewedCashId,
      formData.ingresos
        .filter((item) => EDITABLE_INGRESOS.has(item.descripcion))
        .map(({ id, importe }) => ({ id, importe })),
    );
    if (!result.ok) {
      toast.error(result.mensaje);
      return;
    }
    if (formData.estado === "CERRADA" && isClosing) return cerrarCaja();
    return guardarEstadoCaja();
  };

  const eliminarCaja = () => {
    if (!activeCash) return;

    openDialog({
      title: "Eliminar caja",
      content: (
        <p>¿Deseas eliminar esta caja? Esta acción no se puede deshacer.</p>
      ),
      confirmText: "Eliminar",
      onConfirm: async () => {
        const result = await deleteCashFlow(activeCash.id);
        if (!result.ok) {
          toast.error(result.mensaje);
          return;
        }

        toast.success(result.mensaje);
        navigate(`/cash_flow_control${location.search}`, { replace: true });
      },
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Pendiente";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleString("es-PE", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyboardNavigation}
      className=" bg-gray-50 flex flex-col overflow-visible"
    >
      <div className="sticky top-2 z-30 bg-[#B23636] text-white px-2 sm:px-4 py-2 flex items-center justify-between flex-shrink-0 shadow-lg shadow-black/10">
        <div className="flex items-center gap-2">
          <BackArrowButton
            preserveSearch
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/30 bg-white/10 text-white hover:bg-white/20 transition-colors"
          />

          <div
            role="tablist"
            className="flex rounded bg-black/10 p-0.5 text-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "caja"}
              onClick={() => setActiveTab("caja")}
              className={`rounded px-2 py-1 font-semibold ${activeTab === "caja" ? "bg-white text-[#B23636]" : "text-white"}`}
            >
              Caja
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "productos"}
              onClick={() => setActiveTab("productos")}
              className={`rounded px-2 py-1 font-semibold ${activeTab === "productos" ? "bg-white text-[#B23636]" : "text-white"}`}
            >
              Productos
            </button>
          </div>
        </div>
        <div className="flex gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => void guardarCaja()}
            disabled={loading || !canEdit}
            className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-1 text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
            title={isViewing ? "Guardar" : "Guardar"}
          >
            <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{isViewing ? "Guardar" : "Guardar"}</span>
          </button>
          {isViewing && (
            <button
              type="button"
              onClick={alternarEdicion}
              disabled={loading || readOnly}
              title={isEditing ? "Bloquear y descartar cambios" : "Editar caja"}
              aria-label={
                isEditing ? "Bloquear formulario" : "Editar formulario"
              }
              className="inline-flex items-center rounded p-1 text-red-100 hover:bg-red-700 hover:text-white disabled:opacity-50"
            >
              {isEditing ? (
                <Unlock className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
            </button>
          )}
          {isViewing && (
            <button
              type="button"
              onClick={eliminarCaja}
              disabled={loading || !canEdit}
              title="Eliminar caja"
              aria-label="Eliminar caja"
              className="inline-flex items-center rounded p-1 text-red-100 hover:bg-red-700 hover:text-white disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            disabled
            className="p-1 rounded opacity-50"
            title="Disponible al cerrar la caja"
          >
            <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2 sm:p-3">
          {activeTab === "caja" ? (
            <div className="space-y-3">
              <div className="bg-white rounded border border-gray-200 p-2 mb-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 mb-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                    <div className="col-span-2">
                      {isViewing ? (
                        <HookFormInput
                          name="encargado"
                          label="Encargado"
                          value={activeCash?.encargado || ""}
                          onChange={() => {}}
                          readOnly
                          inputClassName="text-xs py-1.5 px-2 w-full border border-gray-200 rounded-md bg-slate-50"
                          labelClassName="text-xs font-semibold text-gray-700"
                        />
                      ) : (
                        <HookFormSelect
                          name="encargado"
                          label="Encargado"
                          value={String(selectedResponsableId)}
                          onChange={(e) =>
                            setResponsableId(Number(e.target.value))
                          }
                          options={responsableOptions}
                          disabled={loading || !canEdit}
                          labelClassName="text-xs font-semibold text-gray-700"
                          selectClassName="text-xs"
                        />
                      )}
                    </div>
                    <div>
                      <HookFormInput
                        name="sencillo"
                        label="Sencillo"
                        type="number"
                        value={formData.sencillo || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            sencillo:
                              e.target.value === ""
                                ? ""
                                : parseFloat(e.target.value) || 0,
                          }))
                        }
                        readOnly={!canEdit || isClosed}
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
                        onChange={(e) => cambiarEstadoCaja(e.target.value)}
                        options={[
                          { value: "ACTIVO", label: "ACTIVO" },
                          { value: "CERRADA", label: "CERRADA" },
                        ]}
                        disabled={!isViewing || loading || !canEdit}
                        labelClassName="text-xs font-semibold text-gray-700"
                        selectClassName={`text-center font-medium text-xs ${
                          ["ABIERTA", "ACTIVO"].includes(
                            formData.estado.trim().toUpperCase(),
                          )
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
                                    type="number"
                                    value={item.cantidad || ""}
                                    onChange={(e) =>
                                      handleCantidadChange(idx, e.target.value)
                                    }
                                    data-auto-next="true"
                                    className="w-full min-w-0 px-1 py-0.5 border border-gray-200 rounded text-center focus:border-slate-500 focus:outline-none text-xs"
                                    disabled={!isClosing || loading || !canEdit}
                                  />
                                </td>
                                <td className="py-0.5 px-2 text-right text-gray-700 text-xs w-1/3">
                                  {formatAmount(item.denominacion)}
                                </td>
                                <td className="py-0.5 px-2 text-right font-semibold text-slate-800 text-xs w-1/3">
                                  {formatAmount(cantidad * item.denominacion)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-slate-900 text-white font-semibold text-right px-2 py-1.5 text-xs">
                      Total S/ {formatAmount(totalEfectivo)}
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
                      disabled={isClosed}
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
                      disabled={isClosed}
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
                                {EDITABLE_INGRESOS.has(item.descripcion) ? (
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.importe || ""}
                                    onChange={(event) =>
                                      handleIngresoChange(
                                        item.id,
                                        event.target.value,
                                      )
                                    }
                                    disabled={!canEdit || isClosed || loading}
                                    className="w-24 rounded border border-gray-200 px-1 py-0.5 text-right text-xs focus:border-slate-500 focus:outline-none disabled:bg-transparent disabled:border-transparent"
                                  />
                                ) : (
                                  formatAmount(item.importe)
                                )}
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
                        S/ {formatAmount(efectivoCaja)}
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
                        value={`S/ ${formatAmount(totalBilletes)}`}
                        className="flex-1 px-2 py-1 border  rounded text-right font-semibold text-slate-800 bg-white text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold  w-24 sm:w-28 flex-shrink-0">
                        Tot. Sencillo:
                      </span>
                      <input
                        disabled
                        value={`S/ ${formatAmount(totalSencillo)}`}
                        className="flex-1 px-2 py-1 border rounded text-right font-semibold text-slate-800 bg-gray-50 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 w-24 sm:w-28 flex-shrink-0">
                        Diferencial:
                      </span>
                      <input
                        disabled
                        value={`S/ ${formatAmount(diferencial)}`}
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
                        readOnly={!canEdit || isClosed}
                        data-auto-next={
                          !canEdit || isClosed ? undefined : "true"
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
                        type="text"
                        value={
                          formData.ventaTotal.efectivo
                            ? formatAmount(formData.ventaTotal.efectivo)
                            : ""
                        }
                        disabled
                        className="w-28 sm:w-32 px-2 py-1 border border-gray-300 rounded text-right font-semibold focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-semibold text-gray-700 flex-shrink-0">
                        Tarjeta:
                      </span>
                      <input
                        type="text"
                        value={
                          formData.ventaTotal.tarjeta
                            ? formatAmount(formData.ventaTotal.tarjeta)
                            : ""
                        }
                        disabled
                        className="w-28 sm:w-32 px-2 py-1 border border-gray-300 rounded text-right font-semibold text-blue-700 focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-semibold text-gray-700 flex-shrink-0">
                        Depósitos y/o Yape:
                      </span>
                      <input
                        type="text"
                        value={
                          formData.ventaTotal.deposito
                            ? formatAmount(formData.ventaTotal.deposito)
                            : ""
                        }
                        disabled
                        className="w-28 sm:w-32 px-2 py-1 border border-gray-300 rounded text-right font-semibold text-green-700 focus:border-slate-500 focus:outline-none"
                      />
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-semibold text-gray-700 flex-shrink-0">
                        Salidas:
                      </span>
                      <div className="w-28 sm:w-32 px-2 py-1 bg-red-500 text-white rounded text-right font-bold">
                        S/ {formatAmount(totalGastos)}
                      </div>
                    </div>
                    <div className="flex justify-between items-center pt-1.5 border-t border-gray-200 gap-2">
                      <span className="text-xs font-bold flex-shrink-0">
                        Total:
                      </span>
                      <div className="w-28 sm:w-32 px-2 py-1 border border-gray-300 rounded text-right font-bold bg-white">
                        S/ {formatAmount(totalVenta)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <CashFlowProductsTab cajaId={viewedCashId} />
          )}
        </div>
      </div>
    </div>
  );
}
