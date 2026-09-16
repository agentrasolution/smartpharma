import { prisma } from "../services/prisma";
import { logger } from "../utils/logger";
import { recommendationService } from "../inventory/recommendations.service";

// Dependency-free daily scheduler. Runs the deterministic analysis pass and
// expires stale recommendations once per day (default 02:00 local time).
// Uses a self-scheduling setTimeout loop; overlaps are prevented with a lock.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

let running = false;
let timer: NodeJS.Timeout | null = null;
let stopped = false;

function currentMsToNextRun(hour: number, minute: number): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

/**
 * Run the full analysis + recommendation pass now. Safe to call on-demand.
 * Analyses run per branch so every query stays scoped to its pharmacy/branch.
 */
export async function runAnalysisNow(days = 30): Promise<{ expired: number; created: number }> {
  const expired = await recommendationService.expireStale();
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, pharmacyId: true },
  });
  let created = 0;
  for (const branch of branches) {
    const n = await recommendationService.generate(
      { pharmacyId: branch.pharmacyId, branchId: branch.id },
      days,
    );
    created += n;
  }
  logger.info(`[daily-analysis] expired=${expired} recommendations created=${created}`);
  return { expired, created };
}

/**
 * Start the daily analysis worker. Backs off when a previous pass is still
 * running so overlapping runs never double-write conflicting recommendations.
 */
export function startDailyAnalysisWorker(opts?: { hour?: number; minute?: number }): void {
  const hour = opts?.hour ?? Number(process.env.AI_WORKER_HOUR ?? 2);
  const minute = opts?.minute ?? Number(process.env.AI_WORKER_MINUTE ?? 0);
  stopped = false;

  const schedule = () => {
    const delay = currentMsToNextRun(hour, minute);
    timer = setTimeout(async () => {
      if (running) {
        logger.warn("[daily-analysis] previous pass still running; skipping this cycle");
        schedule();
        return;
      }
      running = true;
      try {
        await runAnalysisNow();
      } catch (err) {
        logger.error("[daily-analysis] pass failed:", err);
      } finally {
        running = false;
      }
      if (!stopped) schedule();
    }, delay);
    // Don't let the timer keep the Node process alive.
    timer.unref?.();
  };

  schedule();
  logger.info(`[daily-analysis] worker started, first run scheduled at ${hour}:${minute.toString().padStart(2, "0")}`);
}

/** Stop the worker (used on graceful shutdown). */
export function stopDailyAnalysisWorker(): void {
  stopped = true;
  if (timer) clearTimeout(timer);
  timer = null;
}