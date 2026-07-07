import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { HookFormAutocomplete } from "@/components/forms/HookFormAutocomplete";
import { HookFormInput } from "@/components/forms/HookFormInput";
import { HookFormSelect } from "@/components/forms/HookFormSelect";
import type { Client } from "@/types/customer";

type SaleCaptureFormValues = {
  docTypeCode: "03" | "01" | "101";
  condition: "ALCONTADO" | "CREDITO";
  delivery: "INMEDIATA" | "POR ENTREGAR";
  paymentMethod: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "YAPE" | "DEPOSITO";
  bankEntity: string;
  operationNumber: string;
  customerName: string;
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
  onClientSelected?: (client: Client | null) => void;
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

export function SaleCaptureFormFields({
  clientOptions,
  disabled = false,
  summary,
  onClientSelected,
  onSearchClients,
}: SaleCaptureFormFieldsProps) {
  const methods = useFormContext<SaleCaptureFormValues>();
  const values = useWatch({
    control: methods.control,
  }) as SaleCaptureFormValues;
  const paymentMethod = values.paymentMethod ?? "EFECTIVO";
  const docTypeCode = values.docTypeCode ?? "03";
  const searchTimerRef = useRef<number | null>(null);

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

  const filterByClientData = <T extends { label: string } & Record<string, unknown>>(
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

    methods.setValue("customerName", client.nombreRazon ?? "", {
      shouldDirty: true,
    });
    methods.setValue("customerDoc", client.ruc || client.dni || "", {
      shouldDirty: true,
    });
    methods.setValue("memberCode", getClientCode(client), {
      shouldDirty: true,
    });
    methods.setValue(
      "address",
      client.direccionFiscal || client.direccionDespacho || "",
      { shouldDirty: true },
    );
    methods.setValue("docTypeCode", client.ruc ? "01" : "03", {
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
    const match = clientOptions.find((opt) => opt.code === code)?.client ?? null;
    applyClientSelection(match);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_320px]">
      <div className="grid gap-3 md:grid-cols-2">
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
          name="transactionNumber"
          label="Nro Transac."
          disabled={disabled}
          placeholder="Número de transacción"
        />
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
            applyClientSelection((option.client as Client | null) ?? null);
          }}
          onInputBlur={handleCustomerCodeBlur}
        />
        <HookFormAutocomplete
          name="customerDoc"
          label={docTypeCode === "01" ? "RUC" : "DNI"}
          placeholder={docTypeCode === "01" ? "Número de RUC" : "Número de DNI"}
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
              methods.setValue("customerDoc", "", { shouldDirty: true });
              methods.setValue("customerName", "", { shouldDirty: true });
              methods.setValue("address", "", { shouldDirty: true });
              onClientSelected?.(null);
              return;
            }

            const selectedClient = option.client as Client | null;
            applyClientSelection(selectedClient);
          }}
          className="md:col-span-1"
        />
        <HookFormAutocomplete
          name="customerName"
          label="Cliente"
          placeholder="Seleccionar cliente"
          options={customerNameOptions}
          disabled={disabled}
          syncInputToValue
          onInputValueChange={queueClientSearch}
          filterOptions={(options, state) =>
            filterByClientData(options, state.inputValue)
          }
          onOptionSelected={(option) => {
            if (!option) {
              methods.setValue("customerName", "", { shouldDirty: true });
              methods.setValue("customerDoc", "", { shouldDirty: true });
              methods.setValue("address", "", { shouldDirty: true });
              onClientSelected?.(null);
              return;
            }

            const selectedClient = option.client as Client | null;
            applyClientSelection(selectedClient);
          }}
          onInputBlur={handleCustomerInputBlur}
          className="md:col-span-2"
        />
        <HookFormInput<SaleCaptureFormValues>
          name="address"
          label="Dirección"
          disabled={disabled}
          placeholder="Dirección"
          className="md:col-span-2"
        />
      </div>

      <div className="grid content-start gap-3 md:grid-cols-2 xl:grid-cols-1">
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
        <HookFormSelect<SaleCaptureFormValues>
          name="paymentMethod"
          label="Forma pago"
          disabled={disabled}
          options={[
            { value: "EFECTIVO", label: "EFECTIVO" },
            { value: "TARJETA", label: "TARJETA" },
            { value: "TRANSFERENCIA", label: "TRANSFERENCIA" },
            { value: "YAPE", label: "YAPE" },
            { value: "DEPOSITO", label: "DEPOSITO" },
          ]}
        />
        <HookFormSelect<SaleCaptureFormValues>
          name="bankEntity"
          label="Banco"
          disabled={disabled || paymentMethod === "EFECTIVO"}
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
          label="Operación"
          disabled={disabled || paymentMethod === "EFECTIVO"}
          placeholder="Número de operación"
        />
      </div>

      <div className="hidden content-start gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3 text-sm xl:grid">
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
  );
}
