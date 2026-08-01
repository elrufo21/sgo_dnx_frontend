import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { UserPlus } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { HookFormAutocomplete } from "@/components/forms/HookFormAutocomplete";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { toast } from "@/shared/ui/toast";
import type { Client } from "@/types/customer";

type SaleCaptureFormValues = {
  concept: "MERCADERIA" | "SERVICIO";
  docTypeCode: "03" | "01" | "101";
  correlativeDisplay: string;
  condition: "ALCONTADO" | "CREDITO" | "PAGO/VARIOS";
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
  paymentDeposit: string;
  paymentCash: string;
  customerName: string;
  customerEmail: string;
  customerDoc: string;
  customerRuc: string;
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
  correlative?: string;
  totalAmount?: number;
  preserveMissingClientData?: boolean;
  onClientSelected?: (client: Client | null) => void;
  onCreateClient?: () => void;
  onSearchClients?: (search: string) => void;
}

const safeTrim = (value: unknown) => String(value ?? "").trim();
const getClientCode = (client: Client | null | undefined) =>
  safeTrim(client?.clienteCodigo);
const normalizeSearchText = (value: unknown) =>
  safeTrim(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
const tokenizeSearchText = (value: unknown) =>
  normalizeSearchText(value).split(/\s+/).filter(Boolean);
const normalizeDocumentText = (value: unknown) =>
  String(value ?? "").replace(/\D/g, "");
const isPlaceholderDocument = (value: unknown) => {
  const document = normalizeDocumentText(value);
  return !document || /^0+$/.test(document) || /^0*1$/.test(document);
};
const clampDocumentValue = (type: "dni" | "ruc", value: unknown) =>
  normalizeDocumentText(value).slice(0, type === "ruc" ? 11 : 9);
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
  correlative,
  totalAmount = 0,
  preserveMissingClientData = false,
  onClientSelected,
  onCreateClient,
  onSearchClients,
}: SaleCaptureFormFieldsProps) {
  const { control, setValue } = useFormContext<SaleCaptureFormValues>();
  const values = useWatch({
    control,
  }) as SaleCaptureFormValues;
  const paymentMethod = values.paymentMethod ?? "EFECTIVO";
  const isPagoVarios = values.condition === "PAGO/VARIOS";
  const isMixedPayment =
    paymentMethod.includes("/") && paymentMethod.includes("EFECTIVO");
  const paymentNeedsOperation = !["(SELECCIONE)", "EFECTIVO", "-"].includes(
    paymentMethod,
  );
  const docTypeCode = values.docTypeCode ?? "03";
  const correlativeDisplay = values.correlativeDisplay ?? "";
  const emissionDate = values.emissionDate ?? "";
  const serie =
    docTypeCode === "01" ? "FA01" : docTypeCode === "101" ? "0001" : "BA01";
  const currentCorrelative = correlative ?? `${serie}-00000000`;
  const searchTimerRef = useRef<number | null>(null);
  const focusedPaymentMethodRef = useRef("");

  useEffect(() => {
    if (correlativeDisplay !== currentCorrelative) {
      setValue("correlativeDisplay", currentCorrelative);
    }
    if (!emissionDate) setValue("emissionDate", todayValue());
  }, [correlativeDisplay, currentCorrelative, emissionDate, setValue]);

  useEffect(() => {
    if (isPagoVarios && paymentMethod !== "-") {
      setValue("paymentMethod", "-", { shouldDirty: true });
      return;
    }
    if (!isPagoVarios && paymentMethod === "-") {
      setValue("paymentMethod", "(SELECCIONE)", { shouldDirty: true });
    }
  }, [isPagoVarios, paymentMethod, setValue]);

  useEffect(() => {
    const total = Math.max(0, Number(totalAmount) || 0);
    const formatAmount = (value: number) =>
      value <= 0 ? "" : String(Number(value.toFixed(2)));
    const setPaymentSplit = (deposit: number, cash: number) => {
      const nextDeposit = formatAmount(deposit);
      const nextCash = formatAmount(cash);
      if (values.paymentDeposit !== nextDeposit) {
        setValue("paymentDeposit", nextDeposit, { shouldDirty: true });
      }
      if (values.paymentCash !== nextCash) {
        setValue("paymentCash", nextCash, { shouldDirty: true });
      }
    };

    if (isPagoVarios || paymentMethod === "(SELECCIONE)") {
      setPaymentSplit(0, 0);
      return;
    }
    if (paymentMethod === "EFECTIVO") {
      setPaymentSplit(0, total);
      return;
    }
    if (!isMixedPayment) {
      setPaymentSplit(total, 0);
      return;
    }

    const deposit = Math.min(
      Math.max(0, Number(values.paymentDeposit) || 0),
      total,
    );
    setPaymentSplit(deposit, Math.max(total - deposit, 0));
  }, [
    isMixedPayment,
    isPagoVarios,
    paymentMethod,
    setValue,
    totalAmount,
    values.paymentCash,
    values.paymentDeposit,
  ]);

  useEffect(() => {
    if (!isMixedPayment || disabled || focusedPaymentMethodRef.current === paymentMethod) {
      return;
    }
    focusedPaymentMethodRef.current = paymentMethod;
    window.setTimeout(() => {
      const input = document.querySelector<HTMLInputElement>(
        "[data-payment-deposit-input]",
      );
      input?.focus();
      input?.select();
    }, 0);
  }, [disabled, isMixedPayment, paymentMethod]);

  useEffect(
    () => () => {
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
    },
    [],
  );

  const queueClientSearch = useCallback(
    (value: string) => {
      if (!onSearchClients) return;
      const search = safeTrim(value);
      if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
      if (search.length < 2) return;
      searchTimerRef.current = window.setTimeout(() => {
        onSearchClients?.(search);
      }, 300);
    },
    [onSearchClients],
  );

  const normalizedClientOptions = useMemo(() => {
    const byLabel = new Map<string, ClientOption>();

    clientOptions
      .filter((opt) => Number(opt.client.id) > 0)
      .forEach((opt) => {
        const label = safeTrim(opt.label) || `Cliente ${opt.client.id}`;
        const option = { ...opt, label };
        const key = normalizeSearchText(label);
        const current = byLabel.get(key);
        const optionScore =
          Number(Boolean(safeTrim(option.client.ruc))) * 2 +
          Number(Boolean(safeTrim(option.client.dni)));
        const currentScore = current
          ? Number(Boolean(safeTrim(current.client.ruc))) * 2 +
            Number(Boolean(safeTrim(current.client.dni)))
          : -1;

        if (!current || optionScore > currentScore) byLabel.set(key, option);
      });

    return Array.from(byLabel.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "es", { sensitivity: "base" }),
    );
  }, [clientOptions]);

  const customerNameOptions = useMemo(() => {
    const baseOptions = normalizedClientOptions
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
  }, [docTypeCode, normalizedClientOptions]);

  const saleClientByName = useMemo(() => {
    const byName = new Map<string, (typeof customerNameOptions)[number]>();
    customerNameOptions.forEach((client) => {
      byName.set(normalizeSearchText(client.label), client);
    });
    return byName;
  }, [customerNameOptions]);

  const customerDniOptions = useMemo(() => {
    const byDni = new Map<string, (typeof normalizedClientOptions)[number]>();
    normalizedClientOptions.forEach((opt) => {
      const dni = normalizeDocumentText(opt.client.dni);
      if (!isPlaceholderDocument(dni) && !byDni.has(dni)) byDni.set(dni, opt);
    });

    return Array.from(byDni.entries()).map(([dni, opt]) => ({
      label: dni,
      value: dni,
      ruc: safeTrim(opt.client.ruc),
      dni,
      code: opt.code,
      nombreRazon: opt.label,
      id: opt.client.id,
      client: opt.client,
    }));
  }, [normalizedClientOptions]);

  const customerRucOptions = useMemo(() => {
    const byRuc = new Map<string, (typeof normalizedClientOptions)[number]>();
    normalizedClientOptions.forEach((opt) => {
      const ruc = normalizeDocumentText(opt.client.ruc);
      if (!isPlaceholderDocument(ruc) && !byRuc.has(ruc)) byRuc.set(ruc, opt);
    });

    return Array.from(byRuc.entries()).map(([ruc, opt]) => ({
      label: ruc,
      value: ruc,
      ruc: safeTrim(opt.client.ruc),
      dni: safeTrim(opt.client.dni),
      code: opt.code,
      nombreRazon: opt.label,
      id: opt.client.id,
      client: opt.client,
    }));
  }, [normalizedClientOptions]);

  const customerCodeOptions = useMemo(
    () =>
      normalizedClientOptions
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
    [normalizedClientOptions],
  );

  const filterByClientData = <
    T extends { label: string } & Record<string, unknown>,
  >(
    options: T[],
    inputValue: string,
  ) => {
    const search = normalizeSearchText(inputValue);
    if (!search) return options.slice(0, 100);
    const tokens = tokenizeSearchText(search);

    return options
      .map((opt) => {
        const label = normalizeSearchText(opt.label ?? opt.nombreRazon);
        const document = normalizeSearchText(
          `${opt.doc ?? ""} ${opt.code ?? ""} ${opt.dni ?? ""} ${opt.ruc ?? ""}`,
        );
        const matches = tokens.every(
          (token) => label.includes(token) || document.includes(token),
        );
        if (!matches) return null;

        let score = 4;
        if (label === search || document === search) score = 0;
        else if (label.startsWith(search)) score = 1;
        else if (
          tokens.every((token) =>
            label.split(" ").some((part) => part.startsWith(token)),
          )
        ) {
          score = 2;
        } else if (document.startsWith(search)) {
          score = 3;
        }

        return { opt, score };
      })
      .filter((item): item is { opt: T; score: number } => item !== null)
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return a.opt.label.localeCompare(b.opt.label, "es", {
          sensitivity: "base",
        });
      })
      .map((item) => item.opt)
      .slice(0, 100);
  };

  const filterDocumentOptions = <
    T extends { value: string; label: string; client: Client } & Record<
      string,
      unknown
    >,
  >(
    options: T[],
    inputValue: string,
  ) => {
    const input = normalizeSearchText(inputValue);
    const document = normalizeDocumentText(inputValue);
    if (!input && !document) return options.slice(0, 100);
    return options
      .filter((option) => {
        const optionDocument = normalizeDocumentText(option.value);
        const clientLabel = normalizeSearchText(option.client.nombreRazon);
        return (
          (document && optionDocument.includes(document)) ||
          (input && clientLabel.includes(input))
        );
      })
      .sort((a, b) => {
        const aDocument = normalizeDocumentText(a.value);
        const bDocument = normalizeDocumentText(b.value);
        const aStarts = Boolean(document && aDocument.startsWith(document));
        const bStarts = Boolean(document && bDocument.startsWith(document));
        if (aStarts !== bStarts) return aStarts ? -1 : 1;
        return aDocument.localeCompare(bDocument);
      })
      .slice(0, 100);
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
    setValue("customerDoc", client.dni || "", {
      shouldDirty: true,
    });
    setValue("customerRuc", client.ruc || "", {
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
    onClientSelected?.(client);
  };

  const handleCustomerInputBlur = ({ inputValue }: { inputValue: string }) => {
    const label = safeTrim(inputValue);
    if (!label) return;

    const match = saleClientByName.get(normalizeSearchText(label));
    if (match) {
      applyClientSelection(match.client);
      return;
    }
    if (selectOnlyCustomerMatch(label)) return;
    if (filterByClientData(customerNameOptions, label).length > 0) return;
    handleMissingCustomer();
  };

  const handleCustomerCodeBlur = ({ inputValue }: { inputValue: string }) => {
    const code = safeTrim(inputValue);
    if (!code) return;
    const match =
      normalizedClientOptions.find(
        (opt) => normalizeSearchText(opt.code) === normalizeSearchText(code),
      )?.client ?? null;
    if (match) {
      applyClientSelection(match);
      return;
    }
    handleMissingCustomer();
  };

  const clearCustomerSelection = () => {
    setValue("memberCode", "", { shouldDirty: true });
    setValue("customerName", "", { shouldDirty: true });
    setValue("customerDoc", "", { shouldDirty: true });
    setValue("customerRuc", "", { shouldDirty: true });
    setValue("customerEmail", "", { shouldDirty: true });
    setValue("address", "", { shouldDirty: true });
    onClientSelected?.(null);
  };

  const handleMissingCustomer = () => {
    toast.error(
      "Intentaste seleccionar un cliente que no existe, por favor agrega el cliente y seleccionalo.",
    );
    if (!preserveMissingClientData) clearCustomerSelection();
  };

  const selectOnlyCustomerMatch = (inputValue: string) => {
    const matches = filterByClientData(customerNameOptions, inputValue);
    if (matches.length !== 1) return false;
    applyClientSelection(matches[0].client);
    return true;
  };

  const handleDocumentBlur =
    (type: "dni" | "ruc") =>
    ({ inputValue }: { inputValue: string }) => {
      const document = normalizeDocumentText(inputValue);
      if (!document) return;
      const options = type === "ruc" ? customerRucOptions : customerDniOptions;
      const match =
        options.find(
          (option) => normalizeDocumentText(option.value) === document,
        ) ?? null;
      if (match) {
        applyClientSelection(match.client);
        return;
      }
      toast.error(
        `El ${type === "ruc" ? "RUC" : "DNI"} no existe. Agrega el cliente y seleccionalo.`,
      );
      if (!preserveMissingClientData) clearCustomerSelection();
    };

  return (
    <div className="grid gap-4">
      <div>
        <SectionLabel>Documento</SectionLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <HookFormSelect<SaleCaptureFormValues>
            name="docTypeCode"
            label="Documento"
            disabled={disabled}
            options={[
              { value: "101", label: "PROFORMA V" },
              { value: "03", label: "BOLETA" },
              { value: "01", label: "FACTURA" },
            ]}
          />
          {/**
          <HookFormInput<SaleCaptureFormValues>
            name="emissionDate"
            label="Emisión"
            type="date"
            disabled
          /> */}
          <div className="sm:col-span-1">
            <HookFormInput<SaleCaptureFormValues>
              name="correlativeDisplay"
              label="Correlativo"
              disabled
            />
          </div>
          <div className="sm:col-span-2">
            <HookFormInput<SaleCaptureFormValues>
              name="transactionNumber"
              label="Nro Transac."
              disabled
              placeholder="Número de transacción"
            />
          </div>
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      <div>
        <SectionLabel>Pago</SectionLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <HookFormSelect<SaleCaptureFormValues>
            name="condition"
            label="Condición"
            disabled={disabled}
            options={[
              { value: "ALCONTADO", label: "AL CONTADO" },
              { value: "CREDITO", label: "CRÉDITO" },
              { value: "PAGO/VARIOS", label: "PAGO/VARIOS" },
            ]}
          />
          <div className="sm:col-span-1">
            <HookFormSelect<SaleCaptureFormValues>
              name="paymentMethod"
              label="Forma pago"
              disabled={disabled || isPagoVarios}
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
                ...(isPagoVarios ? [{ value: "-", label: "-" }] : []),
              ]}
            />
          </div>
          {/**    <HookFormSelect<SaleCaptureFormValues>
            name="delivery"
            label="Entrega"
            disabled={disabled}
            options={[
              { value: "INMEDIATA", label: "INMEDIATA" },
              { value: "POR ENTREGAR", label: "POR ENTREGAR" },
            ]}
          /> */}

          <HookFormSelect<SaleCaptureFormValues>
            name="bankEntity"
            label="Entidad"
            disabled={disabled || isPagoVarios || !paymentNeedsOperation}
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
            disabled={disabled || isPagoVarios || !paymentNeedsOperation}
            placeholder="Número"
          />
          <HookFormInput<SaleCaptureFormValues>
            name="paymentDeposit"
            label="Depósito"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            disabled={disabled || isPagoVarios || !isMixedPayment}
            data-payment-deposit-input="true"
          />
          <HookFormInput<SaleCaptureFormValues>
            name="paymentCash"
            label="Efectivo"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            disabled
          />
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      <div>
        <SectionLabel>Cliente</SectionLabel>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <HookFormAutocomplete
            name="memberCode"
            label="Código"
            options={customerCodeOptions}
            disabled={disabled}
            placeholder="Código"
            allowCreate
            createLabel={(value) => `Usar código: ${value}`}
            syncInputToValue
            onInputValueChange={queueClientSearch}
            filterOptions={(options, state) =>
              filterByClientData(options, state.inputValue)
            }
            onOptionSelected={(option) => {
              if (!option) return;
              applyClientSelection((option.client as Client | null) ?? null);
            }}
            onInputBlur={handleCustomerCodeBlur}
          />
          <button
            type="button"
            className="inline-flex h-10 w-full items-center justify-center gap-2 self-end whitespace-nowrap rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-3"
            onClick={onCreateClient}
            disabled={disabled}
          >
            <UserPlus className="h-4 w-4" />
            Cliente
          </button>
          <div className="sm:col-span-2">
            <HookFormAutocomplete
              name="customerName"
              label="Cliente"
              placeholder="Seleccionar cliente"
              options={customerNameOptions}
              disabled={disabled}
              allowCreate
              showCreateOption={false}
              createLabel={(value) => `Usar cliente: ${value}`}
              syncInputToValue
              onInputValueChange={queueClientSearch}
              filterOptions={(options, state) =>
                filterByClientData(options, state.inputValue)
              }
              onOptionSelected={(option) => {
                if (!option) {
                  clearCustomerSelection();
                  return;
                }
                applyClientSelection((option.client as Client | null) ?? null);
              }}
              onInputBlur={handleCustomerInputBlur}
            />
          </div>
          <HookFormAutocomplete
            name="customerDoc"
            label="DNI"
            placeholder="Número de DNI"
            options={customerDniOptions}
            disabled={disabled}
            allowCreate
            showCreateOption={false}
            createLabel={(value) => `Usar DNI: ${value}`}
            syncInputToValue
            transformInputValue={(value) => clampDocumentValue("dni", value)}
            inputProps={{
              inputMode: "numeric",
              pattern: "[0-9]*",
              maxLength: 9,
            }}
            onInputValueChange={queueClientSearch}
            filterOptions={(options, state) =>
              filterDocumentOptions(options, state.inputValue)
            }
            onOptionSelected={(option) => {
              if (!option) {
                clearCustomerSelection();
                return;
              }
              applyClientSelection((option.client as Client | null) ?? null);
            }}
            onInputBlur={handleDocumentBlur("dni")}
          />
          <HookFormAutocomplete
            name="customerRuc"
            label="RUC"
            placeholder="Número de RUC"
            options={customerRucOptions}
            disabled={disabled}
            allowCreate
            showCreateOption={false}
            createLabel={(value) => `Usar RUC: ${value}`}
            syncInputToValue
            transformInputValue={(value) => clampDocumentValue("ruc", value)}
            inputProps={{
              inputMode: "numeric",
              pattern: "[0-9]*",
              maxLength: 11,
            }}
            onInputValueChange={queueClientSearch}
            filterOptions={(options, state) =>
              filterDocumentOptions(options, state.inputValue)
            }
            onOptionSelected={(option) => {
              if (!option) {
                clearCustomerSelection();
                return;
              }
              applyClientSelection((option.client as Client | null) ?? null);
            }}
            onInputBlur={handleDocumentBlur("ruc")}
          />
          <div className="sm:col-span-2">
            <HookFormInput<SaleCaptureFormValues>
              name="customerEmail"
              label="Correo"
              type="email"
              disabled
              placeholder="Correo del cliente"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
