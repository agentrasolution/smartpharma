let lastReceiptData: unknown = null;

export function setLastReceipt(data: unknown) {
  lastReceiptData = data;
  try {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("smartpharma_last_receipt", JSON.stringify(data));
    }
  } catch {}
}

export function getLastReceipt() {
  if (lastReceiptData) return lastReceiptData;
  try {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("smartpharma_last_receipt");
      if (stored) {
        lastReceiptData = JSON.parse(stored);
        return lastReceiptData;
      }
    }
  } catch {}
  return null;
}
