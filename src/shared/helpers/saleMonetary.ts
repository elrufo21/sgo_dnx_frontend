export const IGV_RATE = 0.18;
export const IGV_FACTOR = 1 + IGV_RATE;

export const roundCurrency = (value: number) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
};

export const roundUnitValue = (value: number) => {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 1_000_000) / 1_000_000;
};

export const sumCurrency = (values: number[]) =>
  roundCurrency(values.reduce((acc, value) => acc + value, 0));

const allocateAmountProportionally = (weights: number[], targetAmount: number) => {
  if (!weights.length) return [];

  const safeWeights = weights.map((weight) => Math.max(roundCurrency(weight), 0));
  let remainingWeight = sumCurrency(safeWeights);
  let remainingTarget = roundCurrency(targetAmount);

  return safeWeights.map((weight, index) => {
    const isLastLine = index === safeWeights.length - 1;
    const proportionalAmount =
      remainingWeight > 0 ? (weight / remainingWeight) * remainingTarget : 0;
    const allocatedAmount = isLastLine
      ? roundCurrency(Math.max(remainingTarget, 0))
      : roundCurrency(
          Math.min(
            Math.max(proportionalAmount, 0),
            Math.max(remainingTarget, 0),
          ),
        );

    remainingWeight = roundCurrency(Math.max(remainingWeight - weight, 0));
    remainingTarget = roundCurrency(remainingTarget - allocatedAmount);

    return allocatedAmount;
  });
};

export const normalizarUnidadSunat = (unidad?: string | null): string => {
  const valor = String(unidad ?? "").trim().toUpperCase();

  const map: Record<string, string> = {
    UNIDAD: "NIU",
    UNIDADES: "NIU",
    UND: "NIU",
    UNID: "NIU",
    NIU: "NIU",
    CAJA: "BX",
    CAJAS: "BX",
    BX: "BX",
    KG: "KGM",
    KILO: "KGM",
    KGM: "KGM",
    LITRO: "LTR",
    LTR: "LTR",
  };

  return map[valor] || "NIU";
};

export const normalizeSunatUnitCode = (value: unknown) =>
  normalizarUnidadSunat(String(value ?? ""));

export type SaleMonetaryInputLine = {
  quantity: number;
  unitPrice: number;
  unitMeasure?: unknown;
};

export type SaleMonetaryLine = {
  quantity: number;
  unitCode: string;
  unitPriceWithoutIgv: number;
  importeWithoutIgv: number;
  igv: number;
  totalWithIgv: number;
};

export type SaleMonetarySummary = {
  subtotalWithoutIgv: number;
  igv: number;
  totalWithIgv: number;
  lines: SaleMonetaryLine[];
};

export const buildSaleMonetarySummary = (options: {
  lines: SaleMonetaryInputLine[];
  pricesIncludeIgv?: boolean;
  targetTotalWithIgv?: number | null;
}): SaleMonetarySummary => {
  const { lines, pricesIncludeIgv = true, targetTotalWithIgv = null } = options;

  const sanitizedLines = lines.map((line) => {
    const quantityRaw = Number(line.quantity ?? 0);
    const unitPriceRaw = Number(line.unitPrice ?? 0);
    const quantity = Number.isFinite(quantityRaw) ? Math.max(quantityRaw, 0) : 0;
    const unitPrice = Number.isFinite(unitPriceRaw) ? Math.max(unitPriceRaw, 0) : 0;

    return {
      quantity,
      unitPrice,
      unitCode: normalizeSunatUnitCode(line.unitMeasure ?? "UND"),
    };
  });

  const baseGrossByLine = sanitizedLines.map((line) => {
    if (pricesIncludeIgv) {
      return roundCurrency(line.quantity * line.unitPrice);
    }

    const subtotalWithoutIgv = roundCurrency(line.quantity * line.unitPrice);
    return roundCurrency(subtotalWithoutIgv * IGV_FACTOR);
  });

  const baseTotalWithIgv = sumCurrency(baseGrossByLine);
  const totalWithIgv =
    targetTotalWithIgv === null || targetTotalWithIgv === undefined
      ? baseTotalWithIgv
      : roundCurrency(Math.max(Number(targetTotalWithIgv) || 0, 0));

  const adjustedGrossByLine =
    targetTotalWithIgv === null || targetTotalWithIgv === undefined
      ? baseGrossByLine
      : allocateAmountProportionally(baseGrossByLine, totalWithIgv);

  const targetSubtotalWithoutIgv = roundCurrency(totalWithIgv / IGV_FACTOR);
  const subtotalByLine = allocateAmountProportionally(
    adjustedGrossByLine,
    targetSubtotalWithoutIgv,
  );

  const computedLines = sanitizedLines.map((line, index) => {
    const quantity = line.quantity;
    const targetImporteWithoutIgv = roundCurrency(subtotalByLine[index] ?? 0);
    const unitPriceWithoutIgv =
      quantity > 0
        ? roundUnitValue(targetImporteWithoutIgv / quantity)
        : 0;
    const importeWithoutIgv = roundCurrency(unitPriceWithoutIgv * quantity);
    const igv = roundCurrency((adjustedGrossByLine[index] ?? 0) - importeWithoutIgv);
    const totalLineWithIgv = roundCurrency(importeWithoutIgv + igv);

    return {
      quantity,
      unitCode: line.unitCode,
      unitPriceWithoutIgv,
      importeWithoutIgv,
      igv,
      totalWithIgv: totalLineWithIgv,
    };
  });

  const subtotalWithoutIgv = sumCurrency(
    computedLines.map((line) => line.importeWithoutIgv),
  );
  const totalFromLines = sumCurrency(computedLines.map((line) => line.totalWithIgv));
  const normalizedTotalWithIgv =
    targetTotalWithIgv === null || targetTotalWithIgv === undefined
      ? totalFromLines
      : totalWithIgv;
  const igv = roundCurrency(normalizedTotalWithIgv - subtotalWithoutIgv);

  return {
    subtotalWithoutIgv,
    igv,
    totalWithIgv: normalizedTotalWithIgv,
    lines: computedLines,
  };
};
