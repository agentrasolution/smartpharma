let lastReceiptData: unknown = null;

export function setLastReceipt(data: unknown) {
  lastReceiptData = data;
}

export function getLastReceipt() {
  return lastReceiptData;
}
