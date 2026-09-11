import http from "http";
import { config } from "./config/env";
import { app } from "./app";
import { logger } from "./utils/logger";
import { prisma } from "./services/prisma";
import { initializeSocket, getIO } from "./socket";
import { startDailyAnalysisWorker, stopDailyAnalysisWorker } from "./workers/daily-analysis.worker";
import "./config/env.js";

async function main() {
  try {
    await prisma.$connect();
    logger.info("Database connected");

    if (config.workerEnabled) {
      startDailyAnalysisWorker();
    }

    const httpServer = http.createServer(app);
    initializeSocket(httpServer);

    httpServer.listen(config.port, "0.0.0.0", () => {
      logger.info(`Faraz Pharmacy API server running on port ${config.port}`);
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
}

main();

function shutdown() {
  stopDailyAnalysisWorker();
  getIO()?.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
