/** Retira referencias de exportación y los signos que no admite el sistema de destino. */
export const cleanCustomerName = (value: string): string =>
  value.replace(/\[?EXP[0-9]{2}-[0-9]{2}-[0-9]{4}\]?/gi, "").replace(/[.,{}\[\]]/g, "");
