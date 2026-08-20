import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { toast } from "@/shared/ui/toast";
import { useAuthStore } from "@/store/auth/auth.store";
import { ExternalLink, ImagePlus, RefreshCw, Save, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  const [cajaId, setCajaId] = useState(0);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movement, setMovement] = useState<MovementType>("SALIDA");
  const [formaPago, setFormaPago] = useState("EFECTIVO");
  const [entidad, setEntidad] = useState("");
  const [nroOperacion, setNroOperacion] = useState("");
  const [detalle, setDetalle] = useState("");
  const [importe, setImporte] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [viewing, setViewing] = useState(false);
  const [tab, setTab] = useState<MovementType>("INGRESO");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (userId <= 0) return;
    setLoading(true);
    try {
      const result = await apiRequest<MovementResponse>({
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
    setMovement("SALIDA");
    setDetalle("");
    setImporte("");
    setEntidad("");
    setNroOperacion("");
    setFormaPago("EFECTIVO");
    setImageFile(null);
    setImagePreview("");
  };

  const viewMovement = useCallback((item: Movement) => {
    setViewing(true);
    setMovement(item.movimiento);
    setDetalle(item.detalle);
    setImporte(String(item.importe));
    setFormaPago(item.formaPago || "EFECTIVO");
    setEntidad(item.entidad);
    setNroOperacion(item.nroOperacion);
    setImageFile(null);
    setImagePreview(item.rutaImagen || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const save = async () => {
    const amount = Number(importe);
    if (cajaId <= 0) return toast.error("No tienes una caja activa.");
    if (!detalle.trim() || !Number.isFinite(amount) || amount <= 0)
      return toast.error("Indica el detalle y un importe válido.");
    if (formaPago === "DEPOSITO" && (!entidad.trim() || !nroOperacion.trim()))
      return toast.error(
        "Indica la entidad y el número de operación del depósito.",
      );

    setSaving(true);
    const data = new FormData();
    Object.entries({
      id: "",
      usuarioId: userId,
      movimiento: movement,
      detalle: detalle.trim(),
      importe: amount,
      formaPago,
      entidad: entidad.trim(),
      nroOperacion: nroOperacion.trim(),
    }).forEach(([key, value]) => data.append(key, String(value)));
    if (imageFile) data.append("imagen", imageFile);
    const result = await apiRequest<{ ok?: boolean; mensaje?: string }>({
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

  const inputClass =
    "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#B23636] focus:ring-2 focus:ring-[#B23636]/20 disabled:bg-slate-100";
  const labelClass = "text-xs font-semibold text-slate-600";
  const isDeposito = formaPago !== "EFECTIVO";

  return (
    <div className="space-y-4 p-3 sm:p-4">
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(22rem,0.8fr)_minmax(0,1.6fr)]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:order-1">
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

        {/* Fila 1: tipo, forma de pago, entidad, operación — el "cómo" del movimiento */}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Movimiento
            <select
              className={`${inputClass} mt-1`}
              value={movement}
              onChange={(event) =>
                setMovement(event.target.value as MovementType)
              }
              disabled={!cajaId || saving || viewing}
            >
              <option value="SALIDA">SALIDA</option>
              <option value="INGRESO">INGRESO</option>
            </select>
          </label>
          <label className={labelClass}>
            Forma de pago
            <select
              className={`${inputClass} mt-1`}
              value={formaPago}
              onChange={(event) => {
                const value = event.target.value;
                setFormaPago(value);
                if (value === "EFECTIVO") {
                  setEntidad("");
                  setNroOperacion("");
                }
              }}
              disabled={!cajaId || saving || viewing}
            >
              <option>EFECTIVO</option>
              <option>DEPOSITO</option>
              <option>TARJETA</option>
              <option>YAPE</option>
              <option>YAPE/DEPOSITO</option>
              <option>TARJETA/DEPOSITO</option>
            </select>
          </label>
          <label className={labelClass}>
            Entidad
            <input
              className={`${inputClass} mt-1`}
              value={entidad}
              onChange={(event) => setEntidad(event.target.value)}
              disabled={!cajaId || saving || viewing || !isDeposito}
              placeholder="BCP, BBVA, Yape..."
              maxLength={40}
            />
          </label>
          <label className={labelClass}>
            Nro. operación
            <input
              className={`${inputClass} mt-1`}
              value={nroOperacion}
              onChange={(event) => setNroOperacion(event.target.value)}
              disabled={!cajaId || saving || viewing || !isDeposito}
              maxLength={40}
            />
          </label>
        </div>

        {/* Fila 2: qué y cuánto — el "detalle" del movimiento */}
        <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <label className={labelClass}>
            Detalle
            <input
              className={`${inputClass} mt-1`}
              value={detalle}
              onChange={(event) => setDetalle(event.target.value)}
              disabled={!cajaId || saving || viewing}
              maxLength={250}
            />
          </label>
          <label className={labelClass}>
            Importe
            {viewing ? (
              <input
                className={`${inputClass} mt-1 font-semibold`}
                value={`S/ ${money(Number(importe))}`}
                readOnly
              />
            ) : (
              <input
                className={`${inputClass} mt-1`}
                type="number"
                min="0.01"
                step="0.01"
                value={importe}
                onChange={(event) => setImporte(event.target.value)}
                disabled={!cajaId || saving}
              />
            )}
          </label>
        </div>

        {/* Fila 3: comprobante */}
        <div className="mt-3 text-xs font-semibold text-slate-600">
          Comprobante
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
              <a
                href={imagePreview}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline"
              >
                <img
                  src={imagePreview}
                  alt="Comprobante"
                  className="h-10 w-10 rounded object-cover"
                />{" "}
                Ver comprobante <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <span className="text-sm font-normal text-slate-500">
                Sin comprobante
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          {viewing ? (
            <button
              type="button"
              onClick={clearForm}
              disabled={saving}
              className="mr-2 inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <X className="h-4 w-4" /> Cerrar vista
            </button>
          ) : (
          <button
            type="button"
            onClick={() => void save()}
            disabled={!cajaId || saving}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#B23636] px-4 text-sm font-semibold text-white hover:bg-[#96312a] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />{" "}
            {saving ? "Guardando..." : "Guardar movimiento"}
          </button>
          )}
        </div>
      </section>

      <div className="min-w-0 space-y-4 xl:order-2">
      <div className="flex gap-1 border-b border-slate-200">
        {(["INGRESO", "SALIDA"] as const).map((item) => (
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
                {[
                  "Fecha",
                  "Movimiento",
                  "Detalle",
                  "Pago",
                  "Entidad",
                  "Nro. operación",
                  "Importe",
                  "Comprobante",
                ].map((header) => (
                  <th key={header} className="px-3 py-3 font-semibold">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
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
                    <td
                      className={`px-3 py-2 font-semibold ${
                        item.movimiento === "INGRESO"
                          ? "text-emerald-700"
                          : "text-red-600"
                      }`}
                    >
                      {item.movimiento}
                    </td>
                    <td className="px-3 py-2">{item.detalle}</td>
                    <td className="px-3 py-2">{item.formaPago}</td>
                    <td className="px-3 py-2">{item.entidad || "-"}</td>
                    <td className="px-3 py-2">{item.nroOperacion || "-"}</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      S/ {money(item.importe)}
                    </td>
                    <td className="px-3 py-2">
                      {item.rutaImagen ? (
                        <a
                          href={item.rutaImagen}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          Ver
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
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
            <p className="font-bold text-red-600">S/ {money(totals.salidas)}</p>
          </div>
        </div>
      </section>
      </div>
      </div>
    </div>
  );
}
