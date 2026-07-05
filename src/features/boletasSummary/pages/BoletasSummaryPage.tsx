import DataTable from "@/components/DataTable";
import { BackArrowButton } from "@/components/common/BackArrowButton";
import { toast } from "@/shared/ui/toast";
import { useBoletasSummaryStore } from "@/store/boletasSummary/boletasSummary.store";
import type {
  BoletaSummaryDocument,
  BoletaSummarySentRecord,
  BoletaSummarySendBajaPayload,
  BoletaSummarySendPayload,
} from "@/types/boletasSummary";
import { Workbook } from "exceljs";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Search,
  SendHorizonal,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { calculateBoletaTotals, parseAmount } from "../boletasSummary.utils";

const columnHelper = createColumnHelper<BoletaSummaryDocument>();
const sentColumnHelper = createColumnHelper<BoletaSummarySentRecord>();

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const safeTrim = (value: unknown) => String(value ?? "").trim();

const pad2 = (value: number) => String(value).padStart(2, "0");

const toLocalIsoDate = (date: Date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const toDateOnly = (value: string) => {
  const raw = safeTrim(value);
  if (!raw) return "";
  const slashMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${yyyy}-${mm}-${dd}`;
  }
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return raw;
  return "";
};

const compactSerie = (serie: string) => {
  const compact = serie.replace(/0/g, "");
  return compact || serie;
};

const normalizeSerieNumero = (value: string) => {
  const raw = safeTrim(value);
  if (!raw) return raw;
  const [serieRaw = "", numeroRaw = ""] = raw.split("-");
  const serie = compactSerie(safeTrim(serieRaw));
  const numero = String(Number(safeTrim(numeroRaw))).replace(/^NaN$/, "");
  if (!serie && !numero) return raw;
  if (!numero) return serie || raw;
  return `${serie || serieRaw}-${numero}`;
};

const toFileSafePart = (value: string, fallback: string) => {
  const normalized = safeTrim(value).replace(/[^a-zA-Z0-9_-]+/g, "_");
  return normalized || fallback;
};

const isLikelyBase64 = (value: string) => {
  const compact = value.replace(/\s+/g, "");
  if (!compact || compact.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/=]+$/.test(compact);
};

const base64ToUint8Array = (value: string) => {
  const compact = value.replace(/\s+/g, "");
  const binary = window.atob(compact);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const isSuccessfulSummaryConsultation = (row: BoletaSummarySentRecord) => {
  const code = safeTrim(row.codigoSunat);
  if (code === "0" || code === "0000") return true;

  const message = safeTrim(row.mensaje).toUpperCase();
  const hasCdrArtifacts = Boolean(safeTrim(row.hashCdr) || safeTrim(row.cdr));
  return hasCdrArtifacts && message.includes("ACEPTADA");
};

const isCancelledSentSummary = (row: BoletaSummarySentRecord) => {
  const tipoDocumento = safeTrim(row.tipoDocumento).toUpperCase();
  if (tipoDocumento === "RA") return true;

  const estado = safeTrim(row.estado).toUpperCase();
  return estado === "B" || estado.includes("BAJA") || estado.includes("ANUL");
};

const EXCEL_MAX_CELL_LENGTH = 32767;

const toExcelSafeText = (value: unknown) => {
  const text = String(value ?? "");
  if (text.length <= EXCEL_MAX_CELL_LENGTH) return text;
  return `${text.slice(0, EXCEL_MAX_CELL_LENGTH - 3)}...`;
};

type BoletasSummarySession = {
  user?: {
    username?: string | null;
    displayName?: string | null;
    companyId?: string | number | null;
    companyRuc?: string | null;
    companyName?: string | null;
    entorno?: string | number | null;
    claveCertificado?: string | null;
    usuarioSol?: string | null;
    claveSol?: string | null;
    certificadoBase64?: string | null;
  };
  companiaId?: string | number | null;
  companiaRuc?: string | null;
  razonSocial?: string | null;
  loginPayload?: {
    usuario?: string | null;
    companiaId?: string | number | null;
    companiaRuc?: string | null;
    razonSocial?: string | null;
    entorno?: string | number | null;
    claveCertificado?: string | null;
    usuarioSol?: string | null;
    claveSol?: string | null;
    certificadoBase64?: string | null;
  };
} | null;

type SummaryTab = "pending" | "sent";
type SendBoletasStatus = "PENDIENTES" | "ANULADOS";

export default function BoletasSummaryPage() {
  const {
    documents,
    sentSummaries,
    fetchDocuments,
    fetchSentSummaries,
    loading,
    sentSummariesLoading,
    sequenceLoading,
    sendingSummary,
    fetchNextSummarySequence,
    sendSummary,
    sendSummaryBaja,
    consultSummary,
    consultSummaryBaja,
  } = useBoletasSummaryStore();
  const [activeTab, setActiveTab] = useState<SummaryTab>("pending");
  const [sendBoletasStatus, setSendBoletasStatus] =
    useState<SendBoletasStatus>("PENDIENTES");
  const [filteredRows, setFilteredRows] = useState<BoletaSummaryDocument[]>([]);
  const todayIso = useMemo(() => toLocalIsoDate(new Date()), []);
  const firstDayOfMonthIso = useMemo(
    () => `${todayIso.slice(0, 8)}01`,
    [todayIso],
  );
  const [sentDateFrom, setSentDateFrom] = useState(firstDayOfMonthIso);
  const [sentDateTo, setSentDateTo] = useState(todayIso);
  const [filteredSentRows, setFilteredSentRows] = useState<
    BoletaSummarySentRecord[]
  >([]);
  const [consultingSummaryId, setConsultingSummaryId] = useState<number | null>(
    null,
  );
  const lastAutoFetchedSentRangeRef = useRef<string>("");
  const isCancelledMode = sendBoletasStatus === "ANULADOS";

  useEffect(() => {
    void fetchDocuments({ includeCancelled: isCancelledMode });
  }, [fetchDocuments, isCancelledMode]);

  useEffect(() => {
    setFilteredRows(documents);
  }, [documents]);

  useEffect(() => {
    setFilteredSentRows(sentSummaries);
  }, [sentSummaries]);

  useEffect(() => {
    if (activeTab !== "sent") return;
    if (sentSummariesLoading) return;
    if (!sentDateFrom || !sentDateTo || sentDateFrom > sentDateTo) return;

    const currentRangeKey = `${sentDateFrom}|${sentDateTo}`;
    if (lastAutoFetchedSentRangeRef.current === currentRangeKey) return;

    lastAutoFetchedSentRangeRef.current = currentRangeKey;

    void fetchSentSummaries({
      fechaInicio: sentDateFrom,
      fechaFin: sentDateTo,
    });
  }, [
    activeTab,
    fetchSentSummaries,
    sentDateFrom,
    sentDateTo,
    sentSummariesLoading,
  ]);

  const totals = useMemo(
    () => calculateBoletaTotals(filteredRows),
    [filteredRows],
  );
  const sentTotals = useMemo(
    () =>
      filteredSentRows.reduce(
        (acc, row) => {
          acc.count += 1;
          acc.subTotal += parseAmount(row.subTotal);
          acc.igv += parseAmount(row.igv);
          acc.total += parseAmount(row.total);
          return acc;
        },
        { count: 0, subTotal: 0, igv: 0, total: 0 },
      ),
    [filteredSentRows],
  );
  const referenceDate = useMemo(
    () => documents[0]?.fechaEmision ?? "-",
    [documents],
  );

  const handleRefresh = useCallback(() => {
    void fetchDocuments({ includeCancelled: isCancelledMode });
  }, [fetchDocuments, isCancelledMode]);

  const requestSentSummaries = useCallback(() => {
    if (!sentDateFrom || !sentDateTo) {
      toast.error("Debes seleccionar fecha inicio y fecha fin.");
      return;
    }
    if (sentDateFrom > sentDateTo) {
      toast.error("La fecha inicio no puede ser mayor que la fecha fin.");
      return;
    }

    void fetchSentSummaries({
      fechaInicio: sentDateFrom,
      fechaFin: sentDateTo,
    });
  }, [fetchSentSummaries, sentDateFrom, sentDateTo]);

  const handleRefreshSentSummaries = useCallback(() => {
    requestSentSummaries();
  }, [requestSentSummaries]);

  const handleSearchSentSummaries = useCallback(() => {
    requestSentSummaries();
  }, [requestSentSummaries]);

  const handleSendSummary = useCallback(async () => {
    if (!filteredRows.length) {
      toast.info(
        isCancelledMode
          ? "No hay boletas anuladas para enviar baja."
          : "No hay boletas pendientes para enviar.",
      );
      return;
    }

    const nextSequence = await fetchNextSummarySequence();
    if (!nextSequence) {
      toast.error("No se pudo obtener la secuencia del resumen.");
      return;
    }

    let parsedSession: BoletasSummarySession = null;
    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("sgo.auth.session");
        parsedSession = raw ? (JSON.parse(raw) as BoletasSummarySession) : null;
      } catch {
        parsedSession = null;
      }
    }

    const user = parsedSession?.user ?? {};
    const loginPayload = parsedSession?.loginPayload ?? {};
    const currentUser = safeTrim(
      user.displayName ?? loginPayload.usuario ?? user.username,
    );
    const companyId = Number(
      user.companyId ??
        parsedSession?.companiaId ??
        loginPayload.companiaId ??
        (typeof window !== "undefined"
          ? window.localStorage.getItem("companiaId")
          : 1) ??
        1,
    );
    const now = new Date();
    const todayIso = toLocalIsoDate(now);
    const serieResumen = todayIso.replaceAll("-", "");
    const referenceDateIso =
      toDateOnly(referenceDate) ||
      toDateOnly(filteredRows[0]?.fechaEmision ?? "") ||
      todayIso;

    const firstSerieNumero = safeTrim(filteredRows[0]?.serieNumero);
    const lastSerieNumero = safeTrim(
      filteredRows[filteredRows.length - 1]?.serieNumero,
    );
    const rangoNumeros =
      firstSerieNumero && lastSerieNumero
        ? `${normalizeSerieNumero(firstSerieNumero)} al ${normalizeSerieNumero(lastSerieNumero)}`
        : "";

    const detalleResumen = filteredRows.map((row, index) => {
      const dni = safeTrim(row.clienteDni);
      return {
        item: index + 1,
        tipoComprobante: "03",
        nroComprobante: safeTrim(row.serieNumero),
        tipoDocumento: "1",
        nroDocumento: dni || "00000000",
        tipoComprobanteRef: "",
        nroComprobanteRef: "",
        statu: "1",
        codMoneda: "PEN",
        total: Number(parseAmount(row.total).toFixed(2)),
        icbper: Number(parseAmount(row.icbper).toFixed(2)),
        gravada: Number(parseAmount(row.subTotal).toFixed(2)),
        isc: 0,
        igv: Number(parseAmount(row.igv).toFixed(2)),
        otros: 0,
        cargoXAsignacion: 1,
        montoCargoXAsig: 0,
        exonerado: 0,
        inafecto: 0,
        exportacion: 0,
        gratuitas: 0,
        docuId: row.docuId,
        notaId: row.notaId,
      };
    });

    const detalleBaja = filteredRows.map((row, index) => ({
      item: index + 1,
      tipoComprobante: "03",
      nroComprobante: safeTrim(row.serieNumero),
      descripcion: "ANULACION DE DOCUMENTO",
      docuId: row.docuId,
      notaId: row.notaId,
    }));

    const tipoProcesoRaw = Number(user.entorno ?? loginPayload.entorno ?? 3);
    const tipoProceso =
      Number.isFinite(tipoProcesoRaw) && tipoProcesoRaw > 0
        ? Math.floor(tipoProcesoRaw)
        : 3;

    const payloadBase = {
      NRO_DOCUMENTO_EMPRESA: safeTrim(
        user.companyRuc ??
          parsedSession?.companiaRuc ??
          loginPayload.companiaRuc,
      ),
      RAZON_SOCIAL: safeTrim(
        user.companyName ??
          parsedSession?.razonSocial ??
          loginPayload.razonSocial,
      ),
      USUARIO: currentUser || "SISTEMA",
      Usuario: currentUser || "SISTEMA",
      usuario: currentUser || "SISTEMA",
      USUARIO_REGISTRO: currentUser || "SISTEMA",
      TIPO_DOCUMENTO: "6",
      CODIGO: isCancelledMode ? "RA" : "RC",
      SERIE: serieResumen,
      SECUENCIA: String(nextSequence),
      FECHA_REFERENCIA: referenceDateIso,
      FECHA_DOCUMENTO: todayIso,
      TIPO_PROCESO: tipoProceso,
      CONTRA_FIRMA: safeTrim(
        user.claveCertificado ?? loginPayload.claveCertificado,
      ),
      USUARIO_SOL_EMPRESA: safeTrim(user.usuarioSol ?? loginPayload.usuarioSol),
      PASS_SOL_EMPRESA: safeTrim(user.claveSol ?? loginPayload.claveSol),
      RUTA_PFX: safeTrim(
        user.certificadoBase64 ?? loginPayload.certificadoBase64,
      ),
      COMPANIA_ID: Number.isFinite(companyId) && companyId > 0 ? companyId : 1,
    };

    const response = isCancelledMode
      ? await sendSummaryBaja({
          ...payloadBase,
          CODIGO: "RA",
          detalle: detalleBaja,
        } as BoletaSummarySendBajaPayload)
      : await sendSummary({
          ...payloadBase,
          CODIGO: "RC",
          detalle: detalleResumen,
          RANGO_NUMEROS: rangoNumeros,
          SUBTOTAL: Number(totals.subTotal.toFixed(2)),
          IGV: Number(totals.igv.toFixed(2)),
          ICBPER: Number(totals.icbper.toFixed(2)),
          TOTAL: Number(totals.total.toFixed(2)),
        } as BoletaSummarySendPayload);
    const hasAcceptedFlag = response.aceptado !== null;
    const isSuccess = hasAcceptedFlag
      ? response.aceptado === true
      : response.ok || response.flg_rta === "1";
    const httpStatus = Number(response.http_status ?? 0);
    const code = safeTrim(response.cod_sunat);
    const message = safeTrim(response.mensaje);
    const sunatMessage = safeTrim(response.msj_sunat);
    const registroBdMensaje = safeTrim(
      response.registro_bd?.mensaje || response.registro_bd?.resultado,
    );
    const detailParts = [message, code, sunatMessage, registroBdMensaje].filter(
      Boolean,
    );
    const detailText = detailParts.join(" - ");

    if (isSuccess) {
      const ticket = safeTrim(response.ticket || response.msj_sunat);
      const successPrefix = isCancelledMode ? "Baja enviada" : "Resumen enviado";
      const sentRangeFrom = `${todayIso.slice(0, 8)}01`;
      const sentRangeTo = todayIso;
      if (ticket && code) {
        toast.success(`${successPrefix}. Ticket: ${ticket}. Código: ${code}`);
      } else if (ticket) {
        toast.success(`${successPrefix}. Ticket: ${ticket}`);
      } else if (code) {
        toast.success(`${successPrefix}. Código SUNAT: ${code}`);
      } else {
        toast.success(
          safeTrim(response.mensaje) ||
            (isCancelledMode
              ? "Baja enviada correctamente."
              : "Resumen enviado correctamente."),
        );
      }

      if (response.registro_bd && !response.registro_bd.ok) {
        toast.warning(
          registroBdMensaje ||
            "SUNAT aceptó el resumen, pero no se confirmó el registro en BD.",
        );
      }

      setSentDateFrom(sentRangeFrom);
      setSentDateTo(sentRangeTo);
      setActiveTab("sent");
      void fetchDocuments({ includeCancelled: isCancelledMode });
      void fetchSentSummaries({
        fechaInicio: sentRangeFrom,
        fechaFin: sentRangeTo,
      });
      return;
    }

    if (httpStatus >= 500) {
      toast.error(detailText || "Error técnico backend al enviar resumen.");
      return;
    }

    if (detailText) {
      toast.error(detailText);
      return;
    }

    toast.error(
      isCancelledMode ? "No se pudo enviar la baja." : "No se pudo enviar el resumen.",
    );
  }, [
    fetchDocuments,
    fetchNextSummarySequence,
    filteredRows,
    isCancelledMode,
    referenceDate,
    sendSummaryBaja,
    sendSummary,
    fetchSentSummaries,
    totals.icbper,
    totals.igv,
    totals.subTotal,
    totals.total,
  ]);

  const handleExportSentExcel = useCallback(async () => {
    if (!filteredSentRows.length) {
      toast.info("No hay resúmenes enviados para exportar en Excel.");
      return;
    }

    try {
      const workbook = new Workbook();
      workbook.creator = "SGO";
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet("Resúmenes", {
        views: [{ state: "frozen", ySplit: 1 }],
      });

      worksheet.columns = [
        { header: "Fecha Emision", key: "fechaEmision", width: 14 },
        { header: "Fecha Envio", key: "fechaEnvio", width: 20 },
        { header: "Tipo", key: "tipoResumen", width: 12 },
        { header: "Serie", key: "serie", width: 16 },
        { header: "Rango Numeros", key: "rangoNumeros", width: 22 },
        { header: "SubTotal", key: "subTotal", width: 14 },
        { header: "IGV", key: "igv", width: 12 },
        { header: "Total", key: "total", width: 14 },
        { header: "Ticket", key: "ticket", width: 22 },
        { header: "Codigo SUNAT", key: "codigoSunat", width: 13 },
        { header: "HASH CDR", key: "hashCdr", width: 30 },
        { header: "Mensaje", key: "mensaje", width: 42 },
        { header: "Usuario", key: "usuario", width: 20 },
        { header: "Estado", key: "estado", width: 10 },
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

      filteredSentRows.forEach((row, index) => {
        const excelRow = worksheet.addRow({
          fechaEmision: toExcelSafeText(row.fechaEmision),
          fechaEnvio: toExcelSafeText(row.fechaEnvio),
          tipoResumen: isCancelledSentSummary(row) ? "ANULADO" : "EMITIDO",
          serie: toExcelSafeText(row.serie),
          rangoNumeros: toExcelSafeText(row.rangoNumeros),
          subTotal: Number(parseAmount(row.subTotal).toFixed(2)),
          igv: Number(parseAmount(row.igv).toFixed(2)),
          total: Number(parseAmount(row.total).toFixed(2)),
          ticket: toExcelSafeText(row.ticket),
          codigoSunat: toExcelSafeText(row.codigoSunat),
          hashCdr: toExcelSafeText(row.hashCdr),
          mensaje: toExcelSafeText(row.mensaje),
          usuario: toExcelSafeText(row.usuario),
          estado: toExcelSafeText(row.estado),
        });

        excelRow.eachCell((cell, colNumber) => {
          const isAmountColumn = colNumber >= 6 && colNumber <= 8;
          const isSunatCodeColumn = colNumber === 10;
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
          cell.alignment = {
            vertical: "top",
            horizontal: isAmountColumn
              ? "right"
              : isSunatCodeColumn
                ? "center"
                : "left",
            wrapText: colNumber === 10 || colNumber === 11,
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

      const subtotalSum = filteredSentRows.reduce(
        (acc, row) => acc + parseAmount(row.subTotal),
        0,
      );
      const igvSum = filteredSentRows.reduce(
        (acc, row) => acc + parseAmount(row.igv),
        0,
      );
      const totalSum = filteredSentRows.reduce(
        (acc, row) => acc + parseAmount(row.total),
        0,
      );

      worksheet.addRow({});

      const totalsRow = worksheet.addRow({
        fechaEmision: `Items: ${filteredSentRows.length}`,
        serie: "Totales S/",
        subTotal: Number(subtotalSum.toFixed(2)),
        igv: Number(igvSum.toFixed(2)),
        total: Number(totalSum.toFixed(2)),
      });

      totalsRow.eachCell((cell, colNumber) => {
        const isAmountColumn = colNumber >= 5 && colNumber <= 7;
        const isLabelColumn = colNumber === 1 || colNumber === 3;
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

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `resumenes-enviados_${sentDateFrom}_${sentDateTo}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
      toast.success("Excel generado correctamente.");
    } catch (error) {
      console.error("Error al exportar Excel de resúmenes enviados", error);
      toast.error("No se pudo exportar el archivo Excel.");
    }
  }, [filteredSentRows, sentDateFrom, sentDateTo]);

  const downloadCdr = useCallback(
    (cdrValue: string, row: BoletaSummarySentRecord) => {
      const cdr = safeTrim(cdrValue);
      if (!cdr) {
        toast.info("Este registro no tiene CDR para descargar.");
        return;
      }

      const safeSerie = toFileSafePart(row.serie, "sin-serie");
      const safeTicket = toFileSafePart(
        row.ticket,
        `resumen-${row.resumenId || row.id}`,
      );

      let blob: Blob;
      let fileName: string;

      if (cdr.startsWith("<")) {
        blob = new Blob([cdr], { type: "application/xml;charset=utf-8" });
        fileName = `cdr_${safeSerie}_${safeTicket}.xml`;
      } else if (isLikelyBase64(cdr)) {
        try {
          const bytes = base64ToUint8Array(cdr);
          blob = new Blob([bytes], { type: "application/zip" });
          fileName = `cdr_${safeSerie}_${safeTicket}.zip`;
        } catch {
          blob = new Blob([cdr], { type: "text/plain;charset=utf-8" });
          fileName = `cdr_${safeSerie}_${safeTicket}.txt`;
        }
      } else {
        blob = new Blob([cdr], { type: "text/plain;charset=utf-8" });
        fileName = `cdr_${safeSerie}_${safeTicket}.txt`;
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    },
    [],
  );

  const handleConsultSummary = useCallback(
    async (row: BoletaSummarySentRecord) => {
      if (isSuccessfulSummaryConsultation(row)) {
        toast.info("Este resumen ya fue consultado exitosamente.");
        return;
      }

      const resumenId = Number(row.resumenId || row.id);
      const ticket = safeTrim(row.ticket);
      if (!resumenId) {
        toast.error("No se encontró el identificador del resumen.");
        return;
      }
      if (!ticket) {
        toast.error("El resumen no tiene ticket para consultar.");
        return;
      }

      let parsedSession: BoletasSummarySession = null;
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem("sgo.auth.session");
          parsedSession = raw
            ? (JSON.parse(raw) as BoletasSummarySession)
            : null;
        } catch {
          parsedSession = null;
        }
      }

      const user = parsedSession?.user ?? {};
      const loginPayload = parsedSession?.loginPayload ?? {};
      const ruc = safeTrim(
        row.ruc ??
          user.companyRuc ??
          parsedSession?.companiaRuc ??
          loginPayload.companiaRuc,
      );
      const usuarioSol = safeTrim(
        row.usuarioSolEmpresa ?? user.usuarioSol ?? loginPayload.usuarioSol,
      );
      const passSol = safeTrim(
        row.passSolEmpresa ?? user.claveSol ?? loginPayload.claveSol,
      );
      const secuencia = safeTrim(row.secuencia ?? row.serie);
      const isCancelled = isCancelledSentSummary(row);
      const estado = isCancelled ? "B" : "P";
      const tipoDocumento = safeTrim(
        row.tipoDocumento || (isCancelled ? "RA" : "RC"),
      );

      const tipoProcesoRaw = Number(
        row.tipoProceso ?? user.entorno ?? loginPayload.entorno ?? 3,
      );
      const tipoProceso =
        Number.isFinite(tipoProcesoRaw) && tipoProcesoRaw > 0
          ? Math.floor(tipoProcesoRaw)
          : 3;
      const intentosRaw = Number(row.intentos ?? 0);
      const intentos =
        Number.isFinite(intentosRaw) && intentosRaw >= 0
          ? Math.floor(intentosRaw)
          : 0;

      if (!ruc) {
        toast.error("No se encontró RUC de empresa para consultar.");
        return;
      }
      if (!usuarioSol || !passSol) {
        toast.error("Faltan credenciales SOL para consultar el ticket.");
        return;
      }
      if (!secuencia) {
        toast.error("No se encontró la secuencia del resumen.");
        return;
      }

      setConsultingSummaryId(resumenId);
      try {
        const payload = {
          RESUMEN_ID: resumenId,
          TICKET: ticket,
          CODIGO_SUNAT: "",
          MENSAJE_SUNAT: "",
          ESTADO: estado,
          SECUENCIA: secuencia,
          RUC: ruc,
          USUARIO_SOL_EMPRESA: usuarioSol,
          PASS_SOL_EMPRESA: passSol,
          TIPO_DOCUMENTO: tipoDocumento,
          TIPO_PROCESO: tipoProceso,
          INTENTOS: intentos,
        };
        const response = isCancelled
          ? await consultSummaryBaja(payload)
          : await consultSummary(payload);

        const action = safeTrim(response.accion).toLowerCase();
        const code = safeTrim(response.cod_sunat);
        const message = safeTrim(response.mensaje || response.msj_sunat);

        if (response.ok) {
          if (action === "reintentar") {
            const nextTry =
              response.intentos !== null ? response.intentos : intentos + 1;
            toast.warning(message || `Intente nuevamente ${nextTry} de 3`);
          } else if (action === "retornar_boletas" || response.requiere_reenvio) {
            toast.warning(
              message ||
                "Ticket inválido. Se retornaron comprobantes a pendiente para reenviar.",
            );
          } else if (code === "0" || action === "consultado_correctamente") {
            toast.success(
              message ||
                safeTrim(response.msj_sunat) ||
                (isCancelled
                  ? "Se consultó correctamente la baja."
                  : "Se consultó correctamente el ticket."),
            );
          } else {
            toast.info(
              message ||
                (isCancelled
                  ? "Consulta de baja realizada."
                  : "Consulta realizada."),
            );
          }

          void fetchSentSummaries({
            fechaInicio: sentDateFrom,
            fechaFin: sentDateTo,
          });
          return;
        }

        if (code && message) {
          toast.error(`${code} - ${message}`);
          return;
        }
        toast.error(
          message ||
            (isCancelled
              ? "No se pudo consultar la baja."
              : "No se pudo consultar el resumen."),
        );
      } finally {
        setConsultingSummaryId(null);
      }
    },
    [
      consultSummary,
      consultSummaryBaja,
      fetchSentSummaries,
      sentDateFrom,
      sentDateTo,
    ],
  );

  const columns = useMemo(
    () => [
      columnHelper.accessor("notaId", {
        header: "NotaId",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("fechaEmision", {
        header: "FechaEmision",
        cell: (info) => info.getValue(),
      }),
      columnHelper.display({
        id: "numero",
        header: "Numero",
        cell: ({ row }) => row.original.serieNumero,
      }),
      columnHelper.accessor("cliente", {
        header: "RazonSocial",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("clienteDni", {
        header: "DNI",
        cell: (info) => info.getValue(),
      }),
      columnHelper.accessor("subTotal", {
        header: "Sub Total",
        cell: (info) => info.getValue(),
        meta: { tdClassName: "text-right" },
      }),
      columnHelper.accessor("igv", {
        header: "IGV",
        cell: (info) => info.getValue(),
        meta: { tdClassName: "text-right" },
      }),

      columnHelper.accessor("total", {
        header: "Total",
        cell: (info) => info.getValue(),
        meta: { tdClassName: "text-right" },
      }),
      columnHelper.accessor("usuario", {
        header: "Usuario",
        cell: (info) => info.getValue(),
        meta: { tdClassName: "text-right" },
      }),
      columnHelper.accessor("estadoSunat", {
        header: "Estado Sunat",
        cell: (info) => {
          const value = String(info.getValue() ?? "").toUpperCase();
          const isPending = value === "PENDIENTE";
          const stateClass = isPending
            ? "bg-amber-100 text-amber-700 border-amber-200"
            : "bg-emerald-100 text-emerald-700 border-emerald-200";

          return (
            <span
              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${stateClass}`}
            >
              {value || "-"}
            </span>
          );
        },
      }),
    ],
    [],
  );

  const sentColumns = useMemo(
    () => [
      sentColumnHelper.display({
        id: "consultar",
        header: "Consultar",
        cell: ({ row }) => {
          const resumenId = Number(row.original.resumenId || row.original.id);
          const isConsulting = consultingSummaryId === resumenId;
          const alreadySuccessful = isSuccessfulSummaryConsultation(
            row.original,
          );

          return (
            <button
              type="button"
              className="inline-flex min-w-[96px] items-center justify-center gap-1 text-sm font-medium text-blue-600 disabled:cursor-not-allowed disabled:text-slate-400"
              onClick={() => void handleConsultSummary(row.original)}
              disabled={isConsulting || alreadySuccessful}
            >
              {isConsulting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              {isConsulting
                ? "Consultando..."
                : alreadySuccessful
                  ? "Consultado"
                  : "Consultar"}
            </button>
          );
        },
      }),
      sentColumnHelper.accessor("fechaEmision", {
        header: "Fecha Emisión",
        cell: (info) => info.getValue(),
      }),
      sentColumnHelper.accessor("fechaEnvio", {
        header: "Fecha Envío",
        cell: (info) => info.getValue(),
      }),
      sentColumnHelper.display({
        id: "tipoResumen",
        header: "Tipo",
        cell: ({ row }) => {
          const isCancelled = isCancelledSentSummary(row.original);
          const label = isCancelled ? "ANULADO" : "EMITIDO";
          const badgeClass = isCancelled
            ? "bg-rose-100 text-rose-700 border-rose-200"
            : "bg-blue-100 text-blue-700 border-blue-200";

          return (
            <span
              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${badgeClass}`}
            >
              {label}
            </span>
          );
        },
      }),
      sentColumnHelper.accessor("serie", {
        header: "Serie",
        cell: (info) => info.getValue(),
      }),
      sentColumnHelper.accessor("rangoNumeros", {
        header: "Rango Números",
        cell: (info) => info.getValue(),
      }),
      sentColumnHelper.accessor("subTotal", {
        header: "Sub Total",
        cell: (info) => info.getValue(),
        meta: { tdClassName: "text-right", align: "right" },
      }),
      sentColumnHelper.accessor("igv", {
        header: "IGV",
        cell: (info) => info.getValue(),
        meta: { tdClassName: "text-right", align: "right" },
      }),
      sentColumnHelper.accessor("total", {
        header: "Total",
        cell: (info) => info.getValue(),
        meta: { tdClassName: "text-right", align: "right" },
      }),
      sentColumnHelper.accessor("ticket", {
        header: "Ticket",
        cell: (info) => info.getValue() || "-",
      }),
      sentColumnHelper.accessor("codigoSunat", {
        header: "CD Sunat",
        cell: (info) => {
          const value = safeTrim(info.getValue());
          if (!value) return "-";

          const statusClass =
            value === "0"
              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
              : "bg-amber-100 text-amber-700 border-amber-200";

          return (
            <span
              className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClass}`}
            >
              {value}
            </span>
          );
        },
      }),

      sentColumnHelper.accessor("mensaje", {
        header: "Mensaje",
        cell: (info) => {
          const value = safeTrim(info.getValue());
          if (!value) return "-";

          return (
            <span className="inline-block max-w-[320px] truncate" title={value}>
              {value}
            </span>
          );
        },
      }),
      sentColumnHelper.accessor("usuario", {
        header: "Usuario",
        cell: (info) => info.getValue() || "-",
      }),

      sentColumnHelper.accessor("cdr", {
        header: "CDR",
        cell: (info) => {
          const value = safeTrim(info.getValue());
          if (!value) return "-";

          return (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
              onClick={() => downloadCdr(value, info.row.original)}
            >
              <Download className="h-3.5 w-3.5" />
              Descargar
            </button>
          );
        },
      }),
    ],
    [consultingSummaryId, downloadCdr, handleConsultSummary],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <BackArrowButton />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === "pending"
                ? "bg-[#B23636]/10 text-[#B23636]"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            onClick={() => setActiveTab("pending")}
          >
            Resumen de boletas
          </button>
          <button
            type="button"
            className={`inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
              activeTab === "sent"
                ? "bg-[#B23636]/10 text-[#B23636]"
                : "text-slate-600 hover:bg-slate-100"
            }`}
            onClick={() => setActiveTab("sent")}
          >
            Resúmenes enviados
          </button>
        </div>
      </div>

      {activeTab === "pending" ? (
        loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-center gap-3 py-12 text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Cargando boletas...</span>
            </div>
          </div>
        ) : (
          <DataTable
            data={documents}
            columns={
              columns as unknown as ColumnDef<BoletaSummaryDocument, unknown>[]
            }
            filterKeys={[
              "notaId",
              "serieNumero",
              "cliente",
              "clienteDni",
              "usuario",
            ]}
            searchPlaceholder="Buscar..."
            onFilteredDataChange={setFilteredRows}
            toolbarAction={
              <div className="w-full lg:w-auto">
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="text-sm font-medium text-slate-700">
                    Enviar Boletas:
                  </span>
                  <select
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none sm:w-auto sm:min-w-[160px]"
                    value={sendBoletasStatus}
                    onChange={(event) =>
                      setSendBoletasStatus(
                        event.target.value as SendBoletasStatus,
                      )
                    }
                  >
                    <option value="PENDIENTES">PENDIENTES</option>
                    <option value="ANULADOS">ANULADOS</option>
                  </select>
                  <button
                    type="button"
                    className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium sm:w-auto disabled:cursor-not-allowed disabled:opacity-60 ${
                      sendBoletasStatus === "PENDIENTES"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-[#B23636]/25 bg-[#B23636]/10 text-[#B23636] hover:bg-[#B23636]/15"
                    }`}
                    onClick={handleSendSummary}
                    disabled={sequenceLoading || sendingSummary}
                  >
                    {sequenceLoading || sendingSummary ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <SendHorizonal className="h-4 w-4" />
                    )}
                    {sequenceLoading
                      ? "Obteniendo..."
                      : sendingSummary
                        ? "Enviando..."
                        : "Enviar Resumen"}
                  </button>
                </div>
              </div>
            }
            renderFilters={
              <div className="w-full">
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
                    onClick={handleRefresh}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Actualizar
                  </button>
                </div>
              </div>
            }
            footerContent={
              <div className="flex w-full justify-end">
                <div className="grid w-full grid-cols-2 gap-2 text-sm sm:w-auto sm:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:min-w-[160px]">
                    <p className="text-xs text-slate-500">Cant.</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {totals.count}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:min-w-[160px]">
                    <p className="text-xs text-slate-500">SubTotal S/</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {formatCurrency(totals.subTotal)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:min-w-[160px]">
                    <p className="text-xs text-slate-500">IGV S/</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {formatCurrency(totals.igv)}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#B23636]/25 bg-[#B23636]/10 px-3 py-2 sm:min-w-[160px]">
                    <p className="text-xs text-[#B23636]/80">Total S/</p>
                    <p className="text-lg font-semibold text-[#B23636]">
                      {formatCurrency(totals.total)}
                    </p>
                  </div>
                </div>
              </div>
            }
          />
        )
      ) : (
        <DataTable
          data={sentSummaries}
          columns={
            sentColumns as unknown as ColumnDef<
              BoletaSummarySentRecord,
              unknown
            >[]
          }
          isLoading={sentSummariesLoading}
          emptyMessage="No hay resúmenes enviados en el rango seleccionado."
          filterKeys={[
            "fechaEmision",
            "fechaEnvio",
            "serie",
            "rangoNumeros",
            "ticket",
            "codigoSunat",
            "mensaje",
            "usuario",
          ]}
          searchPlaceholder="Buscar en resúmenes enviados..."
          onFilteredDataChange={setFilteredSentRows}
          renderFilters={
            <div className="w-full">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-end">
                <label className="flex min-w-[150px] flex-col gap-1 text-xs text-slate-600">
                  Fecha Inicio
                  <input
                    type="date"
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
                    value={sentDateFrom}
                    onChange={(event) => setSentDateFrom(event.target.value)}
                  />
                </label>
                <label className="flex min-w-[150px] flex-col gap-1 text-xs text-slate-600">
                  Fecha Fin
                  <input
                    type="date"
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none"
                    value={sentDateTo}
                    onChange={(event) => setSentDateTo(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={handleSearchSentSummaries}
                >
                  <Search className="h-4 w-4" />
                  Buscar
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={handleRefreshSentSummaries}
                >
                  <RefreshCw className="h-4 w-4" />
                  Actualizar
                </button>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
                  onClick={() => void handleExportSentExcel()}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Exportar Excel
                </button>
              </div>
            </div>
          }
          footerContent={
            <div className="flex w-full justify-end">
              <div className="grid w-full grid-cols-2 gap-2 text-sm lg:w-auto lg:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 lg:min-w-[140px]">
                  <p className="text-xs text-slate-500">Cant.</p>
                  <p className="text-lg font-semibold text-slate-800">
                    {sentTotals.count}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 lg:min-w-[140px]">
                  <p className="text-xs text-slate-500">SubTotal S/</p>
                  <p className="text-lg font-semibold text-slate-800">
                    {formatCurrency(sentTotals.subTotal)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 lg:min-w-[140px]">
                  <p className="text-xs text-slate-500">IGV S/</p>
                  <p className="text-lg font-semibold text-slate-800">
                    {formatCurrency(sentTotals.igv)}
                  </p>
                </div>
                <div className="rounded-lg border border-[#B23636]/25 bg-[#B23636]/10 px-3 py-2 lg:min-w-[140px]">
                  <p className="text-xs text-[#B23636]/80">Total S/</p>
                  <p className="text-lg font-semibold text-[#B23636]">
                    {formatCurrency(sentTotals.total)}
                  </p>
                </div>
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}
