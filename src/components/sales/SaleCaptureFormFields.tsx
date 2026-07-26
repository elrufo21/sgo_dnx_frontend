import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
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
const normalizeDocumentText = (value: unknown) =>
  String(value ?? "").replace(/\D/g, "");
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
  const serie =
    docTypeCode === "01" ? "FA01" : docTypeCode === "101" ? "0001" : "BA01";
  const currentCorrelative =
    correlative ?? `${serie}-00000000`;
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

  const saleClientByName = useMemo(() => {
    const byName = new Map<string, (typeof customerNameOptions)[number]>();
    customerNameOptions.forEach((client) => {
      byName.set(normalizeSearchText(client.label), client);
    });
    return byName;
  }, [customerNameOptions]);

  const customerDniOptions = useMemo(
    () =>
      clientOptions
        .filter((opt) => safeTrim(opt.client.dni))
        .map((opt) => ({
          label: safeTrim(opt.client.dni),
          value: safeTrim(opt.client.dni),
          ruc: safeTrim(opt.client.ruc),
          dni: safeTrim(opt.client.dni),
          code: opt.code,
          nombreRazon: opt.label,
          id: opt.client.id,
          client: opt.client,
        })),
    [clientOptions],
  );

  const customerRucOptions = useMemo(
    () =>
      clientOptions
        .filter((opt) => safeTrim(opt.client.ruc))
        .map((opt) => ({
          label: safeTrim(opt.client.ruc),
          value: safeTrim(opt.client.ruc),
          ruc: safeTrim(opt.client.ruc),
          dni: safeTrim(opt.client.dni),
          code: opt.code,
          nombreRazon: opt.label,
          id: opt.client.id,
          client: opt.client,
        })),
    [clientOptions],
  );

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
    const search = normalizeSearchText(inputValue);
    if (!search) return options;
    return options.filter((opt) =>
      [opt.label, opt.nombreRazon, opt.doc, opt.code, opt.dni, opt.ruc].some(
        (value) => normalizeSearchText(value).includes(search),
      ),
    );
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
    setValue("docTypeCode", client.ruc ? "01" : "03", {
      shouldDirty: true,
    });
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
    toast.error(
      "Intentaste seleccionar un cliente que no existe, por favor agrega el cliente y seleccionalo.",
    );
    clearCustomerSelection();
  };

  const handleCustomerCodeBlur = ({ inputValue }: { inputValue: string }) => {
    const code = safeTrim(inputValue);
    if (!code) return;
    const match =
      clientOptions.find((opt) => opt.code === code)?.client ?? null;
    applyClientSelection(match);
  };

  const clearCustomerSelection = () => {
    setValue("customerName", "", { shouldDirty: true });
    setValue("customerDoc", "", { shouldDirty: true });
    setValue("customerRuc", "", { shouldDirty: true });
    setValue("customerEmail", "", { shouldDirty: true });
    setValue("address", "", { shouldDirty: true });
    onClientSelected?.(null);
  };

  const selectOnlyCustomerMatch = (inputValue: string) => {
    const matches = filterByClientData(customerNameOptions, inputValue);
    if (matches.length !== 1) return false;
    applyClientSelection(matches[0].client);
    return true;
  };

  const selectOnlyDocumentMatch = (type: "dni" | "ruc", inputValue: string) => {
    const options = type === "ruc" ? customerRucOptions : customerDniOptions;
    const matches = filterDocumentOptions(options, inputValue);
    if (matches.length !== 1) return false;
    applyClientSelection(matches[0].client);
    return true;
  };

  const handleCustomerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      selectOnlyCustomerMatch(event.currentTarget.value)
    ) {
      event.preventDefault();
    }
  };

  const handleDocumentKeyDown =
    (type: "dni" | "ruc") => (event: KeyboardEvent<HTMLInputElement>) => {
      if (
        event.key === "Enter" &&
        !event.shiftKey &&
        selectOnlyDocumentMatch(type, event.currentTarget.value)
      ) {
        event.preventDefault();
      }
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
      clearCustomerSelection();
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
              { value: "101", label: "PROFORMA" },
              { value: "03", label: "BOLETA" },
              { value: "01", label: "FACTURA" },
            ]}
          />
          <HookFormInput<SaleCaptureFormValues>
            name="emissionDate"
            label="Emisión"
            type="date"
            disabled
          />
          <div className="sm:col-span-2">
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
            ]}
          />
          <HookFormSelect<SaleCaptureFormValues>
            name="delivery"
            label="Entrega"
            disabled={disabled}
            options={[
              { value: "INMEDIATA", label: "INMEDIATA" },
              { value: "POR ENTREGAR", label: "POR ENTREGAR" },
            ]}
          />
          <div className="sm:col-span-2">
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
          </div>
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
            placeholder="Número"
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
              onInputKeyDown={handleCustomerKeyDown}
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
            onInputKeyDown={handleDocumentKeyDown("dni")}
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
            onInputKeyDown={handleDocumentKeyDown("ruc")}
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
              disabled={disabled}
              placeholder="Correo del cliente"
            />
          </div>
        </div>
      </div>

    </div>
  );
}
