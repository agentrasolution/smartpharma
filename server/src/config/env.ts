import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/faraz_pharmacy",
  ai: {
    provider: process.env.AI_PROVIDER || "gemini",
    apiKey: process.env.AI_API_KEY || "",
    baseUrl: process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
    model: process.env.AI_MODEL || "gemini-3.6-flash",
  },
  workerEnabled: process.env.AI_WORKER_ENABLED !== "false",
};
