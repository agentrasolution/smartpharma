import { describe, expect, it, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    customer: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    chronicMedication: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    sale: {
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    arrear: {
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
    $transaction: vi.fn((cb: (tx: any) => Promise<any>) => cb(prismaMock)),
  };
  return { prismaMock };
});

vi.mock("../src/services/prisma", () => ({ prisma: prismaMock }));

import { customersService } from "../src/modules/customers/customers.service";

describe("customersService & Chronic Patient Refills (Pillar H)", () => {
  const scope = {
    pharmacyId: "pharmacy-1",
    branchId: "branch-1",
    userRole: "PHARMACIST",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a customer with complete medical profile and health data consent", async () => {
    prismaMock.customer.create.mockResolvedValueOnce({
      id: "cust-1",
      pharmacyId: "pharmacy-1",
      branchId: "branch-1",
      name: "Tariq Mansoor",
      phone: "+966501112233",
      address: "Al Olaya, Riyadh",
      nationalId: "1098765432",
      gender: "MALE",
      bloodGroup: "O+",
      allergies: ["Penicillin", "Sulfa drugs"],
      chronicConditions: ["Hypertension", "Type 2 Diabetes"],
      creditLimit: 500,
      allowCredit: true,
      consentGiven: true,
      consentDate: new Date("2026-09-30T10:00:00Z"),
      consentNotes: "Patient signed digital health records consent form",
    });

    const result = await customersService.create(scope, {
      name: "Tariq Mansoor",
      phone: "+966501112233",
      address: "Al Olaya, Riyadh",
      nationalId: "1098765432",
      gender: "MALE",
      bloodGroup: "O+",
      allergies: ["Penicillin", "Sulfa drugs"],
      chronicConditions: ["Hypertension", "Type 2 Diabetes"],
      creditLimit: 500,
      allowCredit: true,
      consentGiven: true,
      consentDate: "2026-09-30T10:00:00Z",
      consentNotes: "Patient signed digital health records consent form",
    });

    expect(result.id).toBe("cust-1");
    expect(prismaMock.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Tariq Mansoor",
          nationalId: "1098765432",
          allergies: ["Penicillin", "Sulfa drugs"],
          chronicConditions: ["Hypertension", "Type 2 Diabetes"],
          consentGiven: true,
          creditLimit: 500,
        }),
      })
    );
  });

  it("adds a chronic medication and auto-calculates nextRefillDate based on daysSupply", async () => {
    prismaMock.customer.findFirst.mockResolvedValueOnce({
      id: "cust-1",
      pharmacyId: "pharmacy-1",
      branchId: "branch-1",
      name: "Tariq Mansoor",
    });

    const lastDispensed = new Date("2026-09-01T00:00:00.000Z");
    const expectedNextRefill = new Date(lastDispensed.getTime() + 30 * 24 * 60 * 60 * 1000);

    prismaMock.chronicMedication.create.mockResolvedValueOnce({
      id: "med-1",
      customerId: "cust-1",
      medicationName: "Amlodipine 5mg",
      dosage: "1 tablet daily morning",
      frequency: "Daily",
      daysSupply: 30,
      lastDispensedDate: lastDispensed,
      nextRefillDate: expectedNextRefill,
      reminderActive: true,
      status: "ACTIVE",
    });

    const result = await customersService.addChronicMedication(scope, {
      customerId: "cust-1",
      medicationName: "Amlodipine 5mg",
      dosage: "1 tablet daily morning",
      frequency: "Daily",
      daysSupply: 30,
      lastDispensedDate: "2026-09-01T00:00:00.000Z",
    });

    expect(result.id).toBe("med-1");
    expect(result.nextRefillDate.getTime()).toBe(expectedNextRefill.getTime());
    expect(prismaMock.chronicMedication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: "cust-1",
          medicationName: "Amlodipine 5mg",
          daysSupply: 30,
        }),
      })
    );
  });

  it("correctly categorizes urgency in refill queue (OVERDUE, DUE_TODAY, DUE_SOON)", async () => {
    const now = new Date();
    const overdueDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    const dueTodayDate = new Date(now.getTime()); // today
    const dueSoonDate = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000); // 4 days from now

    prismaMock.chronicMedication.findMany.mockResolvedValueOnce([
      {
        id: "med-overdue",
        customerId: "cust-1",
        medicationName: "Metformin 500mg",
        dosage: "1 tab twice daily",
        frequency: "Twice daily",
        daysSupply: 30,
        lastDispensedDate: new Date("2026-08-01"),
        nextRefillDate: overdueDate,
        reminderActive: true,
        status: "ACTIVE",
        customer: { id: "cust-1", name: "Tariq", phone: "+966500", nationalId: "101" },
        product: { id: "p1", name: "Metformin", stockQty: 25, salePrice: 15 },
      },
      {
        id: "med-today",
        customerId: "cust-2",
        medicationName: "Atorvastatin 20mg",
        dosage: "1 tab at bedtime",
        frequency: "Nightly",
        daysSupply: 30,
        lastDispensedDate: new Date("2026-08-31"),
        nextRefillDate: dueTodayDate,
        reminderActive: true,
        status: "ACTIVE",
        customer: { id: "cust-2", name: "Layla", phone: "+966502", nationalId: "102" },
        product: { id: "p2", name: "Atorvastatin", stockQty: 10, salePrice: 45 },
      },
      {
        id: "med-soon",
        customerId: "cust-3",
        medicationName: "Lisinopril 10mg",
        dosage: "1 tab daily",
        frequency: "Daily",
        daysSupply: 30,
        lastDispensedDate: new Date("2026-09-04"),
        nextRefillDate: dueSoonDate,
        reminderActive: true,
        status: "ACTIVE",
        customer: { id: "cust-3", name: "Omar", phone: "+966503", nationalId: "103" },
        product: { id: "p3", name: "Lisinopril", stockQty: 50, salePrice: 20 },
      },
    ]);

    const queue = await customersService.getRefillQueue(scope);
    expect(queue.length).toBe(3);

    const overdue = queue.find((i) => i.id === "med-overdue");
    expect(overdue?.urgency).toBe("OVERDUE");

    const today = queue.find((i) => i.id === "med-today");
    expect(today?.urgency).toBe("DUE_TODAY");

    const soon = queue.find((i) => i.id === "med-soon");
    expect(soon?.urgency).toBe("DUE_SOON");
  });

  it("records contact attempt notes for a patient refill reminder", async () => {
    prismaMock.chronicMedication.findFirst.mockResolvedValueOnce({
      id: "med-1",
      pharmacyId: "pharmacy-1",
      customerId: "cust-1",
    });

    prismaMock.chronicMedication.update.mockResolvedValueOnce({
      id: "med-1",
      lastContactedAt: new Date(),
      contactNotes: "Called patient; confirmed they will pick up refill tomorrow morning",
    });

    const result = await customersService.recordContact(
      scope,
      "med-1",
      "Called patient; confirmed they will pick up refill tomorrow morning"
    );

    expect(result.contactNotes).toContain("pick up refill tomorrow morning");
    expect(prismaMock.chronicMedication.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactNotes: "Called patient; confirmed they will pick up refill tomorrow morning",
        }),
      })
    );
  });

  it("advances nextRefillDate when a chronic medication refill is recorded", async () => {
    prismaMock.chronicMedication.findFirst.mockResolvedValueOnce({
      id: "med-1",
      pharmacyId: "pharmacy-1",
      customerId: "cust-1",
      daysSupply: 30,
      notes: "Initial start",
    });

    const refillDate = new Date("2026-10-01T09:00:00Z");
    const nextExpected = new Date(refillDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    prismaMock.chronicMedication.update.mockResolvedValueOnce({
      id: "med-1",
      lastDispensedDate: refillDate,
      nextRefillDate: nextExpected,
      daysSupply: 30,
      notes: "Initial start\n[Refill 10/1/2026]: 30-day refill dispensed",
    });

    const result = await customersService.recordRefill(scope, "med-1", {
      dispensedDate: "2026-10-01T09:00:00Z",
      daysSupply: 30,
      notes: "30-day refill dispensed",
    });

    expect(result.lastDispensedDate).toEqual(refillDate);
    expect(result.nextRefillDate).toEqual(nextExpected);
  });

  it("computes customer statement running balance across credit purchases and settlements", async () => {
    prismaMock.customer.findFirst.mockResolvedValueOnce({
      id: "cust-1",
      pharmacyId: "pharmacy-1",
      branchId: "branch-1",
      name: "Tariq Mansoor",
      phone: "+966501112233",
      creditLimit: 1000,
      allowCredit: true,
      sales: [],
      arrears: [
        {
          id: "arr-1",
          saleId: "INV-001",
          totalBill: 300,
          amountPaid: 100,
          balanceDue: 200,
          createdAt: new Date("2026-09-10T10:00:00Z"),
          payments: [
            {
              id: "pay-1",
              amount: 100,
              paymentSaleId: "REC-001",
              createdAt: new Date("2026-09-15T12:00:00Z"),
            },
          ],
        },
      ],
    });

    const statement = await customersService.getStatement(scope, "cust-1");

    expect(statement.customer.name).toBe("Tariq Mansoor");
    expect(statement.entries.length).toBe(2);
    // Entry 1: Credit purchase of 300
    expect(statement.entries[0].debit).toBe(300);
    expect(statement.entries[0].runningBalance).toBe(300);
    // Entry 2: Settlement payment of 100
    expect(statement.entries[1].credit).toBe(100);
    expect(statement.entries[1].runningBalance).toBe(200);
    // Final balance
    expect(statement.summary.current_balance).toBe(200);
  });
});
