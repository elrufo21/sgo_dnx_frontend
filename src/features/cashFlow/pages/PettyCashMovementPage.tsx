import { API_BASE_URL } from "@/config";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import { useDialogStore } from "@/store/app/dialog.store";
import { useAuthStore } from "@/store/auth/auth.store";
import { Eye, ImagePlus, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

type Movement = {
  id: number;
  fecha: string;
  movimiento: "INGRESO" | "SALIDA";
  detalle: string;
  importe: number;
  formaPago: string;
  entidad: string;
  nroOperacion: string;
  rutaImagen: string;
};

type MovementResponse = { cajaId: number; movimientos: Movement[] };
type MovementType = Movement["movimiento"];
type PettyCashFormData = Pick<
  Movement,
  "movimiento" | "formaPago" | "entidad" | "nroOperacion" | "detalle"
> & { importe: string };

const FORM_DEFAULTS: PettyCashFormData = {
  movimiento: "SALIDA",
  formaPago: "",
  entidad: "",
  nroOperacion: "",
  detalle: "",
  importe: "",
};

const FORMAS_PAGO = [
  "EFECTIVO",
  "DEPOSITO",
  "TARJETA",
  "YAPE",
  "EFECTIVO/DEPOSITO",
  "TARJETA/EFECTIVO",
  "YAPE/EFECTIVO",
  "YAPE/DEPOSITO",
  "TARJETA/DEPOSITO",
  "-",
] as const;

const FORMAS_CON_ENTIDAD_Y_OPERACION = new Set<string>([
  "DEPOSITO",
  "EFECTIVO/DEPOSITO",
  "TARJETA/EFECTIVO",
  "YAPE/EFECTIVO",
  "YAPE/DEPOSITO",
  "TARJETA/DEPOSITO",
]);

const MOVEMENT_OPTIONS = [
  { value: "SALIDA", label: "SALIDA" },
  { value: "INGRESO", label: "INGRESO" },
];
const FORMAS_PAGO_OPTIONS = [
  { value: "", label: "(SELECCIONE)" },
  ...FORMAS_PAGO.map((value) => ({ value, label: value })),
];
const ENTIDAD_OPTIONS = [
  { value: "", label: "(SELECCIONE)" },
  { value: "BCP", label: "BCP" },
  { value: "BBVA CONTINENTAL", label: "BBVA CONTINENTAL" },
  { value: "INTERBANK", label: "INTERBANK" },
  { value: "-", label: "-" },
];

const money = (value: number) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value || "-"
    : date.toLocaleString("es-PE");
};

export default function PettyCashMovementPage() {
  const userId = Number(useAuthStore((state) => state.user?.id) || 0);
  const openDialog = useDialogStore((state) => state.openDialog);
  const [cajaId, setCajaId] = useState(0);
  const [movements, setMovements] = useState<Movement[]>([]);
  const form = useForm<PettyCashFormData>({ defaultValues: FORM_DEFAULTS });
  const { reset, setValue, watch } = form;
  const formaPago = watch("formaPago");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [viewing, setViewing] = useState(false);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [tab, setTab] = useState<MovementType>("SALIDA");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (userId <= 0) return;
    setLoading(true);
    try {
      const result = await apiRequest<
        MovementResponse,
        unknown,
        MovementResponse
      >({
        url: `${API_BASE_URL}/PettyCashMovement?usuarioId=${userId}`,
        fallback: { cajaId: 0, movimientos: [] },
      });
      setCajaId(Number(result?.cajaId) || 0);
      setMovements(
        Array.isArray(result?.movimientos) ? result.movimientos : [],
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const clearForm = () => {
    setViewing(false);
    setViewingId(null);
    reset(FORM_DEFAULTS);
    setImageFile(null);
    setImagePreview("");
  };

  const viewMovement = useCallback(
    (item: Movement) => {
      setViewing(true);
      setViewingId(item.id);
      reset({
        movimiento: item.movimiento,
        detalle: item.detalle,
        importe: String(item.importe),
        formaPago: item.formaPago || "",
        entidad: item.entidad,
        nroOperacion: item.nroOperacion,
      });
      setImageFile(null);
      setImagePreview(item.rutaImagen || "");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [reset],
  );

  const save = async (values: PettyCashFormData) => {
    const amount = Number(values.importe);
    if (cajaId <= 0) return toast.error("No tienes una caja activa.");
    if (!values.detalle.trim() || !Number.isFinite(amount) || amount <= 0)
      return toast.error("Indica el detalle y un importe válido.");
    if (!values.formaPago) return toast.error("Selecciona la forma de pago.");
    if (
      FORMAS_CON_ENTIDAD_Y_OPERACION.has(values.formaPago) &&
      !values.entidad.trim()
    )
      return toast.error("Selecciona la entidad bancaria.");
    if (
      (FORMAS_CON_ENTIDAD_Y_OPERACION.has(values.formaPago) ||
        values.formaPago === "TARJETA") &&
      !values.nroOperacion.trim()
    )
      return toast.error("Indica el número de operación.");

    setSaving(true);
    const data = new FormData();
    Object.entries({
      id: "",
      usuarioId: userId,
      movimiento: values.movimiento,
      detalle: values.detalle.trim(),
      importe: amount,
      formaPago: values.formaPago,
      entidad: values.entidad.trim(),
      nroOperacion: values.nroOperacion.trim(),
    }).forEach(([key, value]) => data.append(key, String(value)));
    if (imageFile) data.append("imagen", imageFile);
    const result = await apiRequest<
      { ok?: boolean; mensaje?: string },
      FormData,
      { ok?: boolean; mensaje?: string }
    >({
      url: `${API_BASE_URL}/PettyCashMovement`,
      method: "POST",
      data,
      fallback: { ok: false, mensaje: "No se pudo registrar el movimiento." },
    });
    setSaving(false);
    if (!result?.ok)
      return toast.error(
        result?.mensaje || "No se pudo registrar el movimiento.",
      );

    toast.success(result.mensaje || "Movimiento registrado.");
    clearForm();
    await load();
  };

  const deleteMovement = async (item: Movement) => {
    setDeletingId(item.id);
    try {
      const result = await apiRequest<
        { ok?: boolean; mensaje?: string },
        unknown,
        { ok?: boolean; mensaje?: string }
      >({
        url: `${API_BASE_URL}/PettyCashMovement/${item.id}?usuarioId=${userId}`,
        method: "DELETE",
        fallback: { ok: false, mensaje: "No se pudo eliminar el movimiento." },
      });
      if (!result?.ok) {
        toast.error(result?.mensaje || "No se pudo eliminar el movimiento.");
        return false;
      }
      toast.success(result.mensaje || "Movimiento eliminado.");
      if (viewingId === item.id) clearForm();
      await load();
      return true;
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (item: Movement) => {
    openDialog({
      title: "Eliminar movimiento",
      content: <p>¿Deseas eliminar este movimiento de caja chica?</p>,
      confirmText: "Eliminar",
      onConfirm: () => deleteMovement(item),
    });
  };

  const viewReceipt = (url: string) => {
    openDialog({
      title: "Comprobante",
      content: (
        <img
          src={url}
          alt="Comprobante del movimiento"
          className="max-h-[70vh] w-full object-contain"
        />
      ),
      maxWidth: "md",
      hideCancelButton: true,
    });
  };

  const visibleMovements = useMemo(
    () => movements.filter((item) => item.movimiento === tab),
    [movements, tab],
  );
  const totals = useMemo(
    () =>
      movements.reduce(
        (sum, item) => ({
          ingresos:
            sum.ingresos +
            (item.movimiento === "INGRESO" ? Number(item.importe || 0) : 0),
          salidas:
            sum.salidas +
            (item.movimiento === "SALIDA" ? Number(item.importe || 0) : 0),
        }),
        { ingresos: 0, salidas: 0 },
      ),
    [movements],
  );

  const entidadEditable = FORMAS_CON_ENTIDAD_Y_OPERACION.has(formaPago);
  const operacionHabilitada = entidadEditable || formaPago === "TARJETA";
  const focusField = (field: string) =>
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(`[data-focus-field="${field}"]`)
        ?.focus({ preventScroll: true }),
    );

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(22rem,0.8fr)_minmax(0,1.6fr)]">
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(save)} className="xl:order-1">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-base font-bold text-slate-800">
                    Movimiento de Caja Chica
                  </h1>
                  <p className="text-sm text-slate-500">
                    {viewing
                      ? "Visualizando movimiento"
                      : cajaId
                        ? `Caja activa: ${cajaId}`
                        : "No tienes una caja activa."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading || saving}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" /> Actualizar
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <HookFormSelect<PettyCashFormData>
                  name="movimiento"
                  label="Movimiento"
                  options={MOVEMENT_OPTIONS}
                  onChange={() => focusField("forma-pago")}
                  disabled={!cajaId || saving || viewing}
                />
                <HookFormSelect<PettyCashFormData>
                  name="formaPago"
                  label="Forma de pago"
                  options={FORMAS_PAGO_OPTIONS}
                  onChange={(event) => {
                    const value = event.target.value;
                    setValue("formaPago", value === "-" ? "" : value);
                    setValue(
                      "entidad",
                      value === "TARJETA" || value === "YAPE"
                        ? "BCP"
                        : value === "EFECTIVO"
                          ? "-"
                          : "",
                    );
                    setValue("nroOperacion", "");
                    if (!value || value === "-") return;
                    focusField(
                      FORMAS_CON_ENTIDAD_Y_OPERACION.has(value)
                        ? "entidad"
                        : value === "TARJETA"
                          ? "nro-operacion"
                          : "detalle",
                    );
                  }}
                  data-focus-field="forma-pago"
                  disabled={!cajaId || saving || viewing}
                />
                <HookFormSelect<PettyCashFormData>
                  name="entidad"
                  label="Entidad"
                  options={ENTIDAD_OPTIONS}
                  onChange={(event) => {
                    if (event.target.value === "-") setValue("entidad", "");
                    else if (event.target.value) focusField("nro-operacion");
                  }}
                  data-focus-field="entidad"
                  disabled={!cajaId || saving || viewing || !entidadEditable}
                />
                <HookFormInput<PettyCashFormData>
                  name="nroOperacion"
                  label="Nro. operación"
                  data-focus-field="nro-operacion"
                  maxLength={40}
                  disabled={
                    !cajaId || saving || viewing || !operacionHabilitada
                  }
                />
              </div>

              <div className="mt-3">
                <HookFormInput<PettyCashFormData>
                  name="detalle"
                  label="Detalle"
                  data-focus-field="detalle"
                  maxLength={250}
                  disabled={!cajaId || saving || viewing}
                />
              </div>

              <div className="mt-3 grid items-end gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <HookFormInput<PettyCashFormData>
                  name="importe"
                  label="Importe"
                  type="number"
                  min="0.01"
                  step="0.01"
                  disabled={!cajaId || saving || viewing}
                />
                <div className="text-xs font-semibold text-slate-600">
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      <ImagePlus className="h-4 w-4" /> Cargar imagen
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={!cajaId || saving || viewing}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          if (
                            !/^image\/(jpeg|png|webp)$/.test(file.type) ||
                            file.size > 5 * 1024 * 1024
                          )
                            return toast.error(
                              "Selecciona una imagen JPG, PNG o WEBP de hasta 5 MB.",
                            );
                          setImageFile(file);
                          setImagePreview(URL.createObjectURL(file));
                        }}
                      />
                    </label>
                    {imagePreview ? (
                      <button
                        type="button"
                        onClick={() => viewReceipt(imagePreview)}
                        className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline"
                      >
                        Ver comprobante <Eye className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className="text-sm font-normal text-slate-500">
                        Sin comprobante
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                {viewing ? (
                  <button
                    type="button"
                    onClick={clearForm}
                    disabled={saving}
                    className="mr-2 inline-flex h-10 items-center bg-[#B23636] gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <Plus className="h-4 w-4" /> Nuevo
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!cajaId || saving}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#B23636] px-4 text-sm font-semibold text-white hover:bg-[#96312a] disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />{" "}
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                )}
              </div>
            </section>
          </form>
        </FormProvider>

        <div className="min-w-0 space-y-4 xl:order-2">
          <div className="flex gap-1 border-b border-slate-200">
            {(["SALIDA", "INGRESO"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`border-b-2 px-4 py-2 text-sm font-semibold ${
                  tab === item
                    ? "border-[#B23636] text-[#96312a]"
                    : "border-transparent text-slate-500"
                }`}
              >
                {`${item[0]}${item.slice(1).toLowerCase()}s`}
              </button>
            ))}
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="max-h-[68vh] overflow-auto">
              <table className="w-full min-w-[54rem] text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    {["Fecha", "Detalle", "Importe", "Acciones"].map(
                      (header) => (
                        <th key={header} className="px-3 py-3 font-semibold">
                          {header}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-slate-500"
                      >
                        Cargando movimientos...
                      </td>
                    </tr>
                  ) : visibleMovements.length ? (
                    visibleMovements.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => viewMovement(item)}
                        className="cursor-pointer border-t border-slate-200 hover:bg-slate-50"
                      >
                        <td className="px-3 py-2">{formatDate(item.fecha)}</td>

                        <td className="px-3 py-2 text-xs">{item.detalle}</td>

                        <td className="px-3 py-2 text-right font-semibold">
                          {money(item.importe)}
                        </td>

                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              confirmDelete(item);
                            }}
                            disabled={saving || deletingId === item.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                            title="Eliminar movimiento"
                            aria-label="Eliminar movimiento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-slate-500"
                      >
                        No hay movimientos de caja chica.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-slate-200 p-3 text-right">
              <div>
                <p className="text-xs font-semibold text-slate-500">Ingresos</p>
                <p className="font-bold text-emerald-700">
                  S/ {money(totals.ingresos)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500">Salidas</p>
                <p className="font-bold text-red-600">
                  S/ {money(totals.salidas)}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
