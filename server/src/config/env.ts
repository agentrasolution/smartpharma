import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/faraz_pharmacy",
  subscription: {
    trialDays: parseInt(process.env.SUBSCRIPTION_TRIAL_DAYS || "30", 10),
    monthlyPrice: parseFloat(process.env.SUBSCRIPTION_MONTHLY_PRICE || "0"),
    plan: process.env.SUBSCRIPTION_PLAN || "monthly",
  },
  platformAdmin: {
    username: process.env.PLATFORM_ADMIN_USERNAME || "platform",
    password: process.env.PLATFORM_ADMIN_PASSWORD || "",
    pharmacyName: process.env.PLATFORM_PHARMACY_NAME || "Platform",
    pharmacySlug: process.env.PLATFORM_PHARMACY_SLUG || "platform",
  },
  ai: {
    provider: process.env.AI_PROVIDER || "gemini",
    apiKey: process.env.AI_API_KEY || "",
    baseUrl: process.env.AI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
    model: process.env.AI_MODEL || "gemini-3.6-flash",
  },
  workerEnabled: process.env.AI_WORKER_ENABLED !== "false",
};
