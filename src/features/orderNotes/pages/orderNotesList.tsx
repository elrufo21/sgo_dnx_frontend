import DataTable from "@/components/DataTable";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { getLocalDateISO } from "@/shared/helpers/localDate";
import { toast } from "@/shared/ui/toast";
import { useOrderNoteStore } from "@/store/orderNote/orderNote.store";
import type { OrderNote } from "@/types/orderNote";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { esES } from "@mui/x-date-pickers/locales";
import { createColumnHelper } from "@tanstack/react-table";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/es";
import { Workbook } from "exceljs";
import { FileSpreadsheet, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

const columnHelper = createColumnHelper<OrderNote>();
const ORDER_NOTES_RANGE_STORAGE_KEY = "sgo.orderNotes.range";

const parseAmount = (value: unknown): number => {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  const normalized = raw.replace(/[^\d,.-]/g, "");
  if (!normalized) return 0;

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  let sanitized = normalized;
  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    sanitized =
      lastComma > lastDot
        ? normalized.replace(/\./g, "").replace(",", ".")
        : normalized.replace(/,/g, "");
  } else if (hasComma) {
    sanitized = normalized.replace(",", ".");
  }

  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAmount = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const splitDocumentLabel = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return { tipoDocumento: "", numeroDocumento: "" };
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    return { tipoDocumento: tokens[0], numeroDocumento: "" };
  }

  const lastToken = tokens[tokens.length - 1] ?? "";
  const looksLikeDocumentNumber =
    /[A-Z0-9]+-\d+/i.test(lastToken) || lastToken.includes("-");

  if (looksLikeDocumentNumber) {
    return {
      tipoDocumento: tokens.slice(0, -1).join(" "),
      numeroDocumento: lastToken,
    };
  }

  return {
    tipoDocumento: tokens[0],
    numeroDocumento: tokens.slice(1).join(" "),
  };
};

const isAnnulledStatus = (value: unknown) =>
  String(value ?? "")
    .toUpperCase()
    .includes("ANULAD");

const isCreditNoteDocument = (value: unknown) => {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return (
    normalized.includes("CREDITO") ||
    normalized.includes("N/C") ||
    normalized.startsWith("NC")
  );
};

const isProformaVDocument = (value: unknown) => {
  const normalized = String(splitDocumentLabel(value).tipoDocumento || value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  return normalized.includes("PROFORMA");
};

const isProformaVTypeForExport = (value: unknown) => {
  const normalized = String(splitDocumentLabel(value).tipoDocumento || value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  return normalized === "PROFORMA V" || normalized.startsWith("PROFORMA V ");
};

const getSignedTotal = (
  note: Pick<OrderNote, "estado" | "documento">,
  value: unknown,
) => {
  const amount = parseAmount(value);
  if (isCreditNoteDocument(note.documento)) {
    return Math.abs(amount);
  }
  return amount;
};

const OrderNotesList = () => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { notes, fetchNotes, loading } = useOrderNoteStore();
  const initialDate = useMemo(() => getLocalDateISO(), []);
  const resetRangeFromMainLayout = useMemo(() => {
    if (!state || typeof state !== "object") return false;
    return (state as Record<string, unknown>).resetOrderNotesFilters === true;
  }, [state]);
  const initialRange = useMemo(() => {
    if (resetRangeFromMainLayout) {
      return { from: initialDate, to: initialDate };
    }

    if (typeof window === "undefined") {
      return { from: initialDate, to: initialDate };
    }

    try {
      const raw = window.sessionStorage.getItem(ORDER_NOTES_RANGE_STORAGE_KEY);
      if (!raw) return { from: initialDate, to: initialDate };
      const parsed = JSON.parse(raw) as {
        from?: unknown;
        to?: unknown;
      } | null;
      const from = String(parsed?.from ?? "").trim();
      const to = String(parsed?.to ?? "").trim();
      if (!from || !to || from > to) {
        return { from: initialDate, to: initialDate };
      }
      return { from, to };
    } catch {
      return { from: initialDate, to: initialDate };
    }
  }, [initialDate, resetRangeFromMainLayout]);
  const [fechaInicio, setFechaInicio] = useState(initialRange.from);
  const [fechaFin, setFechaFin] = useState(initialRange.to);
  const fechaInicioRef = useRef(fechaInicio);
  const fechaFinRef = useRef(fechaFin);
  const endDateAcceptedRef = useRef(false);
  const lastFetchedRangeRef = useRef<{ from: string; to: string } | null>({
    from: initialRange.from,
    to: initialRange.to,
  });

  useEffect(() => {
    fechaInicioRef.current = fechaInicio;
  }, [fechaInicio]);

  useEffect(() => {
    fechaFinRef.current = fechaFin;
  }, [fechaFin]);

  const requestNotesByRange = useCallback(
    (fromValue: string, toValue: string) => {
      const from = String(fromValue ?? "").trim();
      const to = String(toValue ?? "").trim();

      if (!from || !to) {
        toast.error("Debes seleccionar fecha inicio y fecha fin.");
        return false;
      }

      if (from > to) {
        toast.error("La fecha inicio no puede ser mayor que la fecha fin.");
        return false;
      }

      void fetchNotes({ fechaInicio: from, fechaFin: to });
      lastFetchedRangeRef.current = { from, to };
      return true;
    },
    [fetchNotes],
  );

  useEffect(() => {
    if (!resetRangeFromMainLayout || typeof window === "undefined") return;
    window.sessionStorage.removeItem(ORDER_NOTES_RANGE_STORAGE_KEY);
  }, [resetRangeFromMainLayout]);

  useEffect(() => {
    requestNotesByRange(fechaInicioRef.current, fechaFinRef.current);
  }, [requestNotesByRange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const from = String(fechaInicio ?? "").trim();
    const to = String(fechaFin ?? "").trim();
    if (!from || !to || from > to) return;
    window.sessionStorage.setItem(
      ORDER_NOTES_RANGE_STORAGE_KEY,
      JSON.stringify({ from, to }),
    );
  }, [fechaFin, fechaInicio]);

  const handleSearch = useCallback(() => {
    requestNotesByRange(fechaInicio, fechaFin);
  }, [fechaFin, fechaInicio, requestNotesByRange]);

  const parsePickerDate = useCallback((value: Dayjs | null) => {
    const formatted = value?.format("YYYY-MM-DD") ?? "";
    return formatted.trim();
  }, []);
  const toExcelSafeText = (value: unknown) => {
    const text = String(value ?? "").trim();
    if (!text) return "";
    return /^[=+\-@]/.test(text) ? `'${text}` : text;
  };
  const handleExportExcel = useCallback(async () => {
    if (!notes.length) {
      toast.info("No hay datos para exportar.");
      return;
    }

    const exportableNotes = notes.filter(
      (note) => !isProformaVTypeForExport(note.documento),
    );

    if (!exportableNotes.length) {
      toast.info("No hay datos para exportar.");
      return;
    }

    try {
      const workbook = new Workbook();
      workbook.creator = "SGO";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Notas de Pedido", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      worksheet.columns = [
        { header: "ID Nota", key: "notaId", width: 12 },
        { header: "Tipo Documento", key: "tipoDocumento", width: 20 },
        { header: "N° Documento", key: "numeroDocumento", width: 18 },
        { header: "Fecha", key: "fecha", width: 14 },
        { header: "Cliente", key: "cliente", width: 34 },
        { header: "Forma Pago", key: "formaPago", width: 18 },
        { header: "Total", key: "total", width: 14 },
        { header: "A cuenta", key: "acuenta", width: 14 },
        { header: "Saldo", key: "saldo", width: 14 },
        { header: "Usuario", key: "usuario", width: 18 },
        { header: "Estado", key: "estado", width: 14 },
      ];

      worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: worksheet.columnCount },
      };

      const headerRow = worksheet.getRow(1);
      headerRow.height = 22;
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "B23636" },
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });

      exportableNotes.forEach((note, index) => {
        const { tipoDocumento, numeroDocumento } = splitDocumentLabel(
          note.documento,
        );

        const excelRow = worksheet.addRow({
          notaId: toExcelSafeText(note.notaId),
          tipoDocumento: toExcelSafeText(tipoDocumento || "-"),
          numeroDocumento: toExcelSafeText(numeroDocumento || "-"),
          fecha: toExcelSafeText(note.fecha),
          cliente: toExcelSafeText(note.cliente),
          formaPago: toExcelSafeText(note.formaPago),
          total: Number(getSignedTotal(note, note.total).toFixed(2)),
          acuenta: Number(parseAmount(note.acuenta).toFixed(2)),
          saldo: Number(parseAmount(note.saldo).toFixed(2)),
          usuario: toExcelSafeText(note.usuario),
          estado: toExcelSafeText(note.estado),
        });

        excelRow.eachCell((cell, colNumber) => {
          const isAmountColumn = colNumber >= 7 && colNumber <= 9;

          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };

          cell.alignment = {
            vertical: "top",
            horizontal: isAmountColumn ? "right" : "left",
            wrapText: colNumber === 5,
          };

          if (isAmountColumn) {
            cell.numFmt = "#,##0.00";
          }
        });

        if (index % 2 === 1) {
          excelRow.eachCell((cell) => {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" },
            };
          });
        }
      });

      const totalGeneral = exportableNotes.reduce(
        (acc, note) => acc + getSignedTotal(note, note.total),
        0,
      );

      const acuentaGeneral = exportableNotes.reduce(
        (acc, note) => acc + parseAmount(note.acuenta),
        0,
      );

      const saldoGeneral = exportableNotes.reduce(
        (acc, note) => acc + parseAmount(note.saldo),
        0,
      );

      worksheet.addRow({});

      const totalsRow = worksheet.addRow({
        notaId: `Items: ${exportableNotes.length}`,
        formaPago: "Totales S/",
        total: Number(totalGeneral.toFixed(2)),
        acuenta: Number(acuentaGeneral.toFixed(2)),
        saldo: Number(saldoGeneral.toFixed(2)),
      });

      totalsRow.eachCell((cell, colNumber) => {
        const isAmountColumn = colNumber >= 7 && colNumber <= 9;
        const isLabelColumn = colNumber === 1 || colNumber === 6;

        cell.font = { bold: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFCBD5E1" } },
          left: { style: "thin", color: { argb: "FFCBD5E1" } },
          bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
          right: { style: "thin", color: { argb: "FFCBD5E1" } },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE2E8F0" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: isAmountColumn ? "right" : "left",
        };

        if (isLabelColumn) {
          cell.alignment = { vertical: "middle", horizontal: "left" };
        }

        if (isAmountColumn) {
          cell.numFmt = "#,##0.00";
        }
      });

      const safeFilePart = (value?: string) =>
        String(value || "sin-fecha").replace(/[/\\:*?"<>|]/g, "-");

      const fileFrom = safeFilePart(fechaInicio);
      const fileTo = safeFilePart(fechaFin);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `notas-pedido_${fileFrom}_${fileTo}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
      toast.success("Excel generado correctamente.");
    } catch (error) {
      console.error("Error al exportar Excel de notas de pedido", error);
      toast.error("No se pudo exportar el archivo Excel.");
    }
  }, [fechaFin, fechaInicio, notes]);

  const solesTotals = useMemo(() => {
    const totals = notes.reduce(
      (acc, note) => {
        if (isAnnulledStatus(note.estado)) {
          return acc;
        }
        const amount = parseAmount(note.total);
        const formaPago = String(note.formaPago ?? "").toUpperCase();
        const isCash =
          formaPago.includes("EFECT") || formaPago.includes("CONTADO");

        if (isCash) {
          acc.efectivo += amount;
        } else {
          acc.depTarYape += amount;
        }
        return acc;
      },
      { efectivo: 0, depTarYape: 0 },
    );

    return {
      efectivo: totals.efectivo,
      depTarYape: totals.depTarYape,
      total: totals.efectivo + totals.depTarYape,
    };
  }, [notes]);

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "ver",
        header: "Ver",
        cell: ({ row }) => {
          const noteId = row.original.notaId;
          return (
            <button
              type="button"
              className="text-sm font-medium text-blue-600 hover:underline"
              onClick={() =>
                navigate(`/sales/order_notes/${noteId}/view`, {
                  state: { fromOrderNotesViewButton: true },
                })
              }
            >
              Ver
            </button>
          );
        },
      }),
      columnHelper.accessor("notaId", {
        header: "ID Nota",
        cell: (info) => info.getValue(),
      }),
      columnHelper.display({
        id: "tipoDocumento",
        header: "Documento",
        cell: ({ row }) =>
          splitDocumentLabel(row.original.documento).tipoDocumento || "-",
      }),
      columnHelper.display({
        id: "Número",
        header: "N° Documento",
        cell: ({ row }) =>
          splitDocumentLabel(row.original.documento).numeroDocumento || "-",
      }),
      columnHelper.accessor("fecha", {
        header: "Fecha",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("cliente", {
        header: "Cliente",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("formaPago", {
        header: "Forma Pago",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("total", {
        header: "Total",
        cell: ({ row }) =>
          formatAmount(getSignedTotal(row.original, row.original.total)),
        meta: { tdClassName: "text-right" },
      }),
      columnHelper.accessor("acuenta", {
        header: "A cuenta",
        cell: (info) => info.getValue(),
        meta: { tdClassName: "text-right" },
      }),
      columnHelper.accessor("saldo", {
        header: "Saldo",
        cell: (info) => info.getValue(),
        meta: { tdClassName: "text-right" },
      }),
      columnHelper.accessor("usuario", {
        header: "Usuario",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("estado", {
        header: "Estado",
        cell: (info) => {
          const value = String(info.getValue() ?? "").toUpperCase() || "-";
          const stateClass = isAnnulledStatus(value)
            ? "bg-red-100 text-red-700 border-red-200"
            : value === "PENDIENTE"
              ? "bg-amber-100 text-amber-700 border-amber-200"
              : value === "-"
                ? "bg-slate-100 text-slate-600 border-slate-200"
                : "bg-emerald-100 text-emerald-700 border-emerald-200";
          return (
            <span
              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${stateClass}`}
            >
              {value}
            </span>
          );
        },
      }),
      columnHelper.accessor("estadoSunat", {
        header: "Estado Sunat",
        cell: ({ row, getValue }) => {
          const value = isProformaVDocument(row.original.documento)
            ? "-"
            : String(getValue() ?? "").toUpperCase() || "-";
          const stateClass =
            value === "RECHAZADO" || isAnnulledStatus(value)
              ? "bg-red-100 text-red-700 border-red-200"
              : value === "PENDIENTE"
                ? "bg-amber-100 text-amber-700 border-amber-200"
                : value === "-"
                  ? "bg-slate-100 text-slate-600 border-slate-200"
                  : "bg-emerald-100 text-emerald-700 border-emerald-200";
          return (
            <span
              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${stateClass}`}
            >
              {value}
            </span>
          );
        },
      }),
    ],
    [navigate],
  );

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-3">
        <h1 className="text-2xl font-semibold text-[#0f2748]">Nota Pedidos</h1>
      </div>

      <DataTable
        columns={columns}
        data={notes}
        isLoading={loading}
        filterKeys={[
          "notaId",
          "cliente",
          "estado",
          "estadoSunat",
          "fecha",
          "documento",
        ]}
        toolbarLeading={
          <BackArrowButton className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors" />
        }
        renderFilters={
          <LocalizationProvider
            dateAdapter={AdapterDayjs}
            adapterLocale="es"
            localeText={
              esES.components.MuiLocalizationProvider.defaultProps.localeText
            }
          >
            <div className="flex w-full flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 xl:w-auto">
              <label className="flex min-w-[160px] flex-col gap-1 text-xs text-slate-600">
                Fecha Inicio
                <DatePicker
                  format="DD/MM/YY"
                  value={fechaInicio ? dayjs(fechaInicio) : null}
                  onChange={(value) => {
                    setFechaInicio(parsePickerDate(value));
                  }}
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
                  onOpen={() => {
                    endDateAcceptedRef.current = false;
                  }}
                  onChange={(value) => {
                    setFechaFin(parsePickerDate(value));
                  }}
                  onAccept={(value) => {
                    const nextValue = parsePickerDate(value);
                    endDateAcceptedRef.current = true;
                    setFechaFin(nextValue);
                    requestNotesByRange(fechaInicioRef.current, nextValue);
                  }}
                  onClose={() => {
                    if (endDateAcceptedRef.current) {
                      endDateAcceptedRef.current = false;
                      return;
                    }

                    const currentStart = fechaInicioRef.current;
                    const currentEnd = fechaFinRef.current;
                    const lastRange = lastFetchedRangeRef.current;
                    const mustFetch =
                      !lastRange ||
                      lastRange.from !== currentStart ||
                      lastRange.to !== currentEnd;

                    if (mustFetch) {
                      requestNotesByRange(currentStart, currentEnd);
                    }
                  }}
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

              <div className="relative group">
                <button
                  type="button"
                  onClick={handleSearch}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-white transition-colors hover:bg-slate-700"
                  aria-label="Buscar"
                >
                  <Search className="h-4 w-4" />
                </button>
                <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                  Buscar
                </span>
              </div>

              <div className="relative group">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white transition-colors hover:bg-emerald-700"
                  aria-label="Exportar a Excel"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                </button>
                <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
                  Excel
                </span>
              </div>
            </div>
          </LocalizationProvider>
        }
        footerContent={
          <div className="flex justify-end">
            <div className="grid w-full max-w-3xl grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-3">
              <div className="border-b border-slate-200 px-4 py-3 text-right sm:border-b-0 sm:border-r">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  SOLES - EFECTIVO
                </p>
                <p className="text-xl font-semibold text-slate-800">
                  {formatAmount(solesTotals.efectivo)}
                </p>
              </div>

              <div className="border-b border-slate-200 px-4 py-3 text-right sm:border-b-0 sm:border-r">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  SOLES - DEP/TAR/YAPE
                </p>
                <p className="text-xl font-semibold text-slate-800">
                  {formatAmount(solesTotals.depTarYape)}
                </p>
              </div>

              <div className="px-4 py-3 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  SOLES - TOTAL
                </p>
                <p className="text-xl font-semibold text-slate-900">
                  {formatAmount(solesTotals.total)}
                </p>
              </div>
            </div>
          </div>
        }
      />
    </div>
  );
};

export default OrderNotesList;
