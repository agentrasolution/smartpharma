import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { randomUUID } from "crypto";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// Deterministic PRNG (mulberry32) so re-seeding produces identical demo data.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260801);

const DEMO_MARKER = "Demo Pharmacy Seed v1";

// Clearly-labeled demo distributors with per-distributor lead-time config.
const DISTRIBUTORS = [
  { name: "Demo: Medisales (PVT) Ltd.", contact: "Mr. Khalid", phone: "0300-1112233", address: "Shahrah-e-Faisal, Karachi", leadTimeDays: 3, minimumOrderValue: 5000 },
  { name: "Demo: Fazal Din & Sons", contact: "Mr. Aftab", phone: "0300-7778899", address: "Jodia Bazar, Karachi", leadTimeDays: 5, minimumOrderValue: 10000 },
  { name: "Demo: Ali Gohar Pharmaceuticals", contact: "Mr. Sajid", phone: "0301-5554433", address: "Super Highway, Karachi", leadTimeDays: 2, minimumOrderValue: 2000 },
];

// name, barcode, company, category, location, salePrice, purchasePrice, packSize, distributorIdx
const PRODUCTS: Array<{
  name: string;
  barcode: string;
  company: string;
  category: string;
  salePrice: number;
  purchasePrice: number;
  packSize: number;
  distributorIdx: number;
  expiryDaysFromNow: number;
  // stock: units on hand now
  stock: number;
  // dailySales: approximate avg units sold per day (used to build history)
  dailySales: number;
}> = [
  { name: "Amoxil 250mg Cap", barcode: "8961000110031", company: "GSK", category: "Antibiotics", salePrice: 45, purchasePrice: 28, packSize: 10, distributorIdx: 0, expiryDaysFromNow: 400, stock: 12, dailySales: 4 },
  { name: "Augmentin 625mg Tab", barcode: "8961000220040", company: "GSK", category: "Antibiotics", salePrice: 240, purchasePrice: 170, packSize: 14, distributorIdx: 0, expiryDaysFromNow: 300, stock: 30, dailySales: 6 },
  { name: "Brufen 400mg Tab", barcode: "8901260330091", company: "Abbott", category: "Pain Relief", salePrice: 60, purchasePrice: 38, packSize: 20, distributorIdx: 1, expiryDaysFromNow: 500, stock: 80, dailySales: 1 },
  { name: "Coversyl 5mg Tab", barcode: "8901260440107", company: "Servier", category: "Cardiac", salePrice: 180, purchasePrice: 120, packSize: 14, distributorIdx: 2, expiryDaysFromNow: 600, stock: 25, dailySales: 2 },
  { name: "Disprin 300mg Tab", barcode: "8901260550214", company: "Reckitt", category: "Pain Relief", salePrice: 18, purchasePrice: 10, packSize: 10, distributorIdx: 1, expiryDaysFromNow: 700, stock: 150, dailySales: 0.4 },
  { name: "Flagyl 400mg Tab", barcode: "8961000660321", company: "Sanofi", category: "Antibiotics", salePrice: 55, purchasePrice: 34, packSize: 20, distributorIdx: 0, expiryDaysFromNow: 350, stock: 9, dailySales: 2 },
  { name: "Glucophage 500mg Tab", barcode: "8901260770438", company: "Merck", category: "Diabetes", salePrice: 75, purchasePrice: 48, packSize: 20, distributorIdx: 2, expiryDaysFromNow: 450, stock: 40, dailySales: 3 },
  { name: "Lasix 40mg Tab", barcode: "8901260880545", company: "Sanofi", category: "Cardiac", salePrice: 35, purchasePrice: 20, packSize: 20, distributorIdx: 1, expiryDaysFromNow: 200, stock: 3, dailySales: 2 },
  { name: "Neurobion Tab", barcode: "8901260990652", company: "E-Merck", category: "Vitamins", salePrice: 95, purchasePrice: 62, packSize: 30, distributorIdx: 2, expiryDaysFromNow: 800, stock: 50, dailySales: 0 },
  { name: "Panadol 500mg Tab", barcode: "8901360087453", company: "GSK", category: "Pain Relief", salePrice: 30, purchasePrice: 18, packSize: 12, distributorIdx: 0, expiryDaysFromNow: 25, stock: 7, dailySales: 3 },
  { name: "Rivotril 0.5mg Tab", barcode: "8901260100764", company: "Roche", category: "Neuro", salePrice: 120, purchasePrice: 80, packSize: 10, distributorIdx: 1, expiryDaysFromNow: 500, stock: 8, dailySales: 1 },
  { name: "Strepsils (Honey) Lozenges", barcode: "8901260210871", company: "Reckitt", category: "Throat", salePrice: 60, purchasePrice: 36, packSize: 6, distributorIdx: 0, expiryDaysFromNow: 90, stock: 22, dailySales: 2 },
  { name: "Ventolin Inhaler", barcode: "8961000320988", company: "GSK", category: "Respiratory", salePrice: 550, purchasePrice: 420, packSize: 1, distributorIdx: 2, expiryDaysFromNow: 300, stock: 60, dailySales: 0.5 },
  { name: "Arinac Forte Cap", barcode: "8961000430095", company: "Sanofi", category: "Cold & Flu", salePrice: 85, purchasePrice: 56, packSize: 10, distributorIdx: 1, expiryDaysFromNow: 45, stock: 6, dailySales: 2 },
  { name: "Augmentin Syrup 70ml", barcode: "8961000540102", company: "GSK", category: "Antibiotics", salePrice: 250, purchasePrice: 180, packSize: 5, distributorIdx: 0, expiryDaysFromNow: 120, stock: 15, dailySales: 1.5 },
];

function isoDaysFromNow(days: number): string {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function main() {
  const seeded = await prisma.company.findFirst({ where: { name: DEMO_MARKER } });
  if (seeded) {
    console.log("Demo data already present, skipping seed");
    return;
  }

  const company = await prisma.company.create({
    data: {
      name: DEMO_MARKER,
      contact: "Demo Contact",
      phone: "0300-0000000",
      address: "Demo Address",
    },
  });

  const distributors: string[] = [];
  for (const d of DISTRIBUTORS) {
    const dist = await prisma.distributor.create({
      data: {
        name: d.name,
        contact: d.contact,
        phone: d.phone,
        address: d.address,
        companyId: company.id,
        inventoryConfig: {
          create: {
            defaultLeadTimeDays: d.leadTimeDays,
            minimumOrderValue: d.minimumOrderValue,
            active: 1,
          },
        },
      },
    });
    distributors.push(dist.id);
  }

  // Build sale items spread over the last ~35 days so the engine sees real
  // demand. Each product has its own dailySales rate.
  const now = Date.now();
  const saleItems: Array<{
    saleId: string;
    createdAt: Date;
    items: Array<{ productId: string; productName: string; barcode: string; quantity: number; unitPrice: number; subtotal: number }>;
  }> = [];

  for (const p of PRODUCTS) {
    const productId = randomUUID();
    const created = await prisma.product.create({
      data: {
        id: productId,
        barcode: p.barcode,
        name: p.name,
        company: p.company,
        category: p.category,
        location: "Shelf A",
        distributor: { connect: { id: distributors[p.distributorIdx] } },
        salePrice: p.salePrice,
        purchasePrice: p.purchasePrice,
        markupPercent: Math.round(((p.salePrice - p.purchasePrice) / p.purchasePrice) * 100),
        stockQty: p.stock,
        expiry: isoDaysFromNow(p.expiryDaysFromNow),
        packSize: p.packSize,
        active: 1,
        distributorConfigs: {
          create: {
            distributor: { connect: { id: distributors[p.distributorIdx] } },
            leadTimeDays: DISTRIBUTORS[p.distributorIdx].leadTimeDays,
            minimumOrderQty: p.packSize,
            purchasePrice: p.purchasePrice,
            preferred: 1,
          },
        },
      },
    });

    await prisma.stockPurchase.create({
      data: {
        product: { connect: { id: productId } },
        distributor: { connect: { id: distributors[p.distributorIdx] } },
        company: { connect: { id: company.id } },
        invoiceNumber: `DEMO-INV-${p.barcode.slice(-6)}`,
        quantity: p.stock,
        purchasePrice: p.purchasePrice,
        salePrice: p.salePrice,
        expiry: isoDaysFromNow(p.expiryDaysFromNow),
        totalValue: Math.round(p.stock * p.purchasePrice * 100) / 100,
        active: 1,
      },
    });

    // Daily sales history: mostly a few sales per product per day.
    const dailyRate = p.dailySales;
    if (dailyRate > 0) {
      for (let day = 0; day < 35; day++) {
        const occurrences = dailyRate < 1 ? (rand() < dailyRate ? 1 : 0) : Math.round(dailyRate + (rand() - 0.5));
        for (let i = 0; i < occurrences; i++) {
          const saleId = randomUUID();
          const quantity = 1 + Math.floor(rand() * 3);
          const createdAt = new Date(now - day * 86400000 - (3 + Math.floor(rand() * 540)) * 60000);
          saleItems.push({
            saleId,
            createdAt,
            items: [
              {
                productId,
                productName: p.name,
                barcode: p.barcode,
                quantity,
                unitPrice: p.salePrice,
                subtotal: p.salePrice * quantity,
              },
            ],
          });
        }
      }
    }
  }

  // Persist sales (grouped by sale). Created earlier in the window so the
  // status is "paid" (the engine only counts paid sales).
  for (const s of saleItems) {
    const total = s.items.reduce((sum, i) => sum + i.subtotal, 0);
    await prisma.sale.create({
      data: {
        id: s.saleId,
        subtotal: total,
        discount: 0,
        total,
        amountPaid: total,
        change: 0,
        status: "paid",
        createdAt: s.createdAt,
        items: { create: s.items },
      },
    });
  }

  await prisma.inventoryConfig.upsert({
    where: { id: "demo-default" },
    update: {},
    create: {
      id: "demo-default",
      defaultSafetyStockDays: 2,
      defaultTargetStockDays: 14,
      defaultAnalysisDays: 30,
      lowStockThreshold: 10,
      overstockCoverageDays: 90,
      trendThresholdPercent: 15,
    },
  });

  console.log(`Seeded demo data: ${PRODUCTS.length} products, ${DISTRIBUTORS.length} distributors, ${saleItems.length} sales, company marker "${DEMO_MARKER}".`);
  console.log("Demo products are labeled with 'Demo:' distributors and the demo company marker so they can be cleared easily.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());