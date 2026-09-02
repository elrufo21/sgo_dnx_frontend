import DataTable from "@/components/DataTable";
import NavigableNumberInput from "@/components/inputs/NavigableNumberInput";
import { CashFlowReportPdf } from "@/features/cashFlow/components/CashFlowReportPdf";
import { API_BASE_URL } from "@/config";
import { apiRequest } from "@/shared/helpers/apiRequest";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import { toast } from "@/shared/ui/toast";
import { useAuthStore } from "@/store/auth/auth.store";
import { CASH_DENOMINATIONS } from "@/shared/constants/cashDenominations";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { esES } from "@mui/x-date-pickers/locales";
import { pdf } from "@react-pdf/renderer";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/es";
import {
  FilePlus2,
  Lock,
  Mail,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Unlock,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Movement = {
  descripcion: string;
  importe: number;
  manual: boolean;
  id?: number;
  estado?: string;
  clientId?: string;
  tipo?: "income" | "expense";
};
type Coin = { denominacion: number; cantidad: number; id?: number };
type Preparation = {
  fecha: string;
  cajeros: string;
  totalObs: number;
  sencillo: number;
  monedas: Coin[];
  ingresos: Omit<Movement, "manual">[];
  gastos: Omit<Movement, "manual">[];
  existe: boolean;
};
type SavedReport = {
  id: number;
  fecha: string;
  cajeros: string;
  totalObs: number;
  salidas: number;
  diferencia: number;
  totalEsperado: number;
  usuario: string;
  observaciones: string;
};
type ReportDetail = Pick<Preparation, "monedas" | "ingresos" | "gastos">;
const today = () => getLocalDateISO();
const money = (value: number) => `${Number(value || 0).toFixed(2)}`;
const BASE_INCOMES = new Set([
  "TOTAL EFECTIVO",
  "VITRINA",
  "SENCILLO",
  "IOC",
  "REVISTAS",
  "COPIAS Y OTROS",
]);
const isBaseIncome = (row: Movement) =>
  BASE_INCOMES.has(row.descripcion.trim().toUpperCase());
const defaultCoins = (): Coin[] =>
  CASH_DENOMINATIONS.map((denominacion) => ({ denominacion, cantidad: 0 }));
const completeCoins = (monedas: Coin[] = []) =>
  defaultCoins().map((coin) => {
    const saved = monedas.find(
      (item) => Number(item.denominacion) === coin.denominacion,
    );
    return { ...coin, cantidad: saved?.cantidad ?? 0, id: saved?.id };
  });

export default function CashFinalReportPage() {
  const user = useAuthStore((state) => state.user);
  const [view, setView] = useState<"new" | "list" | "detail">("new");
  const [fecha, setFecha] = useState(today);
  const [fechaInicio, setFechaInicio] = useState(() =>
    `${today().slice(0, 8)}01`,
  );
  const [fechaFin, setFechaFin] = useState(today);
  const [listRange, setListRange] = useState(() => {
    const date = today();
    return { fechaInicio: `${date.slice(0, 8)}01`, fechaFin: date };
  });
  const [preparation, setPreparation] = useState<Preparation | null>(null);
  const [coins, setCoins] = useState<Coin[]>(defaultCoins);
  const [incomeRows, setIncomeRows] = useState<Movement[]>([]);
  const [expenseRows, setExpenseRows] = useState<Movement[]>([]);
  const [manualRows, setManualRows] = useState<Movement[]>([]);
  const [observaciones, setObservaciones] = useState("");
  const [tab, setTab] = useState<"income" | "expense">("income");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reportId, setReportId] = useState<number | null>(null);
  const [reportUser, setReportUser] = useState("");
  const [printing, setPrinting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [refreshingObs, setRefreshingObs] = useState(false);
  const [editing, setEditing] = useState(false);
  const [openedReport, setOpenedReport] = useState<SavedReport | null>(null);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const preparationRequest = useRef(0);
  const columnHelper = createColumnHelper<SavedReport>();

  const load = async (date: string) => {
    const requestId = ++preparationRequest.current;
    setLoading(true);
    try {
      const response = await apiRequest<Preparation>({
        url: `${API_BASE_URL}/CierreCajaFinal/preparacion?fecha=${date}`,
        fallback: null,
      });
      if (!response || typeof response !== "object" || !("monedas" in response))
        throw new Error("No se pudo cargar la información de caja.");
      if (requestId !== preparationRequest.current) return;
      const data = response as Preparation;
      setPreparation(data);
      setCoins(completeCoins(data.monedas));
      setIncomeRows(
        (data.ingresos ?? []).map((row) => ({ ...row, manual: false })),
      );
      setExpenseRows(
        (data.gastos ?? []).map((row) => ({ ...row, manual: false })),
      );
    } catch (error) {
      if (requestId !== preparationRequest.current) return;
      setPreparation(null);
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo cargar la información de caja.",
      );
    } finally {
      if (requestId === preparationRequest.current) setLoading(false);
    }
  };

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest<SavedReport[]>({
        url: `${API_BASE_URL}/CierreCajaFinal?fechaInicio=${listRange.fechaInicio}&fechaFin=${listRange.fechaFin}`,
        fallback: [],
      });
      setReports(Array.isArray(response) ? response : []);
    } finally {
      setLoading(false);
    }
  }, [listRange]);

  const searchReports = () => {
    if (!fechaInicio || !fechaFin) {
      toast.error("Selecciona fecha inicio y fecha fin.");
      return;
    }
    if (fechaInicio > fechaFin) {
      toast.error("La fecha inicio no puede ser mayor que la fecha fin.");
      return;
    }
    setListRange({ fechaInicio, fechaFin });
  };

  const refreshObs = async () => {
    if (!preparation || readOnly || refreshingObs) return;
    setRefreshingObs(true);
    try {
      const response = await apiRequest<Preparation>({
        url: `${API_BASE_URL}/CierreCajaFinal/preparacion?fecha=${fecha}`,
        fallback: null,
      });
      if (
        !response ||
        typeof response !== "object" ||
        !("totalObs" in response)
      )
        throw new Error("No se pudo actualizar el total OBS.");
      setPreparation((current) =>
        current
          ? { ...current, totalObs: Number(response.totalObs || 0) }
          : current,
      );
      toast.success("Sistema OBS actualizado.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el total OBS.",
      );
    } finally {
      setRefreshingObs(false);
    }
  };

  useEffect(() => {
    if (view !== "new") return;
    setManualRows([]);
    setObservaciones("");
    void load(fecha);
  }, [fecha, view]);

  useEffect(() => {
    if (view === "list") void loadList();
  }, [loadList, view]);

  const allExpenseRows = useMemo(
    () => [
      ...expenseRows,
      ...manualRows.filter((row) => row.tipo === "expense"),
    ],
    [expenseRows, manualRows],
  );

  const totals = useMemo(() => {
    const expenses = allExpenseRows.reduce(
      (sum, row) => sum + Number(row.importe || 0),
      0,
    );
    const sourceAmount = (name: string) =>
      incomeRows
        .filter((row) => row.descripcion.trim().toUpperCase() === name)
        .reduce((sum, row) => sum + Number(row.importe || 0), 0);
    const fixed: Movement[] = [
      {
        descripcion: "TOTAL EFECTIVO",
        importe: Math.max(0, Number(preparation?.totalObs || 0) - expenses),
        manual: false,
      },
      {
        descripcion: "VITRINA",
        importe: sourceAmount("VITRINA"),
        manual: false,
      },
      {
        descripcion: "SENCILLO",
        importe: Number(preparation?.sencillo || 0),
        manual: false,
      },
      { descripcion: "IOC", importe: sourceAmount("IOC"), manual: false },
      {
        descripcion: "REVISTAS",
        importe: sourceAmount("REVISTAS"),
        manual: false,
      },
      {
        descripcion: "COPIAS Y OTROS",
        importe: sourceAmount("COPIAS Y OTROS"),
        manual: false,
      },
    ];
    const incomes = [
      ...fixed,
      ...manualRows.filter((row) => row.tipo === "income"),
    ];
    const expected = incomes.reduce(
      (sum, row) => sum + Number(row.importe || 0),
      0,
    );
    const counted = coins.reduce(
      (sum, row) => sum + row.cantidad * row.denominacion,
      0,
    );
    const bills = coins
      .filter((row) => row.denominacion >= 10)
      .reduce((sum, row) => sum + row.cantidad * row.denominacion, 0);
    return {
      expenses,
      incomes,
      expected,
      counted,
      bills,
      difference: counted - expected,
    };
  }, [
    coins,
    allExpenseRows,
    incomeRows,
    manualRows,
    preparation?.sencillo,
    preparation?.totalObs,
  ]);

  const addMovement = () =>
    setManualRows((rows) => [
      ...rows,
      {
        descripcion: "",
        importe: 0,
        manual: true,
        clientId: crypto.randomUUID(),
        tipo: tab,
      },
    ]);
  const changeMovement = (clientId: string, values: Partial<Movement>) =>
    setManualRows((rows) =>
      rows.map((row) =>
        row.clientId === clientId ? { ...row, ...values } : row,
      ),
    );
  const removeMovement = (clientId: string) =>
    setManualRows((rows) => rows.filter((row) => row.clientId !== clientId));
  const updateCoin = (index: number, value: string) =>
    setCoins((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index
          ? { ...row, cantidad: Math.max(0, Math.trunc(Number(value) || 0)) }
          : row,
      ),
    );

  const save = async () => {
    if (!preparation || !user) return;
    if (totals.difference !== 0 && !observaciones.trim()) {
      toast.error("Ingresa una observación para justificar la diferencia.");
      return;
    }
    setSaving(true);
    try {
      const response = await apiRequest<{ ok?: boolean; mensaje?: string }>({
        url:
          editing && reportId
            ? `${API_BASE_URL}/CierreCajaFinal/${reportId}`
            : `${API_BASE_URL}/CierreCajaFinal`,
        method: editing && reportId ? "PUT" : "POST",
        data: {
          fecha,
          usuarioId: Number(user.id),
          usuario: user.displayName || user.username,
          cajeros: preparation.cajeros,
          totalObs: preparation.totalObs,
          observaciones,
          ingresos: totals.incomes.map((row) => ({
            ...row,
            id:
              row.id ??
              incomeRows.find(
                (item) =>
                  item.descripcion.trim().toUpperCase() ===
                  row.descripcion.trim().toUpperCase(),
              )?.id ?? 0,
            estado:
              row.estado ??
              incomeRows.find(
                (item) =>
                  item.descripcion.trim().toUpperCase() ===
                  row.descripcion.trim().toUpperCase(),
              )?.estado ?? "T",
          })),
          gastos: allExpenseRows,
          monedas: coins,
        },
        fallback: { ok: false, mensaje: "No se pudo registrar el informe." },
      });
      const result = response as { ok?: boolean; mensaje?: string };
      if (!result?.ok)
        throw new Error(result?.mensaje || "No se pudo registrar el informe.");
      toast.success(result.mensaje || "Informe final registrado.");
      setEditing(false);
      setView("list");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el informe.",
      );
    } finally {
      setSaving(false);
    }
  };

  const viewReport = async (report: SavedReport) => {
    setLoading(true);
    try {
      const response = await apiRequest<ReportDetail>({
        url: `${API_BASE_URL}/CierreCajaFinal/${report.id}`,
        fallback: null,
      });
      if (!response || typeof response !== "object" || !("monedas" in response))
        throw new Error("No se pudo cargar el informe.");
      const detail = response as ReportDetail;
      setFecha(report.fecha);
      setOpenedReport(report);
      setEditing(false);
      setReportId(report.id);
      setReportUser(report.usuario);
      setPreparation({
        fecha: report.fecha,
        cajeros: report.cajeros,
        totalObs: report.totalObs,
        sencillo:
          detail.ingresos.find(
            (row) => row.descripcion.trim().toUpperCase() === "SENCILLO",
          )?.importe || 0,
        monedas: detail.monedas,
        ingresos: detail.ingresos,
        gastos: detail.gastos,
        existe: true,
      });
      setCoins(completeCoins(detail.monedas));
      const savedIncomes = detail.ingresos.map((row) => ({
        ...row,
        manual: false,
      }));
      setIncomeRows(savedIncomes.filter(isBaseIncome));
      setExpenseRows(detail.gastos.map((row) => ({ ...row, manual: false })));
      setManualRows(
        savedIncomes
          .filter((row) => !isBaseIncome(row))
          .map((row) => ({
            ...row,
            manual: true,
            tipo: "income",
            clientId: crypto.randomUUID(),
          })),
      );
      setObservaciones(report.observaciones);
      setTab("income");
      setView("detail");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo cargar el informe.",
      );
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    columnHelper.display({
      id: "ver",
      header: "Ver",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => void viewReport(row.original)}
          className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline"
        >
          Ver
        </button>
      ),
    }),
    columnHelper.accessor("fecha", { header: "Fecha" }),
    columnHelper.accessor("cajeros", { header: "Cajeros" }),
    columnHelper.accessor("totalObs", {
      header: "Sistema OBS",
      cell: (info) => money(info.getValue()),
    }),
    columnHelper.accessor("salidas", {
      header: "Salidas",
      cell: (info) => money(info.getValue()),
    }),
    columnHelper.accessor("diferencia", {
      header: "Diferencia",
      cell: (info) => (
        <span
          className={
            info.getValue() === 0 ? "text-emerald-700" : "text-red-600"
          }
        >
          {money(info.getValue())}
        </span>
      ),
    }),
    columnHelper.accessor("usuario", { header: "Registró" }),
  ] as unknown as ColumnDef<SavedReport, unknown>[];

  const panelRows = tab === "income"
    ? [
        ...totals.incomes.filter((row) => !row.manual),
        ...manualRows.filter((row) => row.tipo === "income"),
      ]
    : allExpenseRows;
  const readOnly = view === "detail" && !editing;
  const resetToNew = () => {
    setReportId(null);
    setReportUser("");
    setOpenedReport(null);
    setEditing(false);
    setManualRows([]);
    setView("new");
  };
  const toggleEditing = () => {
    if (editing && openedReport) void viewReport(openedReport);
    else setEditing(true);
  };
  const generatePdf = async () => {
    if (!preparation || !reportId)
      throw new Error("No se pudo identificar el informe.");
    return pdf(
      <CashFlowReportPdf
        cajaId={reportId}
        encargado={preparation.cajeros}
        usuario={reportUser}
        fechaApertura={fecha}
        fechaCierre={fecha}
        sistemaObs={preparation.totalObs}
        gastos={allExpenseRows}
        ingresos={totals.incomes}
        conteoMonedas={coins}
        totalEfectivo={totals.counted}
        totalBilletes={totals.bills}
        totalSencillo={totals.counted - totals.bills}
        totalIngresos={totals.expected}
        diferencial={totals.difference}
        observaciones={observaciones}
        documentTitle={`Informe final de caja ${reportId}`}
      />,
    ).toBlob();
  };
  const printReport = async () => {
    if (printing) return;
    const reportWindow = window.open("", "_blank");
    setPrinting(true);
    try {
      const url = URL.createObjectURL(await generatePdf());
      if (reportWindow) reportWindow.location.href = url;
      else {
        const link = document.createElement("a");
        link.href = url;
        link.download = `Informe_final_caja_${reportId}.pdf`;
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      reportWindow?.close();
      toast.error(
        error instanceof Error ? error.message : "No se pudo generar el PDF.",
      );
    } finally {
      setPrinting(false);
    }
  };
  const sendReportEmail = async () => {
    if (sendingEmail || !reportId) return;
    setSendingEmail(true);
    try {
      const data = new FormData();
      data.append("conteoId", String(reportId));
      data.append("fechaReporte", fecha);
      data.append("diferencial", String(totals.difference));
      data.append(
        "pdf",
        new File([await generatePdf()], `Informe_final_caja_${reportId}.pdf`, {
          type: "application/pdf",
        }),
      );
      const result = await apiRequest<{ ok?: boolean; mensaje?: string }>({
        url: `${API_BASE_URL}/Correo/enviar-informe-caja-final`,
        method: "POST",
        data,
        config: { headers: { Accept: "application/json" } },
        fallback: { ok: false, mensaje: "No se pudo enviar el correo." },
      });
      if (!result?.ok)
        throw new Error(result?.mensaje || "No se pudo enviar el correo.");
      toast.success(result.mensaje || "Correo enviado.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo enviar el correo.",
      );
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-gray-50">
      <div className="sticky top-2 z-30 flex items-center justify-between bg-[#B23636] px-2 py-2 text-white shadow-lg shadow-black/10 sm:px-4">
        <div className="flex items-center gap-2">
          <div className="flex rounded bg-black/10 p-0.5 text-xs">
            <button
              type="button"
              onClick={resetToNew}
              className={`rounded px-2 py-1 font-semibold ${view === "new" ? "bg-white text-[#B23636]" : "text-white"}`}
            >
              Nuevo
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`rounded px-2 py-1 font-semibold ${view === "list" ? "bg-white text-[#B23636]" : "text-white"}`}
            >
              Listado
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view === "detail" && (
            <>
              <button
                type="button"
                onClick={toggleEditing}
                title={
                  editing ? "Bloquear y descartar cambios" : "Editar informe"
                }
                aria-label={editing ? "Bloquear informe" : "Editar informe"}
                className="rounded p-1 text-red-100 hover:bg-red-700 hover:text-white"
              >
                {editing ? <Unlock size={16} /> : <Lock size={16} />}
              </button>
              <button
                type="button"
                onClick={resetToNew}
                title="Nuevo informe"
                aria-label="Nuevo informe"
                className="rounded p-1 text-red-100 hover:bg-red-700 hover:text-white"
              >
                <FilePlus2 size={16} />
              </button>
            </>
          )}
          {readOnly && (
            <>
              <button
                type="button"
                disabled={printing}
                onClick={() => void printReport()}
                title="Abrir PDF"
                aria-label="Abrir PDF"
                className="rounded p-1 text-red-100 hover:bg-red-700 hover:text-white disabled:opacity-50"
              >
                <Printer size={16} />
              </button>
              <button
                type="button"
                disabled={sendingEmail}
                onClick={() => void sendReportEmail()}
                title="Enviar correo"
                aria-label="Enviar correo"
                className="rounded p-1 text-red-100 hover:bg-red-700 hover:text-white disabled:opacity-50"
              >
                <Mail size={16} />
              </button>
            </>
          )}
          <button
            type="button"
            disabled={
              !(view === "new" || editing) ||
              saving ||
              !preparation ||
              (view === "new" && preparation.existe)
            }
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 rounded bg-red-600 px-2 py-1 text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            <Save size={15} />
            {saving ? "Guardando" : "Guardar"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="p-2 sm:p-3">
          {view === "list" ? (
            <DataTable
              columns={columns}
              data={reports}
              isLoading={loading}
              emptyMessage="No hay informes finales registrados."
              searchPlaceholder="Buscar informe..."
              filterKeys={["cajeros", "usuario"]}
              renderFilters={
                <LocalizationProvider
                  dateAdapter={AdapterDayjs}
                  adapterLocale="es"
                  localeText={
                    esES.components.MuiLocalizationProvider.defaultProps
                      .localeText
                  }
                >
                  <div className="flex w-full flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 xl:w-auto">
                    <label className="flex min-w-[160px] flex-col gap-1 text-xs text-slate-600">
                      Fecha Inicio
                      <DatePicker
                        format="DD/MM/YY"
                        value={fechaInicio ? dayjs(fechaInicio) : null}
                        onChange={(value: Dayjs | null) =>
                          setFechaInicio(value?.format("YYYY-MM-DD") ?? "")
                        }
                        slotProps={{
                          textField: {
                            size: "small",
                            sx: {
                              width: "100%",
                              "& .MuiOutlinedInput-root": {
                                height: 44,
                                borderRadius: "0.5rem",
                                backgroundColor: "#ffffff",
                              },
                            },
                          },
                        }}
                      />
                    </label>
                    <label className="flex min-w-[160px] flex-col gap-1 text-xs text-slate-600">
                      Fecha Fin
                      <DatePicker
                        format="DD/MM/YY"
                        value={fechaFin ? dayjs(fechaFin) : null}
                        onChange={(value: Dayjs | null) =>
                          setFechaFin(value?.format("YYYY-MM-DD") ?? "")
                        }
                        slotProps={{
                          textField: {
                            size: "small",
                            sx: {
                              width: "100%",
                              "& .MuiOutlinedInput-root": {
                                height: 44,
                                borderRadius: "0.5rem",
                                backgroundColor: "#ffffff",
                              },
                            },
                          },
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={searchReports}
                      disabled={loading}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
                      aria-label="Buscar por fecha"
                    >
                      <Search className="h-4 w-4" />
                    </button>
                  </div>
                </LocalizationProvider>
              }
            />
          ) : loading ? (
            <div className="rounded border border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
              Cargando cierre…
            </div>
          ) : (
            <div className="space-y-3">
              <div className="mb-1 rounded border border-gray-200 bg-white p-2">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-gray-700">
                    Fecha del informe
                    <input
                      type="date"
                      value={fecha}
                      disabled={readOnly}
                      onChange={(event) => setFecha(event.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs focus:border-slate-500 focus:outline-none disabled:bg-slate-50"
                    />
                  </label>
                  <div>
                    <p className="text-xs font-semibold text-gray-700">
                      Cajeros
                    </p>
                    <div className="mt-1 min-h-[30px] rounded-md border border-gray-200 bg-slate-50 px-2 py-1.5 text-xs">
                      {preparation?.cajeros || "Sin cajas cerradas"}
                    </div>
                    {view === "new" && preparation?.existe && (
                      <p className="mt-1 text-xs font-semibold text-red-600">
                        Ya existe un informe final para esta fecha.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded border border-gray-200 bg-white p-2">
                  <div className="overflow-hidden rounded border border-gray-200">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[280px] table-fixed text-xs">
                        <thead className="border-b border-gray-200 bg-slate-50 text-slate-700">
                          <tr>
                            <th className="w-1/3 px-2 py-1 text-center">
                              Efectivo
                            </th>
                            <th className="w-1/3 px-2 py-1 text-center">
                              Billete
                            </th>
                            <th className="w-1/3 px-2 py-1 text-center">
                              Monto
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {coins.map((coin, index) => (
                            <tr
                              key={coin.denominacion}
                              className="hover:bg-slate-50"
                            >
                              <td className="px-2 py-0.5">
                                <NavigableNumberInput
                                  navGroup="final-cash-count"
                                  disabled={readOnly}
                                  value={coin.cantidad || ""}
                                  onChange={(value) => updateCoin(index, value)}
                                  className="w-full rounded border border-gray-200 px-1 py-0.5 text-center text-xs focus:border-slate-500 focus:outline-none disabled:border-transparent disabled:bg-transparent"
                                />
                              </td>
                              <td className="px-2 py-0.5 text-right text-gray-700">
                                {money(coin.denominacion)}
                              </td>
                              <td className="px-2 py-0.5 text-right font-semibold text-slate-800">
                                {money(coin.cantidad * coin.denominacion)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-slate-800 p-2 text-white">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">Total</span>
                        <span className="text-base font-bold">
                          {money(totals.counted)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded border border-gray-200 bg-white p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setTab("income")}
                        className={`flex-1 rounded px-3 py-1 text-xs font-medium ${tab === "income" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-700"}`}
                      >
                        Ingresos
                      </button>
                      <button
                        type="button"
                        onClick={() => setTab("expense")}
                        className={`flex-1 rounded px-3 py-1 text-xs font-medium ${tab === "expense" ? "bg-slate-800 text-white" : "bg-gray-100 text-gray-700"}`}
                      >
                        Gastos
                      </button>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={addMovement}
                        className="rounded bg-slate-700 p-1 text-white"
                      >
                        <Plus size={15} />
                      </button>
                    )}
                  </div>
                  <div className="mb-2 h-[min(40vh,282px)] min-h-[180px] overflow-y-auto overflow-x-auto rounded border border-gray-200">
                    <div className="flex h-full min-w-[280px] flex-col text-xs">
                      <div className="grid grid-cols-[minmax(0,1fr)_7rem_1.5rem] bg-slate-800 text-white">
                        <div className="px-2 py-1">Descripción</div>
                        <div className="border-l border-slate-500 px-2 py-1 text-right">
                          Importe
                        </div>
                        <div />
                      </div>
                      <div className="flex-1">
                        {panelRows.map((row, index) => (
                          <div
                            key={row.clientId ?? row.descripcion}
                            className={`grid grid-cols-[minmax(0,1fr)_7rem_1.5rem] ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                          >
                            <div className="break-words px-2 py-1">
                              {row.manual ? (
                                <input
                                  disabled={readOnly}
                                  defaultValue={row.descripcion}
                                  onBlur={(event) =>
                                    changeMovement(row.clientId!, {
                                      descripcion: event.target.value,
                                    })
                                  }
                                  className="w-full rounded border border-gray-200 px-1 py-0.5 text-xs"
                                />
                              ) : (
                                row.descripcion
                              )}
                            </div>
                            <div className="border-l border-slate-300 px-2 py-1 text-right font-medium">
                              {row.manual ? (
                                <NavigableNumberInput
                                  disabled={readOnly}
                                  value={row.importe || ""}
                                  onChange={(value) =>
                                    changeMovement(row.clientId!, {
                                      importe: Math.max(0, Number(value) || 0),
                                    })
                                  }
                                  className="w-24 rounded border border-gray-200 px-1 py-0.5 text-right text-xs"
                                />
                              ) : (
                                money(row.importe)
                              )}
                            </div>
                            <div className="px-1 py-1">
                              {!readOnly && row.manual && (
                                <button
                                  type="button"
                                  onClick={() => removeMovement(row.clientId!)}
                                  className="text-red-600"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="rounded bg-slate-800 p-2 text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">
                        Efectivo en Caja
                      </span>
                      <span className="text-base font-bold">
                        {money(
                          tab === "income" ? totals.expected : totals.expenses,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded border border-gray-200 bg-white p-2">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-28 font-bold text-slate-800">
                        Tot. Billetes:
                      </span>
                      <div className="flex-1 rounded border px-2 py-1 text-right font-semibold">
                        {money(totals.bills)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-28 font-bold text-slate-800">
                        Tot. Sencillo:
                      </span>
                      <div className="flex-1 rounded border bg-gray-50 px-2 py-1 text-right font-semibold">
                        {money(totals.counted - totals.bills)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <span className="w-28 font-bold text-slate-800">
                        Observaciones:
                      </span>
                      <textarea
                        readOnly={readOnly}
                        value={observaciones}
                        onChange={(event) =>
                          setObservaciones(event.target.value)
                        }
                        rows={2}
                        className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs read-only:bg-slate-50"
                        placeholder="Escriba sus observaciones..."
                      />
                    </div>
                  </div>
                </div>
                <div className="rounded border border-gray-200 bg-white p-2">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => void refreshObs()}
                        disabled={readOnly || refreshingObs || !preparation}
                        title="Actualizar total desde OBS"
                        className="inline-flex items-center gap-1 font-semibold text-gray-700 hover:text-slate-950 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
                      >
                        Sistema (OBS):
                        <RefreshCw
                          className={`h-3.5 w-3.5 ${refreshingObs ? "animate-spin" : ""}`}
                        />
                      </button>
                      <div className="w-32 rounded border px-2 py-1 text-right font-semibold">
                        {money(preparation?.totalObs || 0)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-700">
                        Salidas:
                      </span>
                      <div className="w-32 rounded bg-red-500 px-2 py-1 text-right font-bold text-white">
                        {money(totals.expenses)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-700">
                        Diferencial:
                      </span>
                      <div
                        className={`w-32 rounded border px-2 py-1 text-right font-semibold ${totals.difference === 0 ? "text-slate-800" : "text-red-600"}`}
                      >
                        {money(totals.difference)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
