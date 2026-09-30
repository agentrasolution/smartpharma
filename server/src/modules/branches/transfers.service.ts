import { prisma } from "../../services/prisma";
import { BadRequestError, NotFoundError } from "../../utils/errors";
import type { BranchScope } from "../../middleware/auth";
import type {
  CreateTransferInput,
  BranchPriceOverrideInput,
  CrossBranchStockQuery,
} from "./transfers.schema";

function generateTransferNumber(): string {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  return `TRF-${year}-${randomSuffix}`;
}

export const transfersService = {
  async createTransfer(
    scope: BranchScope,
    input: CreateTransferInput,
    user: { id: string; name: string },
  ) {
    if (input.sourceBranchId === input.destinationBranchId) {
      throw new BadRequestError("Source and destination branches cannot be the same");
    }

    // Verify both branches belong to the pharmacy
    const [sourceBranch, destBranch] = await Promise.all([
      prisma.branch.findFirst({
        where: { id: input.sourceBranchId, pharmacyId: scope.pharmacyId },
      }),
      prisma.branch.findFirst({
        where: { id: input.destinationBranchId, pharmacyId: scope.pharmacyId },
      }),
    ]);

    if (!sourceBranch) throw new NotFoundError("Source branch");
    if (!destBranch) throw new NotFoundError("Destination branch");

    // If caller has branch restriction, must match source or destination
    if (
      scope.branchId &&
      scope.branchId !== input.sourceBranchId &&
      scope.branchId !== input.destinationBranchId
    ) {
      throw new BadRequestError("You can only create transfers involving your assigned branch");
    }

    // Validate items and their source stock
    const itemDataList: Array<{
      productId: string;
      productName: string;
      barcode: string;
      sourceBatchId: string | null;
      batchNumber: string;
      expiryDate: Date;
      quantity: number;
      unitCost: number;
      salePrice: number;
    }> = [];

    for (const item of input.items) {
      const sourceProduct = await prisma.product.findFirst({
        where: {
          id: item.productId,
          pharmacyId: scope.pharmacyId,
          branchId: input.sourceBranchId,
        },
      });

      if (!sourceProduct) {
        throw new NotFoundError(`Product (${item.productId}) at source branch`);
      }

      let sourceBatch = null;
      if (item.sourceBatchId) {
        sourceBatch = await prisma.batch.findFirst({
          where: {
            id: item.sourceBatchId,
            productId: item.productId,
            branchId: input.sourceBranchId,
            pharmacyId: scope.pharmacyId,
          },
        });
        if (!sourceBatch) {
          throw new NotFoundError(`Batch (${item.sourceBatchId}) at source branch`);
        }
        if (sourceBatch.quantityInBaseUnits < item.quantity) {
          throw new BadRequestError(
            `Insufficient stock in batch ${sourceBatch.batchNumber} for product "${sourceProduct.name}". Requested: ${item.quantity}, Available: ${sourceBatch.quantityInBaseUnits}`,
          );
        }
      } else {
        // Find best batch via FEFO
        sourceBatch = await prisma.batch.findFirst({
          where: {
            productId: item.productId,
            branchId: input.sourceBranchId,
            pharmacyId: scope.pharmacyId,
            status: "ACTIVE",
            isRecalled: false,
            quantityInBaseUnits: { gte: item.quantity },
          },
          orderBy: { expiryDate: "asc" },
        });

        if (!sourceBatch) {
          // If no single batch has full quantity, take the first available active batch
          sourceBatch = await prisma.batch.findFirst({
            where: {
              productId: item.productId,
              branchId: input.sourceBranchId,
              pharmacyId: scope.pharmacyId,
              status: "ACTIVE",
              isRecalled: false,
              quantityInBaseUnits: { gt: 0 },
            },
            orderBy: { expiryDate: "asc" },
          });
        }

        if (!sourceBatch) {
          throw new BadRequestError(
            `No available active batch found for product "${sourceProduct.name}" at source branch`,
          );
        }
      }

      itemDataList.push({
        productId: sourceProduct.id,
        productName: sourceProduct.name,
        barcode: sourceProduct.barcode,
        sourceBatchId: sourceBatch.id,
        batchNumber: sourceBatch.batchNumber,
        expiryDate: sourceBatch.expiryDate,
        quantity: item.quantity,
        unitCost: Number(sourceBatch.costPricePerUnit) || sourceProduct.purchasePrice,
        salePrice: Number(sourceBatch.salePricePerUnit) || sourceProduct.salePrice,
      });
    }

    const transferNumber = generateTransferNumber();

    // Create the transfer record with items
    const transfer = await prisma.$transaction(async (tx) => {
      const createdTransfer = await tx.stockTransfer.create({
        data: {
          transferNumber,
          pharmacyId: scope.pharmacyId,
          sourceBranchId: input.sourceBranchId,
          destinationBranchId: input.destinationBranchId,
          status: "PENDING",
          requestedById: user.id,
          requestedByName: user.name,
          notes: input.notes ?? "",
          items: {
            create: itemDataList.map((i) => ({
              productId: i.productId,
              productName: i.productName,
              barcode: i.barcode,
              sourceBatchId: i.sourceBatchId,
              batchNumber: i.batchNumber,
              expiryDate: i.expiryDate,
              quantity: i.quantity,
              unitCost: i.unitCost,
              salePrice: i.salePrice,
            })),
          },
        },
        include: {
          items: true,
          sourceBranch: { select: { id: true, name: true } },
          destinationBranch: { select: { id: true, name: true } },
        },
      });

      return createdTransfer;
    });

    if (input.sendImmediately) {
      return this.sendTransfer(scope, transfer.id, user);
    }

    return transfer;
  },

  async sendTransfer(
    scope: BranchScope,
    transferId: string,
    user: { id: string; name: string },
  ) {
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: transferId, pharmacyId: scope.pharmacyId },
      include: {
        items: true,
        sourceBranch: true,
        destinationBranch: true,
      },
    });

    if (!transfer) throw new NotFoundError("Transfer");

    if (transfer.status !== "PENDING") {
      throw new BadRequestError(`Cannot send transfer with status "${transfer.status}"`);
    }

    if (scope.branchId && scope.branchId !== transfer.sourceBranchId) {
      throw new BadRequestError("Only the source branch can dispatch/send this transfer");
    }

    return prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        if (!item.sourceBatchId) {
          throw new BadRequestError(`Item ${item.productName} is missing source batch information`);
        }

        const sourceBatch = await tx.batch.findUnique({
          where: { id: item.sourceBatchId },
        });

        if (!sourceBatch || sourceBatch.quantityInBaseUnits < item.quantity) {
          throw new BadRequestError(
            `Insufficient quantity in batch ${item.batchNumber} for "${item.productName}". Available: ${sourceBatch?.quantityInBaseUnits ?? 0}`,
          );
        }

        const newBatchQty = sourceBatch.quantityInBaseUnits - item.quantity;
        await tx.batch.update({
          where: { id: sourceBatch.id },
          data: {
            quantityInBaseUnits: newBatchQty,
            status: newBatchQty === 0 ? "DEPLETED" : "ACTIVE",
          },
        });

        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQty: { decrement: item.quantity },
          },
        });

        // Log immutable StockMovement (TRANSFER_OUT)
        await tx.stockMovement.create({
          data: {
            pharmacyId: scope.pharmacyId,
            branchId: transfer.sourceBranchId,
            productId: item.productId,
            batchId: sourceBatch.id,
            movementType: "TRANSFER_OUT",
            quantityDelta: -item.quantity,
            balanceAfter: updatedProduct.stockQty,
            unitCost: item.unitCost,
            referenceNumber: transfer.transferNumber,
            reasonCode: `TRANSFER_TO_${transfer.destinationBranch.name}`,
            createdById: user.id,
          },
        });
      }

      const updated = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: "IN_TRANSIT",
          approvedById: user.id,
          approvedByName: user.name,
          approvedAt: new Date(),
        },
        include: {
          items: true,
          sourceBranch: { select: { id: true, name: true } },
          destinationBranch: { select: { id: true, name: true } },
        },
      });

      return updated;
    });
  },

  async receiveTransfer(
    scope: BranchScope,
    transferId: string,
    user: { id: string; name: string },
  ) {
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: transferId, pharmacyId: scope.pharmacyId },
      include: {
        items: { include: { product: true } },
        sourceBranch: true,
        destinationBranch: true,
      },
    });

    if (!transfer) throw new NotFoundError("Transfer");

    if (transfer.status !== "IN_TRANSIT") {
      throw new BadRequestError(`Cannot receive transfer with status "${transfer.status}". It must be IN_TRANSIT.`);
    }

    if (scope.branchId && scope.branchId !== transfer.destinationBranchId) {
      throw new BadRequestError("Only the destination branch can receive this transfer");
    }

    return prisma.$transaction(async (tx) => {
      for (const item of transfer.items) {
        // 1. Locate or provision the product at destination branch by barcode
        let destProduct = await tx.product.findFirst({
          where: {
            pharmacyId: scope.pharmacyId,
            branchId: transfer.destinationBranchId,
            barcode: item.barcode,
          },
        });

        if (!destProduct) {
          const src = item.product;
          destProduct = await tx.product.create({
            data: {
              pharmacyId: scope.pharmacyId,
              branchId: transfer.destinationBranchId,
              barcode: src.barcode,
              name: src.name,
              nameEn: src.nameEn,
              nameAr: src.nameAr,
              genericName: src.genericName,
              dosageForm: src.dosageForm,
              strength: src.strength,
              company: src.company,
              category: src.category,
              location: src.location,
              salePrice: item.salePrice,
              purchasePrice: item.unitCost,
              markupPercent: src.markupPercent,
              stockQty: 0,
              packSize: src.packSize,
              baseUnit: src.baseUnit,
              packageUnit: src.packageUnit,
              unitsPerPack: src.unitsPerPack,
              isRx: src.isRx,
              isControlled: src.isControlled,
              isPriceRegulated: src.isPriceRegulated,
              publicPrice: src.publicPrice,
              sfdaCode: src.sfdaCode,
              active: 1,
            },
          });
        }

        // 2. Exact batch travel! Preserve batchNumber, expiryDate, and unitCost
        let destBatch = await tx.batch.findUnique({
          where: {
            branchId_productId_batchNumber: {
              branchId: transfer.destinationBranchId,
              productId: destProduct.id,
              batchNumber: item.batchNumber,
            },
          },
        });

        if (destBatch) {
          destBatch = await tx.batch.update({
            where: { id: destBatch.id },
            data: {
              quantityInBaseUnits: destBatch.quantityInBaseUnits + item.quantity,
              status: "ACTIVE",
            },
          });
        } else {
          destBatch = await tx.batch.create({
            data: {
              pharmacyId: scope.pharmacyId,
              branchId: transfer.destinationBranchId,
              productId: destProduct.id,
              batchNumber: item.batchNumber,
              expiryDate: item.expiryDate,
              quantityInBaseUnits: item.quantity,
              costPricePerUnit: item.unitCost,
              salePricePerUnit: item.salePrice,
              status: "ACTIVE",
            },
          });
        }

        // 3. Increment destination product stockQty
        const updatedDestProd = await tx.product.update({
          where: { id: destProduct.id },
          data: {
            stockQty: { increment: item.quantity },
          },
        });

        // 4. Log immutable StockMovement (TRANSFER_IN)
        await tx.stockMovement.create({
          data: {
            pharmacyId: scope.pharmacyId,
            branchId: transfer.destinationBranchId,
            productId: destProduct.id,
            batchId: destBatch.id,
            movementType: "TRANSFER_IN",
            quantityDelta: item.quantity,
            balanceAfter: updatedDestProd.stockQty,
            unitCost: item.unitCost,
            referenceNumber: transfer.transferNumber,
            reasonCode: `TRANSFER_FROM_${transfer.sourceBranch.name}`,
            createdById: user.id,
          },
        });

        // 5. Update transfer item with destination batch reference
        await tx.stockTransferItem.update({
          where: { id: item.id },
          data: {
            destinationBatchId: destBatch.id,
          },
        });
      }

      const updated = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: "RECEIVED",
          receivedById: user.id,
          receivedByName: user.name,
          receivedAt: new Date(),
        },
        include: {
          items: true,
          sourceBranch: { select: { id: true, name: true } },
          destinationBranch: { select: { id: true, name: true } },
        },
      });

      return updated;
    });
  },

  async rejectTransfer(
    scope: BranchScope,
    transferId: string,
    reason: string,
    user: { id: string; name: string },
  ) {
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: transferId, pharmacyId: scope.pharmacyId },
      include: {
        items: true,
        sourceBranch: true,
        destinationBranch: true,
      },
    });

    if (!transfer) throw new NotFoundError("Transfer");

    if (transfer.status !== "PENDING" && transfer.status !== "IN_TRANSIT") {
      throw new BadRequestError(`Cannot reject transfer with status "${transfer.status}"`);
    }

    return prisma.$transaction(async (tx) => {
      // If was IN_TRANSIT, stock was already removed from source branch -> restore it!
      if (transfer.status === "IN_TRANSIT") {
        for (const item of transfer.items) {
          if (item.sourceBatchId) {
            await tx.batch.update({
              where: { id: item.sourceBatchId },
              data: {
                quantityInBaseUnits: { increment: item.quantity },
                status: "ACTIVE",
              },
            });
          }

          const restoredProduct = await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQty: { increment: item.quantity },
            },
          });

          await tx.stockMovement.create({
            data: {
              pharmacyId: scope.pharmacyId,
              branchId: transfer.sourceBranchId,
              productId: item.productId,
              batchId: item.sourceBatchId,
              movementType: "TRANSFER_REVERT",
              quantityDelta: item.quantity,
              balanceAfter: restoredProduct.stockQty,
              unitCost: item.unitCost,
              referenceNumber: transfer.transferNumber,
              reasonCode: `REJECTED: ${reason.slice(0, 100)}`,
              createdById: user.id,
            },
          });
        }
      }

      const updated = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: "REJECTED",
          rejectionReason: reason,
        },
        include: {
          items: true,
          sourceBranch: { select: { id: true, name: true } },
          destinationBranch: { select: { id: true, name: true } },
        },
      });

      return updated;
    });
  },

  async cancelTransfer(
    scope: BranchScope,
    transferId: string,
    user: { id: string; name: string },
  ) {
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: transferId, pharmacyId: scope.pharmacyId },
    });

    if (!transfer) throw new NotFoundError("Transfer");

    if (transfer.status !== "PENDING") {
      throw new BadRequestError("Only pending transfers can be cancelled");
    }

    if (scope.branchId && scope.branchId !== transfer.sourceBranchId && scope.branchId !== transfer.destinationBranchId) {
      throw new BadRequestError("You do not have access to cancel this transfer");
    }

    return prisma.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: "CANCELLED",
        rejectionReason: `Cancelled by ${user.name}`,
      },
      include: {
        items: true,
        sourceBranch: { select: { id: true, name: true } },
        destinationBranch: { select: { id: true, name: true } },
      },
    });
  },

  async listTransfers(
    scope: BranchScope,
    opts?: {
      branchId?: string;
      direction?: "in" | "out" | "all";
      status?: string;
      search?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Math.max(1, opts?.page ?? 1);
    const pageSize = Math.min(Math.max(1, opts?.pageSize ?? 50), 200);

    const activeBranchId = opts?.branchId || scope.branchId;
    const direction = opts?.direction ?? "all";

    const where: any = {
      pharmacyId: scope.pharmacyId,
    };

    if (opts?.status) {
      where.status = opts.status;
    }

    if (activeBranchId) {
      if (direction === "in") {
        where.destinationBranchId = activeBranchId;
      } else if (direction === "out") {
        where.sourceBranchId = activeBranchId;
      } else {
        where.OR = [
          { sourceBranchId: activeBranchId },
          { destinationBranchId: activeBranchId },
        ];
      }
    }

    if (opts?.search?.trim()) {
      const q = opts.search.trim();
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { transferNumber: { contains: q, mode: "insensitive" } },
            { notes: { contains: q, mode: "insensitive" } },
            { items: { some: { productName: { contains: q, mode: "insensitive" } } } },
            { items: { some: { barcode: { contains: q, mode: "insensitive" } } } },
          ],
        },
      ];
    }

    const [transfers, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        include: {
          items: true,
          sourceBranch: { select: { id: true, name: true, phone: true } },
          destinationBranch: { select: { id: true, name: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.stockTransfer.count({ where }),
    ]);

    return { data: transfers, total, page, pageSize };
  },

  async getTransferById(scope: BranchScope, id: string) {
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id, pharmacyId: scope.pharmacyId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, barcode: true, packSize: true } },
            sourceBatch: { select: { id: true, batchNumber: true, expiryDate: true } },
          },
        },
        sourceBranch: { select: { id: true, name: true, address: true, phone: true } },
        destinationBranch: { select: { id: true, name: true, address: true, phone: true } },
      },
    });

    if (!transfer) throw new NotFoundError("Transfer");
    return transfer;
  },

  // -------------------------------------------------------------
  // CROSS-BRANCH STOCK VISIBILITY
  // -------------------------------------------------------------
  async getCrossBranchStock(scope: BranchScope, query: CrossBranchStockQuery) {
    if (!query.productId && !query.barcode) {
      throw new BadRequestError("productId or barcode is required to query cross-branch stock");
    }

    // Find the base product info
    const sampleProduct = await prisma.product.findFirst({
      where: {
        pharmacyId: scope.pharmacyId,
        ...(query.productId ? { id: query.productId } : { barcode: query.barcode }),
      },
      select: { barcode: true, name: true, id: true },
    });

    if (!sampleProduct) {
      throw new NotFoundError("Product");
    }

    const barcode = sampleProduct.barcode;

    // Fetch all active branches for this pharmacy
    const branches = await prisma.branch.findMany({
      where: { pharmacyId: scope.pharmacyId, isActive: true },
      orderBy: { name: "asc" },
    });

    // Fetch all matching products across all branches
    const products = await prisma.product.findMany({
      where: { pharmacyId: scope.pharmacyId, barcode },
      include: {
        branchPriceOverrides: true,
        batches: {
          where: { status: "ACTIVE", quantityInBaseUnits: { gt: 0 } },
          orderBy: { expiryDate: "asc" },
        },
      },
    });

    const productByBranch = new Map<string, typeof products[0]>();
    for (const p of products) {
      productByBranch.set(p.branchId, p);
    }

    // Also get last movement timestamp per branch for this product
    const latestMovements = await prisma.stockMovement.groupBy({
      by: ["branchId"],
      where: {
        pharmacyId: scope.pharmacyId,
        product: { barcode },
      },
      _max: {
        createdAt: true,
      },
    });

    const lastMovementByBranch = new Map<string, Date>();
    for (const m of latestMovements) {
      if (m._max.createdAt) {
        lastMovementByBranch.set(m.branchId, m._max.createdAt);
      }
    }

    let totalStockAcrossAllBranches = 0;

    const branchStockList = branches.map((b) => {
      const prod = productByBranch.get(b.id);
      const stockQty = prod?.stockQty ?? 0;
      totalStockAcrossAllBranches += stockQty;

      const override = prod?.branchPriceOverrides?.find((o) => o.branchId === b.id);
      const effectiveSalePrice =
        b.allowPriceOverride && override ? override.salePrice : (prod?.salePrice ?? 0);

      const batches = (prod?.batches ?? []).map((batch) => ({
        id: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate.toISOString(),
        quantity: batch.quantityInBaseUnits,
        costPrice: Number(batch.costPricePerUnit),
        salePrice: Number(batch.salePricePerUnit),
        isRecalled: batch.isRecalled,
        status: batch.status,
      }));

      const lastUpdated = lastMovementByBranch.get(b.id)?.toISOString() ?? prod?.updatedAt?.toISOString() ?? null;

      return {
        branchId: b.id,
        branchName: b.name,
        branchAddress: b.address,
        branchPhone: b.phone,
        allowPriceOverride: b.allowPriceOverride,
        hasProductRecord: !!prod,
        productId: prod?.id ?? null,
        stockQty,
        catalogSalePrice: prod?.salePrice ?? 0,
        effectiveSalePrice,
        hasPriceOverride: !!(b.allowPriceOverride && override),
        priceOverrideReason: override?.reason ?? null,
        lastUpdated,
        batches,
      };
    });

    return {
      productName: sampleProduct.name,
      barcode: sampleProduct.barcode,
      totalStockAcrossAllBranches,
      branches: branchStockList,
    };
  },

  // -------------------------------------------------------------
  // BRANCH PRICE OVERRIDES
  // -------------------------------------------------------------
  async getBranchPriceOverrides(scope: BranchScope, branchId: string) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, pharmacyId: scope.pharmacyId },
    });
    if (!branch) throw new NotFoundError("Branch");

    const overrides = await prisma.branchPriceOverride.findMany({
      where: { branchId, pharmacyId: scope.pharmacyId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            barcode: true,
            salePrice: true,
            purchasePrice: true,
            category: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return {
      branch: {
        id: branch.id,
        name: branch.name,
        allowPriceOverride: branch.allowPriceOverride,
      },
      overrides: overrides.map((o) => ({
        id: o.id,
        productId: o.productId,
        productName: o.product.name,
        barcode: o.product.barcode,
        catalogPrice: o.product.salePrice,
        overridePrice: o.salePrice,
        reason: o.reason,
        effectiveDate: o.effectiveDate.toISOString(),
        updatedAt: o.updatedAt.toISOString(),
      })),
    };
  },

  async setBranchPriceOverride(
    scope: BranchScope,
    branchId: string,
    input: BranchPriceOverrideInput,
  ) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, pharmacyId: scope.pharmacyId },
    });
    if (!branch) throw new NotFoundError("Branch");

    if (!branch.allowPriceOverride) {
      throw new BadRequestError(
        `Price overrides are disabled for branch "${branch.name}". Enable price overrides in branch settings first.`,
      );
    }

    const product = await prisma.product.findFirst({
      where: { id: input.productId, pharmacyId: scope.pharmacyId },
    });
    if (!product) throw new NotFoundError("Product");

    const override = await prisma.branchPriceOverride.upsert({
      where: {
        branchId_productId: {
          branchId,
          productId: input.productId,
        },
      },
      create: {
        pharmacyId: scope.pharmacyId,
        branchId,
        productId: input.productId,
        salePrice: input.salePrice,
        reason: input.reason ?? "",
      },
      update: {
        salePrice: input.salePrice,
        reason: input.reason ?? "",
        effectiveDate: new Date(),
      },
      include: {
        product: { select: { id: true, name: true, barcode: true, salePrice: true } },
      },
    });

    return {
      id: override.id,
      branchId: override.branchId,
      productId: override.productId,
      productName: override.product.name,
      barcode: override.product.barcode,
      catalogPrice: override.product.salePrice,
      overridePrice: override.salePrice,
      reason: override.reason,
      effectiveDate: override.effectiveDate.toISOString(),
    };
  },

  async deleteBranchPriceOverride(scope: BranchScope, branchId: string, productId: string) {
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, pharmacyId: scope.pharmacyId },
    });
    if (!branch) throw new NotFoundError("Branch");

    const existing = await prisma.branchPriceOverride.findUnique({
      where: {
        branchId_productId: {
          branchId,
          productId,
        },
      },
    });

    if (!existing) {
      throw new NotFoundError("Branch price override");
    }

    await prisma.branchPriceOverride.delete({
      where: { id: existing.id },
    });

    return { success: true };
  },
};
