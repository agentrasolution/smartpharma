export function normalizeProduct(product: any): any {
  if (!product) return null;
  return {
    id: product.id,
    barcode: product.barcode,
    name: product.name,
    company: product.company,
    category: product.category,
    location: product.location,
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
