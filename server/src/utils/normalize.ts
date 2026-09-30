export function normalizeProduct(product: any): any {
  if (!product) return null;
  return {
    id: product.id,
    barcode: product.barcode,
    name: product.name,
    company: product.company,
    category: product.category,
    location: product.location,
    pharmacy_id: product.pharmacyId ?? null,
    branch_id: product.branchId ?? null,
    distributor_id: product.distributorId ?? null,
    sale_price: product.salePrice ?? 0,
    purchase_price: product.purchasePrice ?? 0,
    markup_percent: product.markupPercent ?? 20,
    stock_qty: product.stockQty ?? 0,
    pack_size: product.packSize ?? 1,
    expiry: product.expiry ?? null,
    active: product.active ?? 1,
    created_at: product.createdAt?.toISOString?.() ?? product.createdAt,
    prices: product.prices?.map((p: any) => ({
      id: p.id,
      productId: p.productId,
      label: p.label,
      purchasePrice: p.purchasePrice,
      salePrice: p.salePrice,
    })) ?? [],
  };
}

export function normalizeProductList(products: any[]): any[] {
  return products.map(normalizeProduct);
}

export function normalizeStockPurchase(purchase: any): any {
  if (!purchase) return null;
  return {
    id: purchase.id,
    product_id: purchase.productId,
    product_name: purchase.product?.name ?? null,
    distributor_id: purchase.distributorId ?? null,
    distributor_name: purchase.distributor?.name ?? null,
    company_id: purchase.companyId ?? null,
    company_name: purchase.company?.name ?? null,
    invoice_number: purchase.invoiceNumber ?? "",
    quantity: purchase.quantity ?? 0,
    purchase_price: purchase.purchasePrice ?? 0,
    sale_price: purchase.salePrice ?? 0,
    expiry: purchase.expiry ?? null,
    active: purchase.active ?? 1,
    total_value: purchase.totalValue ?? 0,
    created_at: purchase.createdAt?.toISOString?.() ?? purchase.createdAt,
  };
}

export function normalizeStockPurchaseList(purchases: any[]): any[] {
  return purchases.map(normalizeStockPurchase);
}

export function normalizePurchaseInvoice(invoice: any): any {
  if (!invoice) return null;
  return {
    id: invoice.id,
    pharmacyId: invoice.pharmacyId,
    branchId: invoice.branchId,
    distributorId: invoice.distributorId,
    distributorName: invoice.distributor?.name ?? null,
    distributorPhone: invoice.distributor?.phone ?? null,
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.invoiceDate instanceof Date ? invoice.invoiceDate.toISOString() : invoice.invoiceDate,
    dueDate: invoice.dueDate instanceof Date ? invoice.dueDate.toISOString() : invoice.dueDate ?? null,
    subtotal: Number(invoice.subtotal ?? 0),
    discount: Number(invoice.discount ?? 0),
    tax: Number(invoice.tax ?? 0),
    totalAmount: Number(invoice.totalAmount ?? 0),
    paidAmount: Number(invoice.paidAmount ?? 0),
    balanceDue: Number(invoice.balanceDue ?? 0),
    status: invoice.status,
    paymentMethod: invoice.paymentMethod ?? null,
    notes: invoice.notes ?? "",
    receivedBy: invoice.receivedBy ?? null,
    createdAt: invoice.createdAt instanceof Date ? invoice.createdAt.toISOString() : invoice.createdAt,
    updatedAt: invoice.updatedAt instanceof Date ? invoice.updatedAt.toISOString() : invoice.updatedAt,
    distributor: invoice.distributor ? {
      id: invoice.distributor.id,
      name: invoice.distributor.name,
      phone: invoice.distributor.phone,
      contact: invoice.distributor.contact,
    } : undefined,
    items: invoice.items?.map((item: any) => ({
      id: item.id,
      invoiceId: item.invoiceId,
      productId: item.productId,
      productName: item.product?.name ?? null,
      productBarcode: item.product?.barcode ?? null,
      batchId: item.batchId ?? null,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate instanceof Date ? item.expiryDate.toISOString() : item.expiryDate,
      quantityPacks: item.quantityPacks,
      unitsPerPack: item.unitsPerPack,
      quantityBaseUnits: item.quantityBaseUnits,
      unitCost: Number(item.unitCost ?? 0),
      salePrice: Number(item.salePrice ?? 0),
      totalCost: Number(item.totalCost ?? 0),
    })) ?? [],
    payments: invoice.payments?.map((payment: any) => ({
      id: payment.id,
      amount: Number(payment.amount ?? 0),
      paymentMethod: payment.paymentMethod,
      referenceNumber: payment.referenceNumber,
      paidAt: payment.paidAt instanceof Date ? payment.paidAt.toISOString() : payment.paidAt,
      notes: payment.notes,
    })) ?? [],
  };
}

export function normalizePurchaseInvoiceList(invoices: any[]): any[] {
  return invoices.map(normalizePurchaseInvoice);
}
