export type BillingProcessType = "BETA" | "PRODUCCION";

export interface BillingConfigSummary {
  hasCertificate: boolean;
  certificateName: string;
  certificateBase64: string | null;
  certificateExpiresAt: string | null;
  certificatePassword: string;
  solUser: string;
  solPassword: string;
  processType: BillingProcessType;
  updatedAt: string | null;
}

export interface SaveBillingConfigPayload {
  certificateFile?: File | null;
  certificatePassword: string;
  solUser: string;
  solPassword: string;
  processType: BillingProcessType;
}
