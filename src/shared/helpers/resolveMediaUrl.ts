import { buildRootApiUrl } from "@/config";

export const resolveMediaUrl = (value?: string | null) => {
  const url = String(value ?? "").trim();
  if (!url || /^(?:https?:|data:|blob:)/i.test(url)) return url;
  return buildRootApiUrl(url);
};
