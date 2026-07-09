import { useCallback, useEffect, useMemo, useRef } from "react";
import { UserPlus } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { HookFormAutocomplete } from "@/components/forms/HookFormAutocomplete";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import type { Client } from "@/types/customer";

type SaleCaptureFormValues = {
  concept: "MERCADERIA" | "SERVICIO";
  docTypeCode: "03" | "01" | "101";
  correlativeDisplay: string;
  condition: "ALCONTADO" | "CREDITO";
  delivery: "INMEDIATA" | "POR ENTREGAR";
  emissionDate: string;
  paymentMethod:
    | "(SELECCIONE)"
    | "EFECTIVO"
    | "DEPOSITO"
    | "TARJETA"
    | "YAPE"
    | "EFECTIVO/DEPOSITO"
    | "TARJETA/EFECTIVO"
    | "YAPE/EFECTIVO"
    | "YAPE/DEPOSITO"
    | "TARJETA/DEPOSITO"
    | "-";
  bankEntity: string;
  operationNumber: string;
  customerName: string;
  customerEmail: string;
  customerDoc: string;
  address: string;
  memberCode: string;
  transactionNumber: string;
};

type ClientOption = {
  client: Client;
  label: string;
  doc: string;
  code: string;
};

interface SaleCaptureFormFieldsProps {
  clientOptions: ClientOption[];
  disabled?: boolean;
  summary?: {
    pvs: number;
    saleTotal: number;
    monthTotal: number;
  };
  correlative?: string;
  onClientSelected?: (client: Client | null) => void;
  onCreateClient?: () => void;
  onSearchClients?: (search: string) => void;
}

const safeTrim = (value: unknown) => String(value ?? "").trim();
const getClientCode = (client: Client | null | undefined) =>
  safeTrim(client?.clienteCodigo);
const formatNumber = (value: number) =>
  Number(value || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const todayValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

// Small presentational helper: keeps section headings visually consistent
// without introducing any new state or logic.
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </p>
  );
}

export function SaleCaptureFormFields({
  clientOptions,
  disabled = false,
  summary,
  correlative,
  onClientSelected,
  onCreateClient,
  onSearchClients,
}: SaleCaptureFormFieldsProps) {
  const { control, setValue } = useFormContext<SaleCaptureFormValues>();
  const values = useWatch({
    control,
  }) as SaleCaptureFormValues;
  const paymentMethod = values.paymentMethod ?? "EFECTIVO";
  const paymentNeedsOperation = !["(SELECCIONE)", "EFECTIVO", "-"].includes(
    paymentMethod,
  );
  const docTypeCode = values.docTypeCode ?? "03";
  const correlativeDisplay = values.correlativeDisplay ?? "";
  const emissionDate = values.emissionDate ?? "";
  const serie = docTypeCode === "01" ? "FA01" : "BA01";
  const currentCorrelative =
    correlative ?? (docTypeCode === "101" ? "" : `${serie}-00000000`);
  const searchTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (correlativeDisplay !== currentCorrelative) {
      setValue("correlativeDisplay", currentCorrelative);
    }
    if (!emissionDate) setValue("emissionDate", todayValue());
  }, [correlativeDisplay, currentCorrelative, emissionDate, setValue]);

  useEffect(
    () => () => {
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    },
    [],
  );

  const queueClientSearch = useCallback(
    (value: string) => {
      const search = safeTrim(value);
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
      if (search.length < 2) return;
      searchTimerRef.current = window.setTimeout(() => {
        onSearchClients?.(search);
      }, 300);
    },
    [onSearchClients],
  );

  const customerNameOptions = useMemo(() => {
    const baseOptions = clientOptions
      .filter((opt) => safeTrim(opt.label).toUpperCase() !== "VARIOS")
      .map((opt) => ({
        label: opt.label,
        value: opt.label,
        nombreRazon: opt.label,
        dni: opt.client.dni ?? "",
        ruc: opt.client.ruc ?? "",
        code: opt.code,
        id: opt.client.id,
        client: opt.client,
      }));

    return docTypeCode === "01"
      ? baseOptions.filter((opt) => safeTrim(opt.ruc))
      : baseOptions;
  }, [clientOptions, docTypeCode]);

  const customerDocumentOptions = useMemo(() => {
    const source =
      docTypeCode === "01"
        ? clientOptions.filter((opt) => safeTrim(opt.client.ruc))
        : clientOptions.filter((opt) => safeTrim(opt.client.dni));

    return source.map((opt) => {
      const value =
        docTypeCode === "01"
          ? safeTrim(opt.client.ruc)
          : safeTrim(opt.client.dni);
      return {
        label: value,
        value,
        ruc: safeTrim(opt.client.ruc),
        dni: safeTrim(opt.client.dni),
        code: opt.code,
        nombreRazon: opt.label,
        id: opt.client.id,
        client: opt.client,
      };
    });
  }, [clientOptions, docTypeCode]);

  const customerCodeOptions = useMemo(
    () =>
      clientOptions
        .filter((opt) => safeTrim(opt.code))
        .map((opt) => ({
          label: opt.code,
          value: opt.code,
          code: opt.code,
          nombreRazon: opt.label,
          doc: opt.doc,
          id: opt.client.id,
          client: opt.client,
        })),
    [clientOptions],
  );

  const filterByClientData = <
    T extends { label: string } & Record<string, unknown>,
  >(
    options: T[],
    inputValue: string,
  ) => {
    const search = safeTrim(inputValue).toLowerCase();
    if (!search) return options;
    return options.filter((opt) =>
      [opt.label, opt.nombreRazon, opt.doc, opt.code, opt.dni, opt.ruc].some(
        (value) => safeTrim(value).toLowerCase().includes(search),
      ),
    );
  };

  const applyClientSelection = (client: Client | null) => {
    if (!client) {
      onClientSelected?.(null);
      return;
    }

    setValue("customerName", client.nombreRazon ?? "", {
      shouldDirty: true,
    });
    setValue("customerEmail", client.email ?? "", {
      shouldDirty: true,
    });
    setValue("customerDoc", client.ruc || client.dni || "", {
      shouldDirty: true,
    });
    setValue("memberCode", getClientCode(client), {
      shouldDirty: true,
    });
    setValue(
      "address",
      client.direccionFiscal || client.direccionDespacho || "",
      { shouldDirty: true },
    );
    setValue("docTypeCode", client.ruc ? "01" : "03", {
      shouldDirty: true,
    });
    onClientSelected?.(client);
  };

  const handleCustomerInputBlur = ({ inputValue }: { inputValue: string }) => {
    const label = safeTrim(inputValue);
    if (!label) return;

    const match =
      clientOptions.find((opt) => opt.label === label || opt.code === label)
        ?.client ?? null;
    applyClientSelection(match);
  };

  const handleCustomerCodeBlur = ({ inputValue }: { inputValue: string }) => {
    const code = safeTrim(inputValue);
    if (!code) return;
    const match =
      clientOptions.find((opt) => opt.code === code)?.client ?? null;
    applyClientSelection(match);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        {/* ------- Left column: all form sections ------- */}
        <div className="grid gap-5">
          {/* Section 1: Documento */}
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {/**  <HookFormSelect<SaleCaptureFormValues>
                name="concept"
                label="Concepto"
                disabled={disabled}
                options={[
                  { value: "MERCADERIA", label: "MERCADERIA" },
                  { value: "SERVICIO", label: "SERVICIO" },
                ]}
              />  <HookFormSelect<SaleCaptureFormValues>
                name="concept"
                label="Concepto"
                disabled={disabled}
                options={[
                  { value: "MERCADERIA", label: "MERCADERIA" },
                  { value: "SERVICIO", label: "SERVICIO" },
                ]}
              /> */}
              <HookFormSelect<SaleCaptureFormValues>
                name="docTypeCode"
                label="Documento"
                disabled={disabled}
                options={[
                  { value: "101", label: "PROFORMA" },
                  { value: "03", label: "BOLETA" },
                  { value: "01", label: "FACTURA" },
                ]}
              />
              <HookFormInput<SaleCaptureFormValues>
                name="correlativeDisplay"
                label="Correlativo"
                disabled
              />
              <HookFormInput<SaleCaptureFormValues>
                name="transactionNumber"
                label="Nro Transac."
                disabled
                placeholder="Número de transacción"
              />
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Section 2: Condición de venta y pago */}
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <HookFormSelect<SaleCaptureFormValues>
                name="condition"
                label="Condición"
                disabled={disabled}
                options={[
                  { value: "ALCONTADO", label: "AL CONTADO" },
                  { value: "CREDITO", label: "CRÉDITO" },
                ]}
              />
              <HookFormInput<SaleCaptureFormValues>
                name="emissionDate"
                label="Emisión"
                type="date"
                disabled
              />
              <HookFormSelect<SaleCaptureFormValues>
                name="paymentMethod"
                label="Forma pago"
                disabled={disabled}
                options={[
                  { value: "(SELECCIONE)", label: "(SELECCIONE)" },
                  { value: "EFECTIVO", label: "EFECTIVO" },
                  { value: "DEPOSITO", label: "DEPOSITO" },
                  { value: "TARJETA", label: "TARJETA" },
                  { value: "YAPE", label: "YAPE" },
                  { value: "EFECTIVO/DEPOSITO", label: "EFECTIVO/DEPOSITO" },
                  { value: "TARJETA/EFECTIVO", label: "TARJETA/EFECTIVO" },
                  { value: "YAPE/EFECTIVO", label: "YAPE/EFECTIVO" },
                  { value: "YAPE/DEPOSITO", label: "YAPE/DEPOSITO" },
                  { value: "TARJETA/DEPOSITO", label: "TARJETA/DEPOSITO" },
                  { value: "-", label: "-" },
                ]}
              />
              <HookFormSelect<SaleCaptureFormValues>
                name="bankEntity"
                label="Entidad"
                disabled={disabled || !paymentNeedsOperation}
                options={[
                  { value: "-", label: "-" },
                  { value: "BCP", label: "BCP" },
                  { value: "INTERBANK", label: "INTERBANK" },
                  { value: "SCOTIABANK", label: "SCOTIABANK" },
                  { value: "BBVA", label: "BBVA" },
                ]}
              />
              <HookFormInput<SaleCaptureFormValues>
                name="operationNumber"
                label="Nro Operación"
                disabled={disabled || !paymentNeedsOperation}
                placeholder="Número de operación"
              />
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Section 3: Cliente */}
          <div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <HookFormAutocomplete
                name="memberCode"
                label="Código"
                options={customerCodeOptions}
                disabled={disabled}
                placeholder="Código de miembro"
                allowCreate
                createLabel={(value) => `Usar código: ${value}`}
                syncInputToValue
                onInputValueChange={queueClientSearch}
                filterOptions={(options, state) =>
                  filterByClientData(options, state.inputValue)
                }
                onOptionSelected={(option) => {
                  if (!option) return;
                  applyClientSelection(
                    (option.client as Client | null) ?? null,
                  );
                }}
                onInputBlur={handleCustomerCodeBlur}
              />
              <div className="col-span-2 grid gap-2 sm:col-span-3 sm:grid-cols-[minmax(0,1fr)_112px]">
                <HookFormAutocomplete
                  name="customerName"
                  label="Cliente"
                  placeholder="Seleccionar cliente"
                  options={customerNameOptions}
                  disabled={disabled}
                  allowCreate
                  createLabel={(value) => `Usar cliente: ${value}`}
                  syncInputToValue
                  onInputValueChange={queueClientSearch}
                  filterOptions={(options, state) =>
                    filterByClientData(options, state.inputValue)
                  }
                  onOptionSelected={(option) => {
                    if (!option) {
                      setValue("customerName", "", {
                        shouldDirty: true,
                      });
                      setValue("customerDoc", "", {
                        shouldDirty: true,
                      });
                      setValue("customerEmail", "", {
                        shouldDirty: true,
                      });
                      setValue("address", "", { shouldDirty: true });
                      onClientSelected?.(null);
                      return;
                    }

                    const selectedClient = option.client as Client | null;
                    applyClientSelection(selectedClient);
                  }}
                  onInputBlur={handleCustomerInputBlur}
                />
                <button
                  type="button"
                  className="inline-flex h-10 w-full items-center justify-center gap-2 self-end whitespace-nowrap rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={onCreateClient}
                  disabled={disabled}
                >
                  <UserPlus className="h-4 w-4" />
                  Cliente
                </button>
              </div>
              <HookFormAutocomplete
                name="customerDoc"
                label={docTypeCode === "01" ? "RUC" : "DNI"}
                placeholder={
                  docTypeCode === "01" ? "Número de RUC" : "Número de DNI"
                }
                options={customerDocumentOptions}
                disabled={disabled}
                allowCreate
                createLabel={(value) =>
                  `Usar ${docTypeCode === "01" ? "RUC" : "DNI"}: ${value}`
                }
                syncInputToValue
                onInputValueChange={queueClientSearch}
                filterOptions={(options, state) =>
                  filterByClientData(options, state.inputValue)
                }
                onOptionSelected={(option) => {
                  if (!option) {
                    setValue("customerDoc", "", { shouldDirty: true });
                    setValue("customerName", "", { shouldDirty: true });
                    setValue("customerEmail", "", {
                      shouldDirty: true,
                    });
                    setValue("address", "", { shouldDirty: true });
                    onClientSelected?.(null);
                    return;
                  }

                  const selectedClient = option.client as Client | null;
                  applyClientSelection(selectedClient);
                }}
              />
              <div className="col-span-2">
                <HookFormInput<SaleCaptureFormValues>
                  name="customerEmail"
                  label="Correo"
                  type="email"
                  disabled={disabled}
                  placeholder="Correo del cliente"
                />
              </div>
            </div>
          </div>
        </div>

        {/* ------- Right column: summary ------- */}
        <div className="grid content-start gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-sm lg:sticky lg:top-4">
          <SectionLabel>Resumen</SectionLabel>
          <div className="flex items-center justify-between text-slate-500">
            <span className="font-semibold">PVS</span>
            <span className="font-semibold text-slate-700">
              {formatNumber(summary?.pvs ?? 0)}
            </span>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase text-slate-400">
              Total de PVS
            </p>
            <p className="text-right text-xl font-bold text-slate-800">
              {formatNumber(summary?.pvs ?? 0)}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
            <p className="text-[11px] font-semibold uppercase text-blue-600">
              Total del mes
            </p>
            <p className="text-right text-xl font-bold text-slate-800">
              {formatNumber(summary?.monthTotal ?? 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
