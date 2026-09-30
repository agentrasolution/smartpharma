/**
 * expiry-alert.worker.ts
 * Pillar B – Expiry Alert Scheduler
 *
 * Runs nightly (default 01:00 local time) and:
 *  1. Flags batches that expire within the configured warning window (default 90 days).
 *  2. Auto-marks zero-quantity batches as DEPLETED.
 *  3. Auto-marks past-expiry batches as EXPIRED (a special status we add logically).
 *  4. Emits a Socket.IO event so connected desktops receive live alerts.
 *  5. Logs a summary for audit / dashboard widgets.
 *
 * Uses the same self-scheduling setTimeout pattern as daily-analysis.worker.ts
 * so it is dependency-free (no node-cron required).
 */

import { prisma } from "../services/prisma";
import { logger } from "../utils/logger";
import { emitEvent } from "../socket";

export interface ExpiryAlertSummary {
  expiredMarked: number;  // batches past expiry → status = "EXPIRED"
  depletedMarked: number; // batches qty=0 → status = "DEPLETED"
  nearExpiryAlerts: number; // batches within warning window
}

// ---------------------------------------------------------------------------
// Core runner (also exported for on-demand use from API routes)
// ---------------------------------------------------------------------------

/**
 * Scan all branches, update batch statuses, return a summary.
 * Safe to call multiple times; uses idempotent upserts.
 */
export async function runExpiryAlertPass(
  warningDays = Number(process.env.EXPIRY_WARNING_DAYS ?? 90)
): Promise<ExpiryAlertSummary> {
  const now = new Date();
  const warningCutoff = new Date(now);
  warningCutoff.setDate(warningCutoff.getDate() + warningDays);

  // 1. Mark past-expiry ACTIVE batches as EXPIRED
  const expiredResult = await prisma.batch.updateMany({
    where: {
      status: "ACTIVE",
      expiryDate: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  // 2. Mark zero-quantity ACTIVE batches as DEPLETED
  const depletedResult = await prisma.batch.updateMany({
    where: {
      status: "ACTIVE",
      quantityInBaseUnits: { lte: 0 },
    },
    data: { status: "DEPLETED" },
  });

  // 3. Fetch near-expiry batches for alert emission
  const nearExpiryBatches = await prisma.batch.findMany({
    where: {
      status: "ACTIVE",
      expiryDate: { gt: now, lte: warningCutoff },
      quantityInBaseUnits: { gt: 0 },
      isRecalled: false,
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          genericName: true,
          dosageForm: true,
          baseUnit: true,
        },
      },
      branch: { select: { id: true, name: true, pharmacyId: true } },
    },
    orderBy: { expiryDate: "asc" },
  });

  // 4. Emit real-time event (desktops and web dashboards subscribe to this)
  if (nearExpiryBatches.length > 0) {
    emitEvent("inventory:expiry-alert", {
      count: nearExpiryBatches.length,
      warningDays,
      batches: nearExpiryBatches.map((b) => ({
        batchId: b.id,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        daysUntilExpiry: Math.ceil((b.expiryDate.getTime() - now.getTime()) / 86_400_000),
        quantityInBaseUnits: b.quantityInBaseUnits,
        product: b.product,
        branch: b.branch,
      })),
      scannedAt: now.toISOString(),
    });
  }

  const summary: ExpiryAlertSummary = {
    expiredMarked: expiredResult.count,
    depletedMarked: depletedResult.count,
    nearExpiryAlerts: nearExpiryBatches.length,
  };

  logger.info(
    `[expiry-alert] expired=${summary.expiredMarked} depleted=${summary.depletedMarked} nearExpiry=${summary.nearExpiryAlerts} (within ${warningDays}d)`
  );

  return summary;
}

// ---------------------------------------------------------------------------
// Self-scheduling worker (same pattern as daily-analysis.worker.ts)
// ---------------------------------------------------------------------------

let running = false;
let timer: NodeJS.Timeout | null = null;
let stopped = false;

function msToNextRun(hour: number, minute: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

export function startExpiryAlertWorker(opts?: {
  hour?: number;
  minute?: number;
  warningDays?: number;
}): void {
  const hour = opts?.hour ?? Number(process.env.EXPIRY_WORKER_HOUR ?? 1);
  const minute = opts?.minute ?? Number(process.env.EXPIRY_WORKER_MINUTE ?? 0);
  const warningDays = opts?.warningDays ?? Number(process.env.EXPIRY_WARNING_DAYS ?? 90);
  stopped = false;

  const schedule = () => {
    const delay = msToNextRun(hour, minute);
    timer = setTimeout(async () => {
      if (running) {
        logger.warn("[expiry-alert] previous pass still running; skipping this cycle");
        schedule();
        return;
      }
      running = true;
      try {
        await runExpiryAlertPass(warningDays);
      } catch (err) {
        logger.error("[expiry-alert] pass failed:", err);
      } finally {
        running = false;
      }
      if (!stopped) schedule();
    }, delay);
    timer.unref?.();
  };

  schedule();
  logger.info(
    `[expiry-alert] worker started, first run at ${hour}:${minute.toString().padStart(2, "0")} (warning window: ${warningDays}d)`
  );
}

export function stopExpiryAlertWorker(): void {
  stopped = true;
  if (timer) clearTimeout(timer);
  timer = null;
}
