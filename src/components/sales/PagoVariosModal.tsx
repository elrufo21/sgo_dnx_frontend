import { ArrowLeft, Eye, Plus, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { HookForm } from "@/components/forms/HookForm";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { buildApiUrl } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import { getAutomaticPaymentBank } from "@/shared/helpers/paymentBank";
import { formatDateTime } from "@/shared/helpers/formatDate";
import { toast } from "@/shared/ui/toast";
import { useDialogStore } from "@/store/app/dialog.store";

type PagoVariosItem = {
  docuId: number;
  notaId: number;
  documento: string;
  codigo: string;
  razonSocial: string;
  monto: number;
  conceptoOBS: string;
};
type PagoVariosResponse = {
  ok?: boolean;
  codigo?: string;
  count?: number;
  items?: PagoVariosItem[];
  mensaje?: string;
  resultado?: string;
};
type PagoVariosHistoryItem = {
  pagoId: number;
  cajaId: number;
  fechaEmision: string;
  descripcion: string;
  formaPago: string;
  entidad: string;
  efectivo: number;
  deposito: number;
  nroOperacion: string;
  usuario: string;
  total: number;
};
type PagoVariosHistoryResponse = {
  ok?: boolean;
  items?: PagoVariosHistoryItem[];
};
type PagoVariosDetailItem = PagoVariosItem & {
  efectivo: number;
  deposito: number;
};
type PagoVariosDetailResponse = {
  ok?: boolean;
  mensaje?: string;
  pago?: PagoVariosHistoryItem;
  items?: PagoVariosDetailItem[];
};
type PagoVariosTab = "PENDIENTES" | "REALIZADOS";
type PagoVariosDeleteKeyForm = { clave: string };
const PAYMENT_METHOD_OPTIONS = [
  "(SELECCIONE)",
  "EFECTIVO",
  "DEPOSITO",
  "TARJETA",
  "YAPE",
  "EFECTIVO/DEPOSITO",
  "TARJETA/EFECTIVO",
  "YAPE/EFECTIVO",
  "YAPE/DEPOSITO",
  "TARJETA/DEPOSITO",
];
const BANK_OPTIONS = [
  "(SELECCIONE)",
  "-",
  "BCP",
  "INTERBANK",
  "SCOTIABANK",
  "BBVA",
];

const safeTrim = (value: unknown) => String(value ?? "").trim();
const pagoVariosPaymentLabel = (formaPago: string, entidad: string) =>
  safeTrim(entidad) && safeTrim(entidad) !== "-"
    ? `${formaPago} · ${entidad}`
    : formaPago;
const money = (value: number) =>
  Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const integer = (value: number) =>
  Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });
function PagoVariosDeleteDialogContent() {
  const setDialogData = useDialogStore((state) => state.setData);
  const formMethods = useForm<PagoVariosDeleteKeyForm>({
    defaultValues: { clave: "" },
  });
  const { setFocus } = formMethods;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setFocus("clave"));
    return () => window.cancelAnimationFrame(frame);
  }, [setFocus]);

  return (
    <HookForm
      methods={formMethods}
      onSubmit={({ clave }) => setDialogData({ clave })}
      className="space-y-4"
    >
      <p className="text-sm text-slate-600">
        Se revertirá el pago, sus documentos y su movimiento de caja.
      </p>
      <HookFormInput
        name="clave"
        label="Clave de administrador"
        type="password"
        autoFocus
        rules={{ required: "Ingrese la clave de administrador." }}
        onChange={(event) => setDialogData({ clave: event.target.value })}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing || event.repeat) return;
          event.preventDefault();
          event.currentTarget.closest('[role="dialog"]')
            ?.querySelector<HTMLButtonElement>('[data-dialog-confirm]')?.click();
        }}
      />
    </HookForm>
  );
}
const asRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const readPositiveId = (...values: unknown[]) => {
  for (const value of values) {
    const id = Number(value);
    if (Number.isInteger(id) && id > 0) return id;
  }
  return 0;
};
const readSession = () => {
  if (typeof window === "undefined") {
    return {
      companyId: 1,
      username: "USUARIO",
      companyName: "",
      companyRuc: "",
      companyAddress: "",
      companyDistrict: "",
      companyPhone: "",
      userId: 0,
    };
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = asRecord(
      JSON.parse(localStorage.getItem("sgo.auth.session") ?? "null"),
    );
  } catch {
    parsed = null;
  }
  const user = asRecord(parsed?.user);

  return {
    companyId:
      Number(user?.companyId ?? localStorage.getItem("companiaId") ?? 1) || 1,
    userId: readPositiveId(
      user?.id,
      user?.userId,
      user?.usuarioId,
      user?.usuarioID,
      parsed?.id,
      parsed?.userId,
      parsed?.usuarioId,
      parsed?.usuarioID,
    ),
    username:
      safeTrim(user?.displayName) || safeTrim(user?.username) || "USUARIO",
    companyName:
      safeTrim(user?.companyCommercialName) || safeTrim(user?.companyName),
    companyRuc: safeTrim(user?.companyRuc),
    companyAddress: safeTrim(user?.companySunatAddress),
    companyDistrict: safeTrim(user?.companyUbigeoName),
    companyPhone: safeTrim(user?.companyPhone),
  };
};

const inFlightPagoVariosRequests = new Map<
  string,
  Promise<PagoVariosResponse>
>();
const fetchPagoVariosForUser = (userId: number, username: string) => {
  const requestKey = `${userId}:${username}`;
  const pending = inFlightPagoVariosRequests.get(requestKey);
  if (pending) return pending;

  const request = apiRequest<PagoVariosResponse>({
    url: buildApiUrl(
      `/Nota/pago-varios?${new URLSearchParams({
        usuarioId: String(userId),
        usuario: username,
      }).toString()}`,
    ),
    method: "GET",
    fallback: { ok: false, items: [] },
  }) as Promise<PagoVariosResponse>;
  inFlightPagoVariosRequests.set(requestKey, request);
  void request.then(
    () => {
      if (inFlightPagoVariosRequests.get(requestKey) === request) {
        inFlightPagoVariosRequests.delete(requestKey);
      }
    },
    () => {
      if (inFlightPagoVariosRequests.get(requestKey) === request) {
        inFlightPagoVariosRequests.delete(requestKey);
      }
    },
  );
  return request;
};

export function PagoVariosModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const session = useMemo(readSession, []);
  const openDialog = useDialogStore((state) => state.openDialog);
  const focusedPagoVariosPaymentMethodRef = useRef("");
  const [pagoVariosItems, setPagoVariosItems] = useState<PagoVariosItem[]>([]);
  const [pagoVariosSelectedIds, setPagoVariosSelectedIds] = useState<number[]>(
    [],
  );
  const [pagoVariosTab, setPagoVariosTab] =
    useState<PagoVariosTab>("PENDIENTES");
  const [isPagoVariosLoading, setIsPagoVariosLoading] = useState(false);
  const [isPagoVariosHistoryLoading, setIsPagoVariosHistoryLoading] =
    useState(false);
  const [pagoVariosHistory, setPagoVariosHistory] = useState<
    PagoVariosHistoryItem[]
  >([]);
  const [pagoVariosDetail, setPagoVariosDetail] =
    useState<PagoVariosHistoryItem | null>(null);
  const [pagoVariosDetailItems, setPagoVariosDetailItems] = useState<
    PagoVariosDetailItem[]
  >([]);
  const [isPagoVariosDetailLoading, setIsPagoVariosDetailLoading] =
    useState(false);
  const [pagoVariosHistoryStart, setPagoVariosHistoryStart] = useState(() =>
    getLocalDateISO(),
  );
  const [pagoVariosHistoryEnd, setPagoVariosHistoryEnd] = useState(() =>
    getLocalDateISO(),
  );
  const [isPagoVariosSaving, setIsPagoVariosSaving] = useState(false);
  const [pagoVariosFormaPago, setPagoVariosFormaPago] =
    useState("(SELECCIONE)");
  const [pagoVariosEntidad, setPagoVariosEntidad] = useState("-");
  const [pagoVariosOperacion, setPagoVariosOperacion] = useState("");
  const [pagoVariosDeposito, setPagoVariosDeposito] = useState("");
  const pagoVariosDescripcionRef = useRef<HTMLTextAreaElement | null>(null);
  const pagoVariosDescripcionDraftRef = useRef("");
  const resetPagoVariosForm = useCallback(() => {
    setPagoVariosDetail(null);
    setPagoVariosDetailItems([]);
    setPagoVariosSelectedIds([]);
    setPagoVariosFormaPago("(SELECCIONE)");
    setPagoVariosEntidad("-");
    setPagoVariosOperacion("");
    setPagoVariosDeposito("");
    pagoVariosDescripcionDraftRef.current = "";
  }, []);
  const focusPagoVariosField = useCallback(
    (field: "forma" | "entidad" | "operacion" | "deposito" | "descripcion") => {
      window.setTimeout(() => {
        const target = document.querySelector<HTMLElement>(
          `[data-pago-varios-${field}]`,
        );
        target?.focus();
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement
        ) {
          target.select();
        }
      }, 0);
    },
    [],
  );

  const fetchPagoVarios = useCallback(async () => {
    if (!session.userId) {
      setPagoVariosItems([]);
      setPagoVariosSelectedIds([]);
      return;
    }

    setIsPagoVariosLoading(true);
    try {
      const response = await fetchPagoVariosForUser(
        session.userId,
        session.username,
      );
      const items = Array.isArray(response?.items) ? response.items : [];
      setPagoVariosItems(items);
      setPagoVariosSelectedIds([]);
    } catch (error) {
      console.error("No se pudo cargar pago varios", error);
      toast.error("No se pudo cargar Pago Varios.");
    } finally {
      setIsPagoVariosLoading(false);
    }
  }, [session.userId, session.username]);

  useEffect(() => {
    if (open) {
      setPagoVariosTab("PENDIENTES");
      setPagoVariosDetail(null);
      setPagoVariosDetailItems([]);
      void fetchPagoVarios();
    }
  }, [open, fetchPagoVarios]);

  const fetchPagoVariosHistory = useCallback(async () => {
    if (!pagoVariosHistoryStart || !pagoVariosHistoryEnd) return;
    if (pagoVariosHistoryStart > pagoVariosHistoryEnd) {
      toast.error("Selecciona un rango de fechas válido.");
      return;
    }

    setIsPagoVariosHistoryLoading(true);
    try {
      const query = new URLSearchParams({
        fechaInicio: pagoVariosHistoryStart,
        fechaFin: pagoVariosHistoryEnd,
      });
      const response = (await apiRequest<PagoVariosHistoryResponse>({
        url: buildApiUrl(`/Nota/pago-varios/historial?${query.toString()}`),
        method: "GET",
        fallback: { ok: false, items: [] },
      })) as PagoVariosHistoryResponse;
      setPagoVariosHistory(
        Array.isArray(response?.items) ? response.items : [],
      );
    } catch (error) {
      console.error("No se pudo cargar el historial de Pago Varios", error);
      toast.error("No se pudo cargar el historial de Pago Varios.");
    } finally {
      setIsPagoVariosHistoryLoading(false);
    }
  }, [pagoVariosHistoryEnd, pagoVariosHistoryStart]);

  const selectPagoVariosTab = useCallback(
    (tab: PagoVariosTab) => {
      setPagoVariosTab(tab);
      setPagoVariosDetail(null);
      setPagoVariosDetailItems([]);
      if (tab === "REALIZADOS") void fetchPagoVariosHistory();
    },
    [fetchPagoVariosHistory],
  );

  const viewPagoVarios = useCallback(async (item: PagoVariosHistoryItem) => {
    setPagoVariosTab("PENDIENTES");
    setPagoVariosDetail(item);
    setPagoVariosDetailItems([]);
    setIsPagoVariosDetailLoading(true);
    try {
      const response = (await apiRequest<PagoVariosDetailResponse>({
        url: buildApiUrl(`/Nota/pago-varios/${item.pagoId}`),
        method: "GET",
        fallback: { ok: false, items: [] },
      })) as PagoVariosDetailResponse;
      if (!response?.ok || !response.pago) {
        setPagoVariosDetail(null);
        toast.error(
          response?.mensaje || "No se pudo cargar el detalle del pago.",
        );
        return;
      }
      setPagoVariosDetail(response.pago);
      setPagoVariosDetailItems(
        Array.isArray(response.items) ? response.items : [],
      );
    } catch (error) {
      console.error("No se pudo cargar el detalle de Pago Varios", error);
      setPagoVariosDetail(null);
      toast.error("No se pudo cargar el detalle del pago.");
    } finally {
      setIsPagoVariosDetailLoading(false);
    }
  }, []);

  const deletePagoVarios = useCallback(
    async (item: PagoVariosHistoryItem, clave: string) => {
      if (!safeTrim(clave)) {
        toast.error("Ingrese la clave de administrador.");
        return false;
      }

      const response = (await apiRequest<{
        ok?: boolean;
        mensaje?: string;
      }>({
        url: buildApiUrl(`/Nota/pago-varios/${item.pagoId}`),
        method: "DELETE",
        data: { clave },
        fallback: {
          ok: false,
          mensaje: "No se pudo eliminar el pago realizado.",
        },
      })) as { ok?: boolean; mensaje?: string };

      if (!response?.ok) {
        toast.error(
          response?.mensaje || "No se pudo eliminar el pago realizado.",
        );
        return false;
      }

      toast.success(response.mensaje || "Pago realizado eliminado.");
      window.dispatchEvent(new Event("sgo:pago-varios-updated"));
      await fetchPagoVariosHistory();
      await fetchPagoVarios();
      return true;
    },
    [fetchPagoVarios, fetchPagoVariosHistory],
  );

  const confirmDeletePagoVarios = useCallback(
    (item: PagoVariosHistoryItem) =>
      openDialog({
        title: "Eliminar pago realizado",
        content: <PagoVariosDeleteDialogContent />,
        confirmText: "Eliminar",
        onConfirm: async (data) => {
          const deleted = await deletePagoVarios(
            item,
            safeTrim((data as { clave?: string } | null)?.clave),
          );
          if (deleted) resetPagoVariosForm();
          return deleted;
        },
      }),
    [deletePagoVarios, openDialog, resetPagoVariosForm],
  );

  useEffect(() => {
    window.addEventListener("sgo:pago-varios-updated", fetchPagoVarios);
    return () =>
      window.removeEventListener("sgo:pago-varios-updated", fetchPagoVarios);
  }, [fetchPagoVarios]);

  const selectedPagoVariosItems = useMemo(
    () =>
      pagoVariosItems.filter((item) =>
        pagoVariosSelectedIds.includes(item.notaId),
      ),
    [pagoVariosItems, pagoVariosSelectedIds],
  );
  const pagoVariosTotal = useMemo(
    () => selectedPagoVariosItems.reduce((sum, item) => sum + item.monto, 0),
    [selectedPagoVariosItems],
  );
  const pagoVariosConceptos = useMemo(
    () =>
      Array.from(
        new Set(
          selectedPagoVariosItems.map((item) => safeTrim(item.conceptoOBS)),
        ),
      ).filter(Boolean),
    [selectedPagoVariosItems],
  );
  const isPagoVariosMixed =
    pagoVariosFormaPago.includes("/") &&
    pagoVariosFormaPago.includes("EFECTIVO");
  const pagoVariosRequiereOperacion = ![
    "(SELECCIONE)",
    "EFECTIVO",
    "-",
  ].includes(pagoVariosFormaPago);
  const pagoVariosEntidadAutomatica =
    getAutomaticPaymentBank(pagoVariosFormaPago);
  const pagoVariosEntidadEditable =
    pagoVariosRequiereOperacion && !pagoVariosEntidadAutomatica;
  const pagoVariosDepositoIngresado = Math.max(
    0,
    Number(pagoVariosDeposito || 0),
  );
  const pagoVariosDepositoFinal = isPagoVariosMixed
    ? Math.min(pagoVariosDepositoIngresado, pagoVariosTotal)
    : ["(SELECCIONE)", "EFECTIVO"].includes(pagoVariosFormaPago)
      ? 0
      : pagoVariosTotal;
  const pagoVariosEfectivoFinal = isPagoVariosMixed
    ? Math.max(pagoVariosTotal - pagoVariosDepositoFinal, 0)
    : pagoVariosFormaPago === "EFECTIVO"
      ? pagoVariosTotal
      : 0;
  const pagoVariosEntidadFinal =
    pagoVariosEntidadAutomatica ??
    (pagoVariosEntidadEditable ? pagoVariosEntidad || "(SELECCIONE)" : "-");

  useEffect(() => {
    if (!pagoVariosRequiereOperacion) {
      setPagoVariosEntidad("-");
      setPagoVariosOperacion("");
      setPagoVariosDeposito("");
      return;
    }
    if (pagoVariosEntidadAutomatica) {
      setPagoVariosEntidad(pagoVariosEntidadAutomatica);
    } else if (pagoVariosEntidad === "-" || !pagoVariosEntidad) {
      setPagoVariosEntidad("(SELECCIONE)");
    }
    if (!isPagoVariosMixed) setPagoVariosDeposito("");
    if (!pagoVariosRequiereOperacion) setPagoVariosOperacion("");
  }, [
    isPagoVariosMixed,
    pagoVariosEntidad,
    pagoVariosEntidadAutomatica,
    pagoVariosEntidadEditable,
    pagoVariosFormaPago,
    pagoVariosRequiereOperacion,
  ]);

  useEffect(() => {
    if (focusedPagoVariosPaymentMethodRef.current === pagoVariosFormaPago) {
      return;
    }
    focusedPagoVariosPaymentMethodRef.current = pagoVariosFormaPago;
    if (isPagoVariosMixed) {
      focusPagoVariosField("deposito");
      return;
    }
    if (pagoVariosFormaPago === "EFECTIVO") {
      focusPagoVariosField("descripcion");
      return;
    }
    if (pagoVariosEntidadAutomatica) {
      focusPagoVariosField("operacion");
      return;
    }
    if (pagoVariosEntidadEditable) {
      focusPagoVariosField("entidad");
    }
  }, [
    focusPagoVariosField,
    isPagoVariosMixed,
    pagoVariosEntidadAutomatica,
    pagoVariosEntidadEditable,
    pagoVariosFormaPago,
  ]);

  const registerPagoVarios = async () => {
    if (!selectedPagoVariosItems.length) {
      toast.error("Seleccione documentos para pagar.");
      return;
    }
    if (pagoVariosConceptos.length !== 1) {
      toast.error("Seleccione documentos con el mismo concepto OBS.");
      return;
    }
    const descripcionPagoVarios = safeTrim(
      pagoVariosDescripcionRef.current?.value ??
        pagoVariosDescripcionDraftRef.current,
    ).toUpperCase();
    if (!descripcionPagoVarios) {
      focusPagoVariosField("descripcion");
      toast.error("Ingrese descripcion.");
      return;
    }
    if (pagoVariosFormaPago === "(SELECCIONE)") {
      focusPagoVariosField("forma");
      toast.error("Seleccione forma de pago.");
      return;
    }
    if (
      pagoVariosEntidadEditable &&
      ["(SELECCIONE)", "-"].includes(pagoVariosEntidadFinal)
    ) {
      focusPagoVariosField("entidad");
      toast.error("Seleccione entidad bancaria.");
      return;
    }
    if (pagoVariosRequiereOperacion && !safeTrim(pagoVariosOperacion)) {
      focusPagoVariosField("operacion");
      toast.error("Ingrese numero de operacion.");
      return;
    }
    if (isPagoVariosMixed && pagoVariosDepositoIngresado <= 0) {
      focusPagoVariosField("deposito");
      toast.error("Ingrese el monto por banco.");
      return;
    }
    if (isPagoVariosMixed && pagoVariosDepositoIngresado >= pagoVariosTotal) {
      focusPagoVariosField("deposito");
      toast.error("Efectivo y deposito deben ser mayores a 0.");
      return;
    }
    if (
      Math.round((pagoVariosEfectivoFinal + pagoVariosDepositoFinal) * 100) !==
      Math.round(pagoVariosTotal * 100)
    ) {
      focusPagoVariosField("deposito");
      toast.error("Efectivo + deposito debe cuadrar con el total.");
      return;
    }

    setIsPagoVariosSaving(true);
    try {
      const response = (await apiRequest<PagoVariosResponse>({
        url: buildApiUrl("/Nota/pago-varios"),
        method: "POST",
        data: {
          usuarioId: session.userId,
          usuario: session.username,
          formaPago: pagoVariosFormaPago,
          entidad: pagoVariosEntidadFinal,
          efectivo: pagoVariosEfectivoFinal,
          deposito: pagoVariosDepositoFinal,
          nroOperacion: pagoVariosOperacion,
          descripcion: descripcionPagoVarios,
          conceptoOBS: pagoVariosConceptos[0],
          detalles: selectedPagoVariosItems.map((item) => ({
            docuId: item.docuId,
            notaId: item.notaId,
            monto: item.monto,
            conceptoOBS: item.conceptoOBS,
          })),
        },
      })) as PagoVariosResponse;

      const errorData = asRecord(asRecord(response)?.response)?.data;
      const errorRecord = asRecord(errorData);
      if (!response?.ok) {
        const codigo =
          safeTrim(response?.codigo) || safeTrim(errorRecord?.codigo);
        if (codigo === "CAJA_CHICA_CERRADA") {
          openDialog({
            title: "Caja chica",
            content: (
              <p className="text-sm text-slate-700">
                No se aperturó caja chica. Favor de abrir una nueva caja.
              </p>
            ),
            confirmText: "Aceptar",
            hideCancelButton: true,
          });
          return;
        }
        toast.error(
          safeTrim(response?.mensaje) ||
            safeTrim(errorRecord?.mensaje) ||
            "No se pudo registrar Pago Varios.",
        );
        return;
      }

      toast.success("Pago Varios registrado.");
      resetPagoVariosForm();
      onClose();
      window.dispatchEvent(new Event("sgo:pago-varios-updated"));
      void fetchPagoVarios();
    } finally {
      setIsPagoVariosSaving(false);
    }
  };

  return open ? (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/45 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Pago varios"
        className="flex h-[min(90dvh,736px)] max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
      >
        <div className="flex shrink-0 justify-end border-b border-slate-100 px-5 py-4">
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-50"
            onClick={() => onClose()}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex shrink-0 gap-1 border-b border-slate-200 px-5">
          {(
            [
              ["PENDIENTES", "Pendientes"],
              ["REALIZADOS", "Pagos realizados"],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => selectPagoVariosTab(tab)}
              className={`border-b-2 px-4 py-2 text-sm font-semibold ${pagoVariosTab === tab ? "border-[#B23636] text-[#96312a]" : "border-transparent text-slate-500 hover:text-slate-800"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {!pagoVariosDetail && pagoVariosConceptos.length > 1 ? (
          <div className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
            Para pagar varios, seleccione documentos con el mismo Concepto OBS.
          </div>
        ) : null}

        <div
          className={`flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:overflow-hidden ${pagoVariosTab === "PENDIENTES" ? "lg:grid-cols-[minmax(0,1fr)_350px]" : ""}`}
        >
          <div className="min-h-0 shrink-0 overflow-auto">
            {pagoVariosTab === "PENDIENTES" && !pagoVariosDetail ? (
              <>
                <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
                  <label className="inline-flex items-center gap-2 text-xs font-bold uppercase text-slate-500">
                    <input
                      type="checkbox"
                      checked={
                        pagoVariosItems.length > 0 &&
                        pagoVariosItems.every((item) =>
                          pagoVariosSelectedIds.includes(item.notaId),
                        )
                      }
                      onChange={(event) =>
                        setPagoVariosSelectedIds(
                          event.target.checked
                            ? pagoVariosItems.map((item) => item.notaId)
                            : [],
                        )
                      }
                    />
                    Seleccionar todo
                  </label>
                  <span className="ml-auto text-xs font-medium text-slate-400">
                    {integer(pagoVariosItems.length)} pendientes
                  </span>
                </div>

                <table className="w-full min-w-[780px] border-collapse text-sm">
                  <thead className="bg-white text-xs uppercase text-slate-400">
                    <tr>
                      <th className="w-12 border-b border-slate-100 px-5 py-3 text-left">
                        Sel
                      </th>
                      <th className="border-b border-slate-100 px-3 py-3 text-right">
                        Documento
                      </th>
                      <th className="border-b border-slate-100 px-3 py-3 text-left">
                        Codigo
                      </th>
                      <th className="border-b border-slate-100 px-3 py-3 text-left">
                        Cliente
                      </th>
                      <th className="border-b border-slate-100 px-3 py-3 text-left">
                        Concepto OBS
                      </th>
                      <th className="border-b border-slate-100 px-5 py-3 text-right">
                        Monto
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isPagoVariosLoading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-12 text-center text-slate-400"
                        >
                          Cargando Pago Varios...
                        </td>
                      </tr>
                    ) : pagoVariosItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-12 text-center text-slate-400"
                        >
                          No hay documentos pendientes para Pago Varios.
                        </td>
                      </tr>
                    ) : (
                      pagoVariosItems.map((item) => (
                        <tr
                          key={`${item.docuId}-${item.notaId}`}
                          className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                        >
                          <td className="px-5 py-3">
                            <input
                              type="checkbox"
                              checked={pagoVariosSelectedIds.includes(
                                item.notaId,
                              )}
                              onChange={(event) =>
                                setPagoVariosSelectedIds((current) =>
                                  event.target.checked
                                    ? [...current, item.notaId]
                                    : current.filter(
                                        (rowId) => rowId !== item.notaId,
                                      ),
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-3 font-semibold text-slate-700">
                            {item.documento}
                          </td>
                          <td className="px-3 py-3 text-slate-500">
                            {item.codigo}
                          </td>
                          <td className="px-3 py-3 text-slate-600">
                            {item.razonSocial}
                          </td>
                          <td className="px-3 py-3 text-slate-500">
                            {item.conceptoOBS}
                          </td>
                          <td className="px-5 py-3 text-right font-black text-slate-800">
                            {money(item.monto)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </>
            ) : (
              <>
                {pagoVariosDetail ? (
                  <>
                    <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setPagoVariosDetail(null);
                          setPagoVariosDetailItems([]);
                          setPagoVariosTab("REALIZADOS");
                        }}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Volver
                      </button>
                      <span className="text-sm font-bold text-slate-800">
                        {formatDateTime(pagoVariosDetail.fechaEmision) || "-"}
                      </span>
                    </div>
                    <div className="border-b border-slate-100 px-5 py-3 text-sm">
                      <p className="text-xs text-slate-400">Fecha</p>
                      <p className="font-semibold text-slate-700">
                        {formatDateTime(pagoVariosDetail.fechaEmision) || pagoVariosDetail.fechaEmision}
                      </p>
                    </div>
                    <table className="w-full min-w-[900px] border-collapse text-sm">
                      <thead className="bg-white text-xs uppercase text-slate-400">
                        <tr>
                          <th className="border-b border-slate-100 px-5 py-3 text-left">
                            Documento
                          </th>
                          <th className="border-b border-slate-100 px-3 py-3 text-left">
                            Código
                          </th>
                          <th className="border-b border-slate-100 px-3 py-3 text-left">
                            Cliente
                          </th>
                          <th className="border-b border-slate-100 px-3 py-3 text-left">
                            Concepto OBS
                          </th>
                          <th className="border-b border-slate-100 px-5 py-3 text-right">
                            Total
                          </th>
                          <th className="border-b border-slate-100 px-5 py-3 text-right">
                            Efectivo
                          </th>
                          <th className="border-b border-slate-100 px-5 py-3 text-right">
                            Depósito
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {isPagoVariosDetailLoading ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-5 py-12 text-center text-slate-400"
                            >
                              Cargando detalle...
                            </td>
                          </tr>
                        ) : pagoVariosDetailItems.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="px-5 py-12 text-center text-slate-400"
                            >
                              No hay documentos en este pago.
                            </td>
                          </tr>
                        ) : (
                          pagoVariosDetailItems.map((item) => (
                            <tr
                              key={`${item.docuId}-${item.notaId}`}
                              className="border-b border-slate-50 last:border-0"
                            >
                              <td className="px-5 py-3 font-semibold text-slate-700">
                                {item.documento || "-"}
                              </td>
                              <td className="px-3 py-3 text-slate-500">
                                {item.codigo || "-"}
                              </td>
                              <td className="px-3 py-3 text-slate-600">
                                {item.razonSocial || "-"}
                              </td>
                              <td className="px-3 py-3 text-slate-500">
                                {item.conceptoOBS || "-"}
                              </td>
                              <td className="px-5 py-3 text-right font-black text-slate-800">
                                {money(item.monto)}
                              </td>
                              <td className="px-5 py-3 text-right text-slate-700">
                                {money(item.efectivo)}
                              </td>
                              <td className="px-5 py-3 text-right text-slate-700">
                                {money(item.deposito)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 px-5 py-3">
                      <label className="flex flex-col gap-1 text-xs text-slate-600">
                        Fecha inicio
                        <input
                          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                          type="date"
                          value={pagoVariosHistoryStart}
                          onChange={(event) =>
                            setPagoVariosHistoryStart(event.target.value)
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-slate-600">
                        Fecha fin
                        <input
                          className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                          type="date"
                          value={pagoVariosHistoryEnd}
                          onChange={(event) =>
                            setPagoVariosHistoryEnd(event.target.value)
                          }
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void fetchPagoVariosHistory()}
                        disabled={isPagoVariosHistoryLoading}
                        className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
                      >
                        Buscar
                      </button>
                      <span className="ml-auto text-xs font-medium text-slate-400">
                        {integer(pagoVariosHistory.length)} pagos realizados
                      </span>
                    </div>
                    <table className="w-full min-w-[1120px] border-collapse text-sm">
                      <thead className="bg-white text-xs uppercase text-slate-400">
                        <tr>
                          <th className="border-b border-slate-100 px-5 py-3 text-left">
                            Fecha
                          </th>
                          <th className="border-b border-slate-100 px-3 py-3 text-left">
                            Descripción
                          </th>
                          <th className="border-b border-slate-100 px-3 py-3 text-left">
                            Pago
                          </th>
                          <th className="border-b border-slate-100 px-3 py-3 text-left">
                            Operación
                          </th>
                          <th className="border-b border-slate-100 px-3 py-3 text-left">
                            Usuario
                          </th>
                          <th className="border-b border-slate-100 px-5 py-3 text-right">
                            Efectivo
                          </th>
                          <th className="border-b border-slate-100 px-5 py-3 text-right">
                            Depósito
                          </th>
                          <th className="border-b border-slate-100 px-5 py-3 text-right">
                            Total
                          </th>
                          <th className="border-b border-slate-100 px-3 py-3 text-left">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {isPagoVariosHistoryLoading ? (
                          <tr>
                            <td
                              colSpan={9}
                              className="px-5 py-12 text-center text-slate-400"
                            >
                              Cargando historial...
                            </td>
                          </tr>
                        ) : pagoVariosHistory.length === 0 ? (
                          <tr>
                            <td
                              colSpan={9}
                              className="px-5 py-12 text-center text-slate-400"
                            >
                              No hay pagos realizados en el periodo.
                            </td>
                          </tr>
                        ) : (
                          pagoVariosHistory.map((item) => (
                            <tr
                              key={item.pagoId}
                              className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
                            >
                              <td className="px-5 py-3 text-slate-600">
                                {formatDateTime(item.fechaEmision) || item.fechaEmision}
                              </td>
                              <td className="px-3 py-3 font-semibold text-slate-700">
                                {item.descripcion}
                              </td>
                              <td className="px-3 py-3 text-slate-500">
                                {pagoVariosPaymentLabel(
                                  item.formaPago,
                                  item.entidad,
                                )}
                              </td>
                              <td className="px-3 py-3 text-slate-500">
                                {item.nroOperacion || "-"}
                              </td>
                              <td className="px-3 py-3 text-slate-500">
                                {item.usuario}
                              </td>
                              <td className="px-5 py-3 text-right text-slate-700">
                                {money(item.efectivo)}
                              </td>
                              <td className="px-5 py-3 text-right text-slate-700">
                                {money(item.deposito)}
                              </td>
                              <td className="px-5 py-3 text-right font-black text-slate-800">
                                {money(item.total)}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => void viewPagoVarios(item)}
                                  disabled={isPagoVariosHistoryLoading}
                                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-blue-600 hover:underline disabled:opacity-50"
                                  title="Ver detalle del pago"
                                  aria-label="Ver detalle del pago"
                                >
                                  <Eye className="h-4 w-4" />
                                  Ver
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </>
                )}
              </>
            )}
          </div>

          {pagoVariosTab === "PENDIENTES" ? (
            <aside className="flex min-h-0 shrink-0 flex-col gap-4 border-t border-slate-100 bg-slate-50/70 p-5 lg:border-l lg:border-t-0">
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto [&>*]:shrink-0">
                <div className="rounded-md border border-red-100 bg-white p-4">
                  <p className="text-[11px] font-black uppercase text-red-600">
                    {pagoVariosDetail ? "Total del pago" : "Total a pagar"}
                  </p>
                  <p className="mt-1 text-3xl font-black text-slate-900">
                    S/ {money(pagoVariosDetail?.total ?? pagoVariosTotal)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {integer(
                      pagoVariosDetail
                        ? pagoVariosDetailItems.length
                        : selectedPagoVariosItems.length,
                    )}{" "}
                    documentos {pagoVariosDetail ? "del pago" : "seleccionados"}
                  </p>
                </div>

                <label className="grid gap-1 text-xs font-bold text-slate-500">
                  Forma pago
                  <select
                    data-pago-varios-forma="true"
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-slate-400"
                    value={pagoVariosDetail?.formaPago ?? pagoVariosFormaPago}
                    onChange={(event) =>
                      setPagoVariosFormaPago(event.target.value)
                    }
                    disabled={Boolean(pagoVariosDetail)}
                  >
                    {PAYMENT_METHOD_OPTIONS.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid min-w-0 gap-1 text-xs font-bold text-slate-500">
                    Depósito
                    <input
                      type="number"
                      inputMode="decimal"
                      data-pago-varios-deposito="true"
                      min="0"
                      step="0.01"
                      className="h-11 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-right text-base font-semibold text-slate-700 outline-none focus:border-slate-400 disabled:bg-slate-100"
                      value={
                        pagoVariosDetail
                          ? String(pagoVariosDetail.deposito)
                          : isPagoVariosMixed
                            ? pagoVariosDeposito
                            : pagoVariosDepositoFinal > 0
                              ? String(
                                  Number(pagoVariosDepositoFinal.toFixed(2)),
                                )
                              : ""
                      }
                      onChange={(event) =>
                        setPagoVariosDeposito(event.target.value)
                      }
                      disabled={Boolean(pagoVariosDetail) || !isPagoVariosMixed}
                    />
                  </label>
                  <label className="grid min-w-0 gap-1 text-xs font-bold text-slate-500">
                    Efectivo
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      className="h-11 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-right text-base font-semibold text-slate-700 outline-none disabled:bg-slate-100"
                      value={
                        pagoVariosDetail
                          ? String(pagoVariosDetail.efectivo)
                          : pagoVariosEfectivoFinal > 0
                            ? String(Number(pagoVariosEfectivoFinal.toFixed(2)))
                            : ""
                      }
                      disabled
                    />
                  </label>
                </div>

                <label className="grid gap-1 text-xs font-bold text-slate-500">
                  Entidad
                  <select
                    data-pago-varios-entidad="true"
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 disabled:bg-slate-100"
                    value={pagoVariosDetail?.entidad ?? pagoVariosEntidadFinal}
                    onChange={(event) => {
                      setPagoVariosEntidad(event.target.value);
                      focusPagoVariosField("operacion");
                    }}
                    disabled={
                      Boolean(pagoVariosDetail) || !pagoVariosEntidadEditable
                    }
                  >
                    {BANK_OPTIONS.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-xs font-bold text-slate-500">
                  Nro operacion
                  <input
                    data-pago-varios-operacion="true"
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-slate-400 disabled:bg-slate-100"
                    value={
                      pagoVariosDetail
                        ? pagoVariosDetail.nroOperacion || ""
                        : pagoVariosRequiereOperacion
                          ? pagoVariosOperacion
                          : ""
                    }
                    onChange={(event) =>
                      setPagoVariosOperacion(event.target.value)
                    }
                    onFocus={(event) => event.currentTarget.select()}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      focusPagoVariosField("descripcion");
                    }}
                    disabled={
                      Boolean(pagoVariosDetail) || !pagoVariosRequiereOperacion
                    }
                  />
                </label>

                <label className="grid gap-1 text-xs font-bold text-slate-500">
                  Descripcion
                  <textarea
                    key={
                      pagoVariosDetail
                        ? `detalle-${pagoVariosDetail.pagoId}-${pagoVariosDetail.descripcion}`
                        : "borrador"
                    }
                    data-pago-varios-descripcion="true"
                    data-no-history-guard="true"
                    ref={pagoVariosDescripcionRef}
                    className="min-h-[76px] resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
                    defaultValue={
                      pagoVariosDetail?.descripcion ??
                      pagoVariosDescripcionDraftRef.current
                    }
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => {
                      const value = event.target.value.toUpperCase();
                      event.currentTarget.value = value;
                      pagoVariosDescripcionDraftRef.current = value;
                    }}
                    disabled={Boolean(pagoVariosDetail)}
                  />
                </label>
              </div>
              <button
                type="button"
                className="mt-auto inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-red-700 px-4 text-sm font-black uppercase text-white transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => {
                  if (pagoVariosDetail) {
                    confirmDeletePagoVarios(pagoVariosDetail);
                    return;
                  }
                  void registerPagoVarios();
                }}
                disabled={
                  pagoVariosDetail
                    ? isPagoVariosDetailLoading
                    : isPagoVariosSaving ||
                      isPagoVariosLoading ||
                      !selectedPagoVariosItems.length ||
                      pagoVariosConceptos.length !== 1
                }
              >
                {pagoVariosDetail ? (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Eliminar pago
                  </>
                ) : isPagoVariosSaving ? (
                  "Guardando..."
                ) : (
                  "Pagar seleccionados"
                )}
              </button>
              {pagoVariosDetail ? (
                <button
                  type="button"
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-black uppercase text-slate-700 transition-colors hover:bg-slate-100"
                  onClick={resetPagoVariosForm}
                >
                  <Plus className="h-4 w-4" />
                  Nuevo
                </button>
              ) : null}
            </aside>
          ) : null}
        </div>
      </section>
    </div>
  ) : null;
}
