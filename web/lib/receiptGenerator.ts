export function generateReceiptHTML(sale: any, paperSize: string = "thermal"): { success: boolean; html: string; error?: string } {
  try {
    const isA4 = paperSize === "a4";
    const isA5 = paperSize === "a5";
    const isThermal = !isA4 && !isA5;

    const invoiceNo = sale?.id || sale?.invoiceNumber || "INV-" + Date.now().toString().slice(-6);
    const dateStr = sale?.createdAt ? new Date(sale.createdAt).toLocaleDateString() : new Date().toLocaleDateString();
    const timeStr = sale?.createdAt ? new Date(sale.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const cashierName = sale?.cashierName || sale?.user?.username || "Cashier";
    const customerName = sale?.customer?.name || (typeof sale?.customer === "string" ? sale.customer : "Walk-in Customer");
    const currency = sale?.currency || "SAR";

    const items = (sale?.items || []).map((it: any) => {
      const name = it.productName || it.product?.nameEn || it.name || "Item";
      const qty = Number(it.quantity || 1);
      const price = Number(it.unitPrice || it.price || 0);
      const total = Number(it.subtotal || it.total || qty * price);
      const batch = it.batchNumber || it.batch?.batchNumber || "";
      return { name, qty, price, total, batch };
    });

    const subtotal = Number(sale?.subtotal || items.reduce((s: number, i: any) => s + i.total, 0));
    const discount = Number(sale?.discount || 0);
    const tax = Number(sale?.tax || sale?.vat || 0);
    const totalAmount = Number(sale?.totalAmount || sale?.total || (subtotal - discount + tax));
    const paymentMethod = sale?.paymentMethod || "CASH";
    const cashReceived = Number(sale?.cashReceived || sale?.amountReceived || totalAmount);
    const change = Math.max(0, cashReceived - totalAmount);

    if (isA4 || isA5) {
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice #${invoiceNo}</title>
  <style>
    @page { size: ${isA4 ? "A4" : "A5"}; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 13px; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0284c7; padding-bottom: 15px; margin-bottom: 20px; }
    .title { font-size: 24px; font-weight: 800; color: #0284c7; margin: 0; }
    .meta { font-size: 12px; color: #64748b; line-height: 1.5; }
    .bill-to { margin-bottom: 20px; padding: 12px; background: #f8fafc; border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #f1f5f9; padding: 10px; text-align: left; font-size: 12px; font-weight: 600; border-bottom: 1px solid #cbd5e1; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
    .num { text-align: right; }
    .summary { width: 300px; margin-left: auto; line-height: 2; font-size: 13px; }
    .summary-row { display: flex; justify-content: space-between; }
    .summary-row.total { font-weight: 700; font-size: 16px; border-top: 2px solid #0284c7; padding-top: 6px; color: #0284c7; }
    .footer { margin-top: 40px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 15px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">SMARTPHARMA</h1>
      <div class="meta">Advanced Pharmacy Healthcare ERP<br>VAT ID: 300000000000003</div>
    </div>
    <div style="text-align: right;">
      <h2 style="margin: 0; font-size: 18px;">TAX INVOICE</h2>
      <div class="meta">
        <strong>Invoice:</strong> #${invoiceNo}<br>
        <strong>Date:</strong> ${dateStr} ${timeStr}<br>
        <strong>Cashier:</strong> ${cashierName}
      </div>
    </div>
  </div>

  <div class="bill-to">
    <strong>Bill To:</strong> ${customerName}
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 45%;">Item Description</th>
        <th>Batch</th>
        <th class="num">Qty</th>
        <th class="num">Unit Price</th>
        <th class="num">Total (${currency})</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((i: any) => `
        <tr>
          <td><strong>${i.name}</strong></td>
          <td style="color: #64748b; font-size: 11px;">${i.batch || "—"}</td>
          <td class="num">${i.qty}</td>
          <td class="num">${i.price.toFixed(2)}</td>
          <td class="num">${i.total.toFixed(2)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="summary">
    <div class="summary-row"><span>Subtotal:</span><span>${subtotal.toFixed(2)} ${currency}</span></div>
    ${discount > 0 ? `<div class="summary-row" style="color: #16a34a;"><span>Discount:</span><span>-${discount.toFixed(2)} ${currency}</span></div>` : ""}
    <div class="summary-row"><span>VAT:</span><span>${tax.toFixed(2)} ${currency}</span></div>
    <div class="summary-row total"><span>Total Payable:</span><span>${totalAmount.toFixed(2)} ${currency}</span></div>
    <div class="summary-row" style="margin-top: 6px;"><span>Payment Method:</span><span>${paymentMethod}</span></div>
  </div>

  <div class="footer">
    Thank you for choosing SmartPharma. For medical advice, please consult your registered pharmacist.
  </div>
</body>
</html>`;
      return { success: true, html };
    }

    // Thermal Receipt (80mm)
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt #${invoiceNo}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body {
      width: 72mm;
      margin: 0 auto;
      padding: 8px 4px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Courier, monospace;
      font-size: 12px;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 700; }
    .h1 { font-size: 16px; font-weight: 800; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .sub { font-size: 10px; margin: 2px 0; color: #333; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .divider-double { border-top: 2px solid #000; margin: 6px 0; }
    .info { font-size: 10.5px; line-height: 1.3; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    th { font-size: 10.5px; border-bottom: 1px dashed #000; padding: 2px 0; text-align: left; }
    td { font-size: 11px; padding: 3px 0; vertical-align: top; }
    .totals { width: 100%; font-size: 11px; margin-top: 4px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
    .grand-total { font-size: 13.5px; font-weight: 800; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin: 4px 0; }
    .footer { text-align: center; font-size: 9.5px; margin-top: 10px; line-height: 1.3; color: #444; }
  </style>
</head>
<body>
  <div class="center">
    <div class="h1">SmartPharma</div>
    <div class="sub">Advanced Community Pharmacy</div>
    <div class="sub">VAT No: 300000000000003</div>
  </div>

  <div class="divider"></div>

  <div class="info">
    <div class="row"><span>Inv: #${invoiceNo.slice(-8)}</span><span>${dateStr}</span></div>
    <div class="row"><span>Cashier: ${cashierName}</span><span>${timeStr}</span></div>
    <div class="row"><span>Customer: ${customerName}</span></div>
  </div>

  <div class="divider"></div>

  <table>
    <thead>
      <tr>
        <th style="width: 50%;">Item</th>
        <th class="right" style="width: 15%;">Qty</th>
        <th class="right" style="width: 35%;">Price</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((i: any) => `
        <tr>
          <td>
            <div class="bold">${i.name}</div>
            ${i.batch ? `<div style="font-size: 9px; color: #555;">B: ${i.batch}</div>` : ""}
          </td>
          <td class="right">${i.qty}</td>
          <td class="right">${i.total.toFixed(2)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="divider"></div>

  <div class="totals">
    <div class="row"><span>Subtotal:</span><span>${subtotal.toFixed(2)} ${currency}</span></div>
    ${discount > 0 ? `<div class="row"><span>Discount:</span><span>-${discount.toFixed(2)} ${currency}</span></div>` : ""}
    <div class="row"><span>VAT:</span><span>${tax.toFixed(2)} ${currency}</span></div>
    <div class="row grand-total"><span>TOTAL:</span><span>${totalAmount.toFixed(2)} ${currency}</span></div>
    <div class="row"><span>Tender (${paymentMethod}):</span><span>${cashReceived.toFixed(2)} ${currency}</span></div>
    ${change > 0 ? `<div class="row"><span>Change:</span><span>${change.toFixed(2)} ${currency}</span></div>` : ""}
  </div>

  <div class="divider"></div>

  <div class="footer">
    <div>*** THANK YOU FOR YOUR VISIT ***</div>
    <div>Prescriptions and returns valid within 3 days with original receipt.</div>
    <div style="margin-top: 4px; font-size: 8.5px;">Powered by SmartPharma ERP</div>
  </div>
</body>
</html>`;

    return { success: true, html };
  } catch (err: any) {
    return { success: false, html: "", error: err?.message || "Failed to generate receipt" };
  }
}

export function generateReturnReceiptHTML(returnData: any, sale: any, paperSize: string = "thermal"): { success: boolean; html: string; error?: string } {
  try {
    const isThermal = paperSize === "thermal";
    const dateStr = new Date().toLocaleDateString();
    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const refundAmount = Number(returnData?.refund_amount || returnData?.refundAmount || 0);
    const reason = returnData?.reason || "Customer return";
    const items = returnData?.items || [];

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Return Receipt</title>
  <style>
    @page { size: ${isThermal ? "80mm auto" : "A4"}; margin: 0; }
    body {
      width: ${isThermal ? "72mm" : "180mm"};
      margin: 0 auto;
      padding: 10px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 12px;
      color: #000;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: 700; }
    .badge { color: #dc2626; font-size: 14px; font-weight: 800; letter-spacing: 1px; }
    .divider { border-top: 1px dashed #000; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; border-bottom: 1px dashed #000; padding: 4px 0; }
    td { font-size: 11px; padding: 4px 0; }
  </style>
</head>
<body>
  <div class="center">
    <h2>SMARTPHARMA</h2>
    <div class="badge">** RETURN & REFUND VOUCHER **</div>
    <div style="font-size: 10px; margin-top: 4px;">Date: ${dateStr} ${timeStr}</div>
    <div style="font-size: 10px;">Original Sale: #${sale?.id ? String(sale.id).slice(0, 10) : "N/A"}</div>
  </div>

  <div class="divider"></div>

  <table>
    <thead>
      <tr>
        <th>Returned Item</th>
        <th class="right">Qty</th>
        <th class="right">Refund</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((it: any) => `
        <tr>
          <td>${it.product_name || it.name || "Item"}</td>
          <td class="right">${it.quantity}</td>
          <td class="right">${Number(it.refund_amount || it.subtotal || 0).toFixed(2)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="divider"></div>

  <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 13px;">
    <span>Total Refund:</span>
    <span>${refundAmount.toFixed(2)}</span>
  </div>
  <div style="font-size: 11px; margin-top: 4px; color: #444;">Reason: ${reason}</div>

  <div class="divider"></div>
  <div class="center" style="font-size: 10px; color: #666;">
    Return accepted & inventory updated.<br>
    Powered by SmartPharma ERP
  </div>
</body>
</html>`;

    return { success: true, html };
  } catch (err: any) {
    return { success: false, html: "", error: err?.message || "Failed to generate return receipt" };
  }
}
