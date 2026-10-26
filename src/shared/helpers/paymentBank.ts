export const getAutomaticPaymentBank = (paymentMethod: string) =>
  paymentMethod === "YAPE" || paymentMethod === "TARJETA" ? "BCP" : null;
