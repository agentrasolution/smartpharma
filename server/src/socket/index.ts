import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { logger } from "../utils/logger";

let io: Server;

export function initializeSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    socket.on("disconnect", () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): Server {
  return io;
}

export function emitEvent(event: string, data: unknown) {
  if (io) {
    io.emit(event, data);
  }
}
