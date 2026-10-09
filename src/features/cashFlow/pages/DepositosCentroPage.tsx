import DataTable from "@/components/DataTable";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { FormProvider, useForm } from "react-hook-form";
import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { resolveMediaUrl } from "@/shared/helpers/resolveMediaUrl";
import { toast } from "@/shared/ui/toast";
import { useDialogStore } from "@/store/app/dialog.store";
import { useAuthStore } from "@/store/auth/auth.store";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, ImagePlus, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type Deposito = {
  id: number;
  fecha: string;
  movimiento: string;
  entidad: string;
  nroOperacion: string;
  descripcion: string;
  importe: number;
  usuario: string;
  rutaImagen: string;
  estado: string;
};
type FormValues = {
  movimiento: string;
  entidad: string;
  nroOperacion: string;
  descripcion: string;
  importe: string;
};
type DeletePasswordForm = { clave: string };
type FilterValues = { desde: string; hasta: string };
type Validation = {
  diasMaxDep: number;
  desde: string;
  hasta: string;
  cantidad: number;
  pendientes: number;
  valida: boolean;
};
const EMPTY_FORM: FormValues = {
  movimiento: "",
  entidad: "",
  nroOperacion: "",
  descripcion: "",
  importe: "",
};
const datePart = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
const today = new Date();
const MOVEMENTS = ["DEPOSITO", "TARJETA"];
const ENTITIES = ["BCP", "BBVA CONTINENTAL", "INTERBANK", "YAPE"];
const money = (value: number) =>
  Number(value || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const formatDate = (value: string) => new Date(value).toLocaleString("es-PE");

function DepositoDeletePasswordDialogContent() {
  const setDialogData = useDialogStore((state) => state.setData);
  const methods = useForm<DeletePasswordForm>({ defaultValues: { clave: "" } });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => methods.setFocus("clave"), 250);
    return () => window.clearTimeout(timeoutId);
  }, [methods.setFocus]);

  return (
    <HookForm
      methods={methods}
      onSubmit={({ clave }) => setDialogData({ clave })}
      className="space-y-3"
    >
      <p className="text-sm text-slate-600">
        Ingresa tu contraseña para confirmar la eliminación.
      </p>
      <HookFormInput<DeletePasswordForm>
        name="clave"
        label="Tu contraseña"
        type="password"
        autoComplete="current-password"
        rules={{ required: "Ingresa tu contraseña." }}
        onChange={(event) => setDialogData({ clave: event.target.value })}
      />
    </HookForm>
  );
}

export default function DepositosCentroPage() {
  const canManage =
    useAuthStore(
      (state) =>
        state.user?.isAdministrator ||
        state.user?.permissions.includes("CAJA.GESTIONAR"),
    ) ?? false;
  const openDialog = useDialogStore((state) => state.openDialog);
  const [rows, setRows] = useState<Deposito[]>([]);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Deposito | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [imageUnavailable, setImageUnavailable] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const form = useForm<FormValues>({ defaultValues: EMPTY_FORM });
  const filters = useForm<FilterValues>({
    defaultValues: {
      desde: datePart(new Date(today.getFullYear(), today.getMonth(), 1)),
      hasta: datePart(today),
    },
  });
  const movimiento = form.watch("movimiento");
  const entidad = form.watch("entidad");
  const setFocus = form.setFocus;
  const entidadOptions = useMemo(
    () => [
      { value: "", label: "(NO APLICA)" },
      ...ENTITIES.map((value) => ({ value, label: value })),
    ],
    [],
  );

  const load = useCallback(
    async (range = filters.getValues()) => {
      setLoading(true);
      try {
        const query = new URLSearchParams({
          desde: range.desde,
          hasta: range.hasta,
        });
        const [result, check] = await Promise.all([
          apiRequest<Deposito[], unknown, Deposito[]>({
            url: `${API_BASE_URL}/DepositosCentro?${query}`,
            fallback: [],
          }),
          apiRequest<Validation, unknown, Validation>({
            url: `${API_BASE_URL}/DepositosCentro/validacion`,
            fallback: null as unknown as Validation,
          }),
        ]);
        setRows(Array.isArray(result) ? result : []);
        setValidation(
          check && typeof check.valida === "boolean" ? check : null,
        );
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(
    () => () => {
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  useEffect(() => {
    if (!movimiento || selected) return;
    const nextField =
      movimiento === "DEPOSITO" || movimiento === "TARJETA"
        ? "nroOperacion"
        : "descripcion";
    const frame = window.requestAnimationFrame(() => setFocus(nextField));
    return () => window.cancelAnimationFrame(frame);
  }, [movimiento, selected, setFocus]);
  useEffect(() => {
    if (
      selected ||
      !entidad ||
      (movimiento !== "DEPOSITO" && movimiento !== "TARJETA")
    )
      return;
    const frame = window.requestAnimationFrame(() => setFocus("nroOperacion"));
    return () => window.cancelAnimationFrame(frame);
  }, [entidad, movimiento, selected, setFocus]);

  const searchDates = (range: FilterValues) => {
    if (!range.desde || !range.hasta || range.desde > range.hasta)
      return toast.error("Ingresa un rango de fechas válido.");
    void load(range);
  };

  const clear = () => {
    setSelected(null);
    setImage(null);
    setPreview("");
    setImageUnavailable(false);
    form.reset(EMPTY_FORM);
  };
  const selectRow = (row: Deposito) => {
    setSelected(row);
    form.reset({
      movimiento: row.movimiento,
      entidad: row.entidad === "-" ? "" : row.entidad,
      nroOperacion: row.nroOperacion,
      descripcion: row.descripcion,
      importe: String(row.importe),
    });
    setImage(null);
    setImageUnavailable(false);
    setPreview(row.rutaImagen ? resolveMediaUrl(row.rutaImagen) : "");
  };
  const save = async (values: FormValues) => {
    const amount = Number(values.importe);
    if (
      !values.movimiento ||
      !values.descripcion.trim() ||
      !Number.isFinite(amount) ||
      amount <= 0
    )
      return toast.error("Completa movimiento, descripción e importe válido.");
    if (
      (values.movimiento === "DEPOSITO" &&
        (!values.entidad ||
          (!values.nroOperacion.trim() && values.entidad !== "YAPE"))) ||
      (values.movimiento === "TARJETA" &&
        (!values.entidad || !values.nroOperacion.trim()))
    )
      return toast.error(
        "Selecciona la entidad e indica el número de operación.",
      );
    if (values.movimiento === "YAPE" && values.entidad !== "BCP")
      values.entidad = "BCP";
    if (!image)
      return toast.error(
        selected
          ? "Selecciona la imagen que deseas adjuntar."
          : "Adjunta la imagen del depósito.",
      );
    if (
      image &&
      (!/^image\/(jpeg|png|webp)$/.test(image.type) ||
        image.size > 5 * 1024 * 1024)
    )
      return toast.error(
        "La imagen debe ser JPG, PNG o WEBP y pesar hasta 5 MB.",
      );

    const data = new FormData();
    data.append("id", String(selected?.id ?? 0));
    data.append("movimiento", values.movimiento);
    data.append(
      "entidad",
      values.movimiento === "EFECTIVO"
        ? "-"
        : values.movimiento === "YAPE"
          ? "BCP"
          : values.entidad,
    );
    data.append("nroOperacion", values.nroOperacion.trim());
    data.append("descripcion", values.descripcion.trim());
    data.append("importe", String(amount));
    if (image) data.append("imagen", image);
    setSaving(true);
    try {
      const result = await apiRequest<
        { ok?: boolean; mensaje?: string },
        FormData,
        { ok?: boolean; mensaje?: string }
      >({
        url: `${API_BASE_URL}/DepositosCentro`,
        method: "POST",
        data,
        fallback: { ok: false, mensaje: "No se pudo guardar el depósito." },
      });
      if (!result?.ok)
        return toast.error(
          result?.mensaje || "No se pudo guardar el depósito.",
        );
      toast.success(
        result.mensaje ||
          (selected ? "Comprobante actualizado." : "Depósito registrado."),
      );
      clear();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Deposito, clave: string) => {
    setDeleteId(row.id);
    try {
      const result = await apiRequest<
        { ok?: boolean; mensaje?: string },
        unknown,
        { ok?: boolean; mensaje?: string }
      >({
        url: `${API_BASE_URL}/DepositosCentro/${row.id}`,
        method: "DELETE",
        data: { clave },
        fallback: { ok: false, mensaje: "No se pudo eliminar el depósito." },
      });
      if (!result?.ok) {
        toast.error(result?.mensaje || "No se pudo eliminar el depósito.");
        return false;
      }
      toast.success(result.mensaje || "Depósito eliminado.");
      if (selected?.id === row.id) clear();
      await load();
      return true;
    } finally {
      setDeleteId(null);
    }
  };
  const confirmDelete = (row: Deposito) =>
    openDialog({
      title: "Eliminar depósito",
      content: <DepositoDeletePasswordDialogContent />,
      confirmText: "Eliminar",
      onConfirm: async (data) => {
        const clave = (data as DeletePasswordForm | null)?.clave ?? "";
        if (!clave.trim()) {
          toast.error("Ingresa tu contraseña.");
          return false;
        }
        return await remove(row, clave);
      },
    });
  const viewImage = () => {
    if (!preview || imageUnavailable) return;
    openDialog({
      title: "Comprobante del depósito",
      content: (
        <img
          src={preview}
          alt="Comprobante del depósito"
          className="max-h-[75vh] w-full object-contain"
        />
      ),
      maxWidth: "md",
      hideCancelButton: true,
    });
  };

  const columns = useMemo<ColumnDef<Deposito, unknown>[]>(
    () => [
      {
        accessorKey: "fecha",
        header: "Fecha",
        cell: ({ row }) => formatDate(row.original.fecha),
      },
      { accessorKey: "movimiento", header: "Movimiento" },
      { accessorKey: "entidad", header: "Entidad" },
      { accessorKey: "nroOperacion", header: "Nro. operación" },
      { accessorKey: "descripcion", header: "Descripción" },
      {
        accessorKey: "importe",
        header: "Importe",
        meta: { align: "right" },
        cell: ({ row }) => `S/ ${money(row.original.importe)}`,
      },
      { accessorKey: "usuario", header: "Usuario" },
      {
        id: "acciones",
        header: "Acciones",
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                selectRow(row.original);
              }}
              className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
              title="Ver depósito"
              aria-label="Ver depósito"
            >
              <Eye className="h-4 w-4" />
            </button>
            {canManage && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  confirmDelete(row.original);
                }}
                disabled={deleteId === row.original.id}
                className="rounded-md p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                title="Eliminar depósito"
                aria-label="Eliminar depósito"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ),
      },
    ],
    [canManage, deleteId, selected],
  );
  const total = rows.reduce((sum, row) => sum + Number(row.importe || 0), 0);

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(19rem,0.75fr)_minmax(0,1.8fr)]">
        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(save)}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-slate-800">
                {selected
                  ? `Detalle del depósito #${selected.id}`
                  : "Nuevo depósito"}
              </h2>
              {selected && (
                <button
                  type="button"
                  onClick={clear}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label="Cerrar detalle"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {selected && (
              <p className="mb-3 text-xs text-slate-500">
                {formatDate(selected.fecha)} · {selected.usuario}
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <HookFormSelect<FormValues>
                name="movimiento"
                label="Movimiento"
                options={[
                  { value: "", label: "(SELECCIONE)" },
                  ...MOVEMENTS.map((value) => ({ value, label: value })),
                ]}
                disabled={!canManage || saving || !!selected}
              />
              <HookFormSelect<FormValues>
                name="entidad"
                label="Entidad bancaria"
                options={entidadOptions}
                disabled={
                  !canManage ||
                  saving ||
                  !!selected ||
                  movimiento === "EFECTIVO" ||
                  movimiento === "YAPE"
                }
              />
              <HookFormInput<FormValues>
                name="nroOperacion"
                label="Nro. operación"
                maxLength={100}
                inputMode="numeric"
                rules={{
                  pattern: { value: /^\d*$/, message: "Ingresa solo números." },
                }}
                onChange={(event) => {
                  const value = event.target.value;
                  const digits = value.replace(/\D/g, "");
                  if (value !== digits)
                    form.setValue("nroOperacion", digits, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                }}
                disabled={
                  !canManage ||
                  saving ||
                  !!selected ||
                  movimiento === "EFECTIVO" ||
                  movimiento === "YAPE"
                }
              />
              <HookFormInput<FormValues>
                name="descripcion"
                label="Descripción"
                maxLength={500}
                disabled={!canManage || saving || !!selected}
              />
              <HookFormInput<FormValues>
                name="importe"
                label="Efectivo S/"
                type="number"
                min="0.01"
                step="0.01"
                disabled={!canManage || saving || !!selected}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {canManage && (
                <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <ImagePlus className="h-4 w-4" />
                  {image
                    ? "Cambiar imagen"
                    : selected && preview
                      ? "Reemplazar imagen"
                      : "Adjuntar imagen"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={saving}
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      if (!file) return;
                      if (
                        !/^image\/(jpeg|png|webp)$/.test(file.type) ||
                        file.size > 5 * 1024 * 1024
                      )
                        return toast.error(
                          "La imagen debe ser JPG, PNG o WEBP y pesar hasta 5 MB.",
                        );
                      setImage(file);
                      setPreview(URL.createObjectURL(file));
                      setImageUnavailable(false);
                    }}
                  />{" "}
                </label>
              )}
              {preview && !imageUnavailable ? (
                <button
                  type="button"
                  onClick={viewImage}
                  className="text-sm font-semibold text-blue-700 hover:underline"
                >
                  Ver comprobante
                </button>
              ) : (
                <span className="text-sm text-slate-500">
                  {selected?.rutaImagen
                    ? "Imagen de escritorio sin acceso web"
                    : "Sin comprobante"}
                </span>
              )}
            </div>
            {preview && !imageUnavailable && (
              <img
                src={preview}
                alt="Vista previa del comprobante"
                onError={() => setImageUnavailable(true)}
                className="mt-3 max-h-36 w-full rounded-lg border border-slate-200 object-contain"
              />
            )}
            {canManage && (
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={clear}
                  disabled={saving}
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#B23636] px-3 text-sm font-semibold text-white hover:bg-[#96312a] disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  Nuevo
                </button>
                {(!selected || image) && (
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#B23636] px-4 text-sm font-semibold text-white hover:bg-[#96312a] disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {saving
                      ? "Guardando..."
                      : selected
                        ? "Guardar comprobante"
                        : "Guardar"}
                  </button>
                )}
              </div>
            )}
          </form>
        </FormProvider>

        <div className="min-w-0">
          <FormProvider {...filters}>
            <DataTable
              columns={columns}
              data={rows}
              isLoading={loading}
              onRowClick={selectRow}
              filterKeys={[
                "movimiento",
                "entidad",
                "nroOperacion",
                "descripcion",
                "usuario",
              ]}
              searchPlaceholder="Buscar depósito..."
              emptyMessage="No hay depósitos para el rango seleccionado."
              initialPageSize={10}
              renderFilters={
                <form
                  onSubmit={filters.handleSubmit(searchDates)}
                  className="flex flex-wrap items-end gap-2"
                >
                  <div className="w-36">
                    <HookFormInput<FilterValues>
                      name="desde"
                      label="F. inicio"
                      type="date"
                    />
                  </div>
                  <div className="w-36">
                    <HookFormInput<FilterValues>
                      name="hasta"
                      label="F. fin"
                      type="date"
                    />
                  </div>
                  <button
                    type="submit"
                    aria-label="Buscar por fechas"
                    disabled={loading}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#B23636] text-white hover:bg-[#96312a] disabled:opacity-50"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </form>
              }
              footerContent={
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>
                    Depósitos: <b>{rows.length}</b>
                  </span>
                  <span>
                    Total: <b>S/ {money(total)}</b>
                  </span>
                </div>
              }
            />
          </FormProvider>
        </div>
      </div>
    </div>
  );
}
