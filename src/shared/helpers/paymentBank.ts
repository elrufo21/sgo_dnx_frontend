export const getAutomaticPaymentBank = (paymentMethod: string) =>
  ["YAPE", "YAPE/EFECTIVO", "TARJETA"].includes(paymentMethod)
    ? "BCP"
    : null;
