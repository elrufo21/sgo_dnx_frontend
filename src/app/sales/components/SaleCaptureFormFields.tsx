import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import { Pencil, Send, UserPlus } from "lucide-react";
import { useFormContext, useWatch } from "react-hook-form";
import { HookFormAutocomplete } from "@/components/forms/HookFormAutocomplete";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import { focusNextInput } from "@/shared/helpers/focusNextInput";
import { getAutomaticPaymentBank } from "@/shared/helpers/paymentBank";
import { toast } from "@/shared/ui/toast";
import type { Client } from "@/app/customers/types/customer";
import {
  isCompleteClientRuc,
  normalizeClientDocument,
  normalizeClientText,
  searchSaleClients,
  type SaleClientIndex,
} from "@/app/sales/helpers/saleClientSearch";

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

interface SaleCaptureFormFieldsProps {
  clientIndex: SaleClientIndex;
  disabled?: boolean;
  correlative?: string;
  totalAmount: number;
  preserveMissingClientData?: boolean;
  onClientSelected: (
    client: Client | null,
    options?: { documentType?: "01" | "03" },
  ) => void;
  onCreateClient?: () => void;
  onCreateAndEditCapturedClient?: () => void;
  onSendEmail?: () => void;
  sendEmailDisabled?: boolean;
  sendingEmail?: boolean;
  allowEmailEdit?: boolean;
}

const safeTrim = (value: unknown) => String(value ?? "").trim();
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
  clientIndex,
  disabled = false,
  correlative,
  totalAmount,
  preserveMissingClientData = false,
  onClientSelected,
  onCreateClient,
  onCreateAndEditCapturedClient,
  onSendEmail,
  sendEmailDisabled = false,
  sendingEmail = false,
  allowEmailEdit = false,
}: SaleCaptureFormFieldsProps) {
  const { control, getValues, setFocus, setValue } = useFormContext<SaleCaptureFormValues>();
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
  const bankEntity = values.bankEntity ?? "-";
  const automaticBank = getAutomaticPaymentBank(paymentMethod);
  const docTypeCode = values.docTypeCode ?? "03";
  const correlativeDisplay = values.correlativeDisplay ?? "";
  const emissionDate = values.emissionDate ?? "";
  const currentCorrelative = correlative ?? (docTypeCode === "101" ? "0001-00000000" : "");
  const focusedPaymentMethodRef = useRef("");

  useEffect(() => {
    if (correlativeDisplay !== currentCorrelative) {
      setValue("correlativeDisplay", currentCorrelative);
    }
    if (!emissionDate) setValue("emissionDate", todayValue());
  }, [correlativeDisplay, currentCorrelative, emissionDate, setValue]);

  useEffect(() => {
    if (disabled) return;
    if (isPagoVarios && paymentMethod !== "-") {
      setValue("paymentMethod", "-", { shouldDirty: true });
      return;
    }
    if (!isPagoVarios && paymentMethod === "-") {
      setValue("paymentMethod", "(SELECCIONE)", { shouldDirty: true });
    }
  }, [disabled, isPagoVarios, paymentMethod, setValue]);

  useEffect(() => {
    if (disabled) return;
    if (isPagoVarios || !paymentNeedsOperation) {
      if (bankEntity !== "-") {
        setValue("bankEntity", "-", { shouldDirty: true });
      }
      return;
    }
    if (automaticBank) {
      if (bankEntity !== automaticBank) {
        setValue("bankEntity", automaticBank, { shouldDirty: true });
      }
      return;
    }
    if (bankEntity === "-" || !bankEntity) {
      setValue("bankEntity", "(SELECCIONE)", { shouldDirty: true });
    }
  }, [automaticBank, bankEntity, disabled, isPagoVarios, paymentNeedsOperation, setValue]);

  useEffect(() => {
    if (disabled) return;
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
    disabled,
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


  const getCodeSuggestions = useCallback(
    (value: string) => searchSaleClients(clientIndex, "code", value),
    [clientIndex],
  );
  const getNameSuggestions = useCallback(
    (value: string) =>
      searchSaleClients(clientIndex, docTypeCode === "01" ? "invoiceName" : "name", value),
    [clientIndex, docTypeCode],
  );
  const getRucSuggestions = useCallback(
    (value: string) => searchSaleClients(clientIndex, "ruc", value),
    [clientIndex],
  );

  const clearCustomerSelection = () => {
    const fields = [
      "memberCode", "customerName", "customerRuc", "customerDoc", "customerEmail", "address",
    ] as const;
    for (const name of fields) {
      if (getValues(name)) setValue(name, "", { shouldDirty: true });
    }
    onClientSelected(null);
  };

  const findClientByCode = (value: string) =>
    clientIndex.byCode.get(normalizeClientText(value));

  const findNameMatch = (value: string) => {
    const options = getNameSuggestions(value);
    const search = normalizeClientText(value);
    const exact = options.find((option) => normalizeClientText(option.label) === search);
    return {
      client: exact?.client ?? (options.length === 1 ? options[0].client : undefined),
      hasMatches: options.length > 0,
    };
  };

  const handleCustomerInputBlur = ({ inputValue }: { inputValue: string }) => {
    const label = safeTrim(inputValue);
    if (!label || label === getValues("customerName")) return;
    const { client, hasMatches } = findNameMatch(label);
    if (client) {
      onClientSelected(client);
      return;
    }
    if (preserveMissingClientData) setValue("customerName", label, { shouldDirty: true });
    if (!hasMatches) toast.error("El cliente no existe. Agrégalo y selecciónalo.");
  };

  const handleCustomerCodeBlur = ({ inputValue }: { inputValue: string }) => {
    const code = safeTrim(inputValue);
    if (!code || code === getValues("memberCode")) return;
    const client = findClientByCode(code);
    if (client) {
      onClientSelected(client);
      return;
    }
    if (preserveMissingClientData) setValue("memberCode", code, { shouldDirty: true });
    toast.error("El código de cliente no existe. Agrega el cliente y selecciónalo.");
  };

  const selectClientOnEnter = (
    event: KeyboardEvent<HTMLInputElement>,
    findClient: (inputValue: string) => Client | undefined,
  ) => {
    if (event.key !== "Enter") return;
    const input = event.target as HTMLInputElement;
    if (input.getAttribute("aria-activedescendant") || !safeTrim(input.value)) return;
    const client = findClient(input.value);
    if (!client) return;
    event.preventDefault();
    event.stopPropagation();
    onClientSelected(client);
    window.requestAnimationFrame(() => focusNextInput(input));
  };

  const handleCodeInputChange = (value: string) => {
    clearCustomerSelection();
    const client = findClientByCode(value);
    if (client) onClientSelected(client);
  };

  const getExactRucMatches = (ruc: string) =>
    isCompleteClientRuc(ruc) ? clientIndex.byRuc.get(ruc) ?? [] : [];

  const handleRucInputChange = (value: string) => {
    clearCustomerSelection();
    const matches = getExactRucMatches(value);
    if (matches.length === 1) onClientSelected(matches[0], { documentType: "01" });
  };

  const commitRuc = (inputValue: string) => {
    const ruc = normalizeClientDocument(inputValue);
    if (!ruc) return false;
    const matches = getExactRucMatches(ruc);
    if (matches.length === 1) {
      onClientSelected(matches[0], { documentType: "01" });
      return true;
    }
    setValue("customerRuc", ruc, { shouldDirty: true });
    toast.error(matches.length > 1
      ? "Hay varios clientes con este RUC. Corrige los registros duplicados antes de continuar."
      : "El RUC no existe. Agrega el cliente y selecciónalo.");
    return false;
  };

  const handleRucEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    const input = event.target as HTMLInputElement;
    if (input.value.length !== 11) return;
    event.preventDefault();
    event.stopPropagation();
    if (commitRuc(input.value)) window.requestAnimationFrame(() => focusNextInput(input));
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
              onChange={(event) => {
                if (getAutomaticPaymentBank(event.target.value)) {
                  window.requestAnimationFrame(() => setFocus("operationNumber"));
                }
              }}
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
                ...(isPagoVarios || disabled ? [{ value: "-", label: "-" }] : []),
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
            disabled={disabled || isPagoVarios || !paymentNeedsOperation || Boolean(automaticBank)}
            onChange={(event) => {
              if (!["(SELECCIONE)", "-"].includes(event.target.value)) {
                window.requestAnimationFrame(() => setFocus("operationNumber"));
              }
            }}
            options={[
              { value: "(SELECCIONE)", label: "(SELECCIONE)" },
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
            getSuggestions={getCodeSuggestions}
            disabled={disabled}
            placeholder="Código"
            allowCreate
            showCreateOption={false}
            onInputValueChange={handleCodeInputChange}
            onOptionSelected={(option) => option ? onClientSelected(option.client) : clearCustomerSelection()}
            onInputKeyDown={(event) =>
              selectClientOnEnter(event, findClientByCode)
            }
            onInputBlur={handleCustomerCodeBlur}
          />
          {onSendEmail ? (
            <button
              type="button"
              className="inline-flex h-10 w-full items-center justify-center gap-2 self-end whitespace-nowrap rounded-lg border border-sky-300 bg-sky-50 px-3 text-sm font-medium text-sky-800 transition-colors hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-3"
              onClick={onSendEmail}
              disabled={sendEmailDisabled || sendingEmail}
              title="ENVIAR CORREO"
            >
              <Send className="h-4 w-4" />
              {sendingEmail ? "Enviando..." : "Enviar"}
            </button>
          ) : onCreateClient ? (
            <div className="flex w-full gap-2 self-end sm:mt-3">
              <button
                type="button"
                className="inline-flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onCreateClient}
                disabled={disabled}
              >
                <UserPlus className="h-4 w-4" />
                Agregar
              </button>
              {onCreateAndEditCapturedClient ? (
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-amber-300 bg-amber-50 px-3 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={onCreateAndEditCapturedClient}
                  disabled={disabled}
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <HookFormAutocomplete
              name="customerName"
              label="Cliente"
              placeholder="Seleccionar cliente"
              getSuggestions={getNameSuggestions}
              disabled={disabled}
              allowCreate
              showCreateOption={false}
              onInputValueChange={clearCustomerSelection}
              onOptionSelected={(option) => option ? onClientSelected(option.client) : clearCustomerSelection()}
              onInputKeyDown={(event) =>
                selectClientOnEnter(event, (value) => findNameMatch(value).client)
              }
              onInputBlur={handleCustomerInputBlur}
            />
          </div>
          <div className="pt-2">
            <HookFormInput<SaleCaptureFormValues>
              name="customerDoc"
              label="DNI"
              placeholder="Número de DNI"
              disabled
            />
          </div>
          <HookFormAutocomplete
            name="customerRuc"
            label="RUC"
            placeholder="Número de RUC"
            getSuggestions={getRucSuggestions}
            disabled={disabled}
            allowCreate
            showCreateOption={false}
            transformInputValue={(value) => normalizeClientDocument(value).slice(0, 11)}
            inputProps={{
              inputMode: "numeric",
              pattern: "[0-9]*",
              maxLength: 11,
            }}
            onInputValueChange={handleRucInputChange}
            onOptionSelected={(option) => option
              ? onClientSelected(option.client, { documentType: "01" })
              : clearCustomerSelection()}
            onInputKeyDown={handleRucEnter}
            onInputBlur={({ inputValue }) => {
              if (inputValue !== getValues("customerRuc")) commitRuc(inputValue);
            }}
          />
          <div className="sm:col-span-2">
            <HookFormInput<SaleCaptureFormValues>
              name="customerEmail"
              label="Correo"
              type="email"
              rules={{
                validate: (value) =>
                  !value ||
                  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ||
                  "Ingresa un correo valido, por ejemplo correo@dominio.com.",
              }}
              disabled={!allowEmailEdit || sendingEmail}
              placeholder="Correo del cliente"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
