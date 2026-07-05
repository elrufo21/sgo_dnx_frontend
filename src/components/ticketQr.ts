import QRCode from "qrcode";

export const generateTicketQrBase64 = async (qrData: string) => {
  const safeQrData = String(qrData ?? "").trim();
  if (!safeQrData) return "";

  try {
    return await QRCode.toDataURL(safeQrData, {
      margin: 1,
      scale: 4,
    });
  } catch {
    return "";
  }
};
