const { initializeDatabase, getDatabase } = require("./electron/database");
const { startServer } = require("./electron/server");

const PORT = parseInt(process.env.PORT || "3456", 10);

initializeDatabase();
console.log(`[entry] Database initialized`);

const app = startServer(PORT);
console.log(`[entry] API server running on port ${PORT}`);

process.on("SIGTERM", () => {
  console.log("[entry] Shutting down...");
  require("./electron/server").stopServer();
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("[entry] Shutting down...");
  require("./electron/server").stopServer();
  process.exit(0);
});
