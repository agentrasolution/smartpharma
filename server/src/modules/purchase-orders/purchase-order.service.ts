import { prisma } from "../../services/prisma";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "../../utils/errors";
import { emitEvent } from "../../socket";
import type {
  CreatePurchaseOrderDraftInput,
} from "./purchase-order.schema";
import type { Prisma } from "../../generated/prisma/client";
import { auditService } from "../../audit/audit.service";
import type { BranchScope } from "../../middleware/auth";

export const PO_STATUS = {
  DRAFT: "DRAFT",
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

// Permissions derived from role (spec #46). "approve" is human-only.
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    "READ_INVENTORY",
    "ANALYZE_INVENTORY",
    "CREATE_PURCHASE_DRAFT",
    "SUBMIT_PURCHASE",
    "APPROVE_PURCHASE",
    "REJECT_PURCHASE",
    "FULL_CONTROL",
  ],
  manager: [
    "READ_INVENTORY",
    "ANALYZE_INVENTORY",
    "CREATE_PURCHASE_DRAFT",
    "SUBMIT_PURCHASE",
    "APPROVE_PURCHASE",
    "REJECT_PURCHASE",
  ],
  pharmacist: [
    "READ_INVENTORY",
    "ANALYZE_INVENTORY",
    "CREATE_PURCHASE_DRAFT",
  ],
  employee: ["READ_INVENTORY", "ANALYZE_INVENTORY"],
};

export function roleHasPermission(role: string, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] ?? ["READ_INVENTORY", "ANALYZE_INVENTORY"];
  return perms.includes(permission);
}

function poBranchWhere(scope: BranchScope): Prisma.PurchaseOrderWhereInput {
  return {
    pharmacyId: scope.pharmacyId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
  };
}

async function generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  const prefix = `PO-${yy}${mm}-`;
  const last = await tx.purchaseOrder.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
  });
  let nextNum = 1;
  if (last) {
    const match = /(\d+)$/.exec(last.orderNumber);
    nextNum = (match ? parseInt(match[1], 10) : 0) + 1;
  }
  return `${prefix}${nextNum.toString().padStart(6, "0")}`;
}

interface DraftItemSpec {
  productId: string;
  quantity: number;
  unitPrice?: number;
}

export const purchaseOrderService = {
  // Create a DRAFT purchase order. Idempotent on idempotencyKey (spec #59).
  async createDraft(
    scope: BranchScope,
    data: CreatePurchaseOrderDraftInput & { branchId?: string },
    actor: { userId: string; role: string },
  ) {
    if (!roleHasPermission(actor.role, "CREATE_PURCHASE_DRAFT")) {
      throw new UnauthorizedError("You do not have permission to create purchase orders");
    }

    // A branch operator always creates into their own branch. A cross-branch
    // admin may target a specific branch; falls back to the first active one.
    const targetBranchId =
      scope.branchId ?? data.branchId ?? (await firstBranchId(scope.pharmacyId));
    if (!targetBranchId) throw new BadRequestError("No branch available for the purchase order");
    await assertBranchInPharmacy(scope.pharmacyId, targetBranchId);
    if (scope.branchId && data.branchId && data.branchId !== scope.branchId) {
      throw new BadRequestError("Purchase orders can only be created for your own branch");
    }

    if (data.idempotencyKey) {
      const existing = await prisma.purchaseOrder.findFirst({
        where: {
          idempotencyKey: data.idempotencyKey,
          pharmacyId: scope.pharmacyId,
          branchId: targetBranchId,
        },
        include: { items: true, distributor: true },
      });
      if (existing) return existing;
    }

    const distributor = await prisma.distributor.findFirst({
      where: { id: data.distributorId, pharmacyId: scope.pharmacyId },
    });
    if (!distributor) throw new NotFoundError("Distributor");

    // Load all products up-front so we never trust AI/frontend quantities/prices.
    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        active: 1,
        pharmacyId: scope.pharmacyId,
        branchId: targetBranchId,
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    if (productMap.size !== productIds.length) {
      throw new BadRequestError("One or more products do not exist in this branch or are inactive");
    }

    const items = data.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = item.unitPrice ?? product.purchasePrice;
      if (unitPrice <= 0) {
        throw new BadRequestError(`Product ${product.name} has no purchase price`);
      }
      const total = Math.round(unitPrice * item.quantity * 100) / 100;
      return { ...item, unitPrice, total };
    });

    const subtotal = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;

    return prisma.$transaction(async (tx) => {
      const orderNumber = await generateOrderNumber(tx);
      const order = await tx.purchaseOrder.create({
        data: {
          orderNumber,
          pharmacyId: scope.pharmacyId,
          branchId: targetBranchId,
          distributorId: distributor.id,
          status: PO_STATUS.DRAFT,
          subtotal,
          total: subtotal,
          notes: data.notes ?? "",
          createdBy: actor.userId,
          idempotencyKey: data.idempotencyKey ?? null,
          items: {
            create: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              total: i.total,
            })),
          },
        },
      });
      // Re-read inside the transaction so the returned type carries the
      // included relations (the create payload type omits them).
      const orderWithRelations = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: { include: { product: true } }, distributor: true },
      });
      await auditService.record({
        userId: actor.userId,
        agentName: "PurchaseOrderService",
        action: "purchase_order.draft_created",
        inputJson: data.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        outputJson: { id: orderWithRelations.id, orderNumber: orderWithRelations.orderNumber, total: orderWithRelations.total },
        status: "SUCCESS",
        approvalRequired: false,
      });
      return orderWithRelations;
    });
  },

  async submitForApproval(scope: BranchScope, id: string, actor: { userId: string; role: string }) {
    if (!roleHasPermission(actor.role, "SUBMIT_PURCHASE")) {
      throw new UnauthorizedError("You do not have permission to submit purchase orders");
    }
    const order = await prisma.purchaseOrder.findFirst({ where: { id, ...poBranchWhere(scope) } });
    if (!order) throw new NotFoundError("Purchase order");
    if (order.status !== PO_STATUS.DRAFT) {
      throw new BadRequestError(`Only DRAFT purchase orders can be submitted (current: ${order.status})`);
    }
    const submitted = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: PO_STATUS.PENDING_APPROVAL },
      include: { items: { include: { product: true } }, distributor: true },
    });
    await auditService.record({
      userId: actor.userId,
      agentName: "PurchaseOrderService",
      action: "purchase_order.submitted",
      inputJson: { id, orderNumber: submitted.orderNumber },
      outputJson: { id: submitted.id, orderNumber: submitted.orderNumber, status: submitted.status },
      status: "SUCCESS",
      approvalRequired: true,
      approvalStatus: "PENDING_APPROVAL",
    });
    return submitted;
  },

  // HUMAN-ONLY. AI MUST NOT have this tool. Rollback-protected via $transaction.
  async approve(scope: BranchScope, id: string, actor: { userId: string; role: string }) {
    if (!roleHasPermission(actor.role, "APPROVE_PURCHASE")) {
      throw new UnauthorizedError("Only managers/admins can approve purchase orders");
    }
    const order = await prisma.purchaseOrder.findFirst({
      where: { id, ...poBranchWhere(scope) },
      include: { items: true },
    });
    if (!order) throw new NotFoundError("Purchase order");
    if (order.status !== PO_STATUS.PENDING_APPROVAL) {
      throw new BadRequestError(`Only PENDING_APPROVAL purchase orders can be approved (current: ${order.status})`);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: PO_STATUS.APPROVED,
          approvedBy: actor.userId,
          approvedAt: new Date(),
        },
        include: { items: { include: { product: true } }, distributor: true, company: true },
      });

      // Goods receipt: raise stock and record the purchase history atomically.
      const quantities = new Map<string, number>();
      for (const item of updated.items) {
        quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
      }
      for (const [productId, quantity] of quantities) {
        const item = updated.items.find((i) => i.productId === productId)!;
        await tx.product.update({
          where: { id: productId },
          data: { stockQty: { increment: quantity } },
        });
        const stockPurchase = await tx.stockPurchase.create({
          data: {
            pharmacyId: updated.pharmacyId,
            branchId: updated.branchId,
            productId,
            distributorId: updated.distributorId,
            companyId: updated.company?.id ?? null,
            invoiceNumber: updated.orderNumber,
            quantity,
            purchasePrice: item.unitPrice,
            salePrice: item.product.salePrice,
            expiry: item.product.expiry ?? null,
            totalValue: Math.round(item.unitPrice * quantity * 100) / 100,
          },
        });
        emitEvent("stock:updated", stockPurchase);
      }

      await auditService.record({
        userId: actor.userId,
        agentName: "PurchaseOrderService",
        action: "purchase_order.approved",
        inputJson: { id, orderNumber: updated.orderNumber },
        outputJson: { id: updated.id, orderNumber: updated.orderNumber, total: updated.total, stockIn: updated.items.map((i) => ({ productId: i.productId, quantity: i.quantity })) },
        status: "SUCCESS",
        approvalRequired: true,
        approvalStatus: "APPROVED",
        approvedBy: actor.userId,
      });
      return updated;
    });
  },

  async reject(
    scope: BranchScope,
    id: string,
    actor: { userId: string; role: string },
    reason: string,
  ) {
    if (!roleHasPermission(actor.role, "REJECT_PURCHASE")) {
      throw new UnauthorizedError("Only managers/admins can reject purchase orders");
    }
    const order = await prisma.purchaseOrder.findFirst({ where: { id, ...poBranchWhere(scope) } });
    if (!order) throw new NotFoundError("Purchase order");
    const rejectable = new Set<string>([PO_STATUS.PENDING_APPROVAL, PO_STATUS.DRAFT]);
    if (!rejectable.has(order.status)) {
      throw new BadRequestError(`Cannot reject order in ${order.status} state`);
    }
    const rejected = await prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PO_STATUS.REJECTED,
        rejectedBy: actor.userId,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
      include: { items: { include: { product: true } }, distributor: true },
    });
    await auditService.record({
      userId: actor.userId,
      agentName: "PurchaseOrderService",
      action: "purchase_order.rejected",
      inputJson: { id, orderNumber: rejected.orderNumber, reason },
      outputJson: { id: rejected.id, orderNumber: rejected.orderNumber, status: rejected.status },
      status: "SUCCESS",
      approvalRequired: true,
      approvalStatus: "REJECTED",
      approvedBy: actor.userId,
    });
    return rejected;
  },

  async list(scope: BranchScope, opts?: { status?: string; search?: string; from?: string; to?: string }) {
    const where: Prisma.PurchaseOrderWhereInput = {
      ...poBranchWhere(scope),
    };
    if (opts?.status) where.status = opts.status;
    if (opts?.from || opts?.to) {
      const toDate = opts?.to ? new Date(opts.to) : null;
      if (toDate) toDate.setDate(toDate.getDate() + 1);
      where.createdAt = {
        ...(opts.from ? { gte: new Date(opts.from) } : {}),
        ...(toDate ? { lt: toDate } : {}),
      };
    }
    const orders = await prisma.purchaseOrder.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        distributor: true,
        items: { include: { product: true } },
      },
    });
    // Mark orders created by the AI agent so the approvals UI can distinguish
    // AI-generated drafts from manual ones (spec: human-only approval of AI drafts).
    const aiLogs = await prisma.aIAuditLog.findMany({
      where: { toolName: "create_purchase_order_draft" },
      select: { outputJson: true },
      take: 500,
    });
    const aiOrderIds = new Set<string>();
    for (const log of aiLogs) {
      const id =
        (log.outputJson as { data?: { id?: string } } | null)?.data?.id ??
        (log.outputJson as { id?: string } | null)?.id ??
        null;
      if (id) aiOrderIds.add(id);
    }
    let result = orders.map((o) => ({ ...o, aiGenerated: aiOrderIds.has(o.id) }));
    if (opts?.search) {
      const q = opts.search.trim().toLowerCase();
      if (q) {
        result = result.filter(
          (o) =>
            o.orderNumber.toLowerCase().includes(q) ||
            (o.distributor?.name ?? "").toLowerCase().includes(q),
        );
      }
    }
    return result;
  },

  async getById(scope: BranchScope, id: string) {
    const order = await prisma.purchaseOrder.findFirst({
      where: { id, ...poBranchWhere(scope) },
      include: {
        distributor: true,
        items: { include: { product: true } },
      },
    });
    if (!order) throw new NotFoundError("Purchase order");
    return order;
  },
};

async function firstBranchId(pharmacyId: string): Promise<string | null> {
  const branch = await prisma.branch.findFirst({
    where: { pharmacyId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return branch?.id ?? null;
}

async function assertBranchInPharmacy(pharmacyId: string, branchId: string) {
  const branch = await prisma.branch.findFirst({ where: { id: branchId, pharmacyId } });
  if (!branch) throw new BadRequestError("Branch does not belong to this pharmacy");
}