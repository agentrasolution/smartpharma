import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { prisma } from "../../services/prisma";
import { config } from "../../config/env";
import { OpenAICompatibleProvider } from "../../ai/providers/openai.provider";
import { AppError } from "../../utils/errors";
import type { AIConfig } from "./settings.schema";

const dataDir = process.env.FARAZ_DATA_DIR || path.join(os.homedir(), ".faraz-pharmacy");

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function findPgBinary(name: string): string {
  const cmd = process.platform === "win32" ? `where.exe ${name}` : `which ${name}`;
  try {
    const found = execSync(cmd, { encoding: "utf-8" })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line.length > 0);
    if (found) return found;
  } catch {
    // not on PATH, fall through to common install locations
  }
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  const roots =
    process.platform === "win32"
      ? ["C:\\Program Files\\PostgreSQL", "C:\\Program Files (x86)\\PostgreSQL", "D:\\PostgreSQL"]
      : ["/usr/lib/postgresql", "/opt/postgresql", "/usr/local/bin"];
  if (process.platform === "win32") {
    try {
      const versions = fs.readdirSync(roots[0]);
      for (const version of versions.sort().reverse()) {
        const candidate = path.join(roots[0], version, "bin", exe);
        if (fs.existsSync(candidate)) return candidate;
      }
    } catch {
      // no default install dir
    }
  } else {
    try {
      const versions = fs.readdirSync(roots[0]);
      for (const version of versions.sort().reverse()) {
        for (const bin of ["bin", "bin/psql"]) {
          const candidate = path.join(roots[0], version, bin, exe);
          if (fs.existsSync(candidate)) return candidate;
        }
      }
    } catch {
      // no default install dir
    }
  }
  throw new Error(`${name} not found. Install PostgreSQL or add ${name} to PATH.`);
}

function getConfigPath() {
  ensureDataDir();
  return path.join(dataDir, "config.json");
}

function loadConfig(): Record<string, unknown> {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(getConfigPath(), "utf-8"));
  } catch {
    return {};
  }
}

function saveConfig(cfg: Record<string, unknown>) {
  ensureDataDir();
  fs.writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2));
}

export const settingsService = {
  // Backups
  async createBackup() {
    ensureDataDir();
    const backupDir = path.join(dataDir, "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupName = `faraz-pharmacy-backup-${timestamp}.sql`;
    const backupPath = path.join(backupDir, backupName);

    const dbUrl = process.env.DATABASE_URL || "";
    if (!dbUrl) throw new Error("DATABASE_URL is not configured");
    const pgDump = findPgBinary("pg_dump");
    execSync(`"${pgDump}" --clean --if-exists "${dbUrl}" > "${backupPath}"`);

    const stat = fs.statSync(backupPath);
    return {
      success: true,
      name: backupName,
      path: backupPath,
      size: stat.size,
      createdAt: stat.birthtime?.toISOString() || stat.mtime.toISOString(),
    };
  },

  listBackups() {
    ensureDataDir();
    const backupDir = path.join(dataDir, "backups");
    if (!fs.existsSync(backupDir)) return [];

    return fs.readdirSync(backupDir)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => {
        const fp = path.join(backupDir, f);
        const stat = fs.statSync(fp);
        return { name: f, path: fp, size: stat.size, createdAt: (stat.birthtime || stat.mtime).toISOString() };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  deleteBackup(name: string) {
    const backupDir = path.join(dataDir, "backups");
    const fp = path.join(backupDir, name);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    return { success: true };
  },

  restoreBackup(name: string) {
    const backupDir = path.join(dataDir, "backups");
    const backupPath = path.join(backupDir, name);
    if (!fs.existsSync(backupPath)) throw new Error("Backup file not found");

    const dbUrl = process.env.DATABASE_URL || "";
    if (!dbUrl) throw new Error("DATABASE_URL is not configured");
    const psql = findPgBinary("psql");
    execSync(`"${psql}" "${dbUrl}" < "${backupPath}"`, { stdio: "pipe" });
    return { success: true };
  },

  getBackupDirectory() {
    ensureDataDir();
    return { path: path.join(dataDir, "backups") };
  },

  // Google Drive config
  getGdriveConfig() {
    const cfg = loadConfig();
    return (cfg.googleDrive as Record<string, unknown>) || {
      clientId: "", clientSecret: "", redirectUri: "", refreshToken: "", autoUpload: false, connected: false,
    };
  },

  saveGdriveConfig(gdriveConfig: Record<string, unknown>) {
    const cfg = loadConfig();
    cfg.googleDrive = gdriveConfig;
    saveConfig(cfg);
    return { success: true };
  },

  // AI provider config (Gemini-only).
  getAIConfig(): AIConfig {
    const cfg = loadConfig();
    const saved = (cfg.ai as Partial<AIConfig>) || {};
    return {
      provider: saved.provider || config.ai.provider || "gemini",
      apiKey: saved.apiKey || config.ai.apiKey || "",
      baseUrl: saved.baseUrl || config.ai.baseUrl || "https://generativelanguage.googleapis.com/v1beta/openai",
      model: saved.model || config.ai.model || "gemini-3.6-flash",
    };
  },

  saveAIConfig(ai: AIConfig) {
    if (ai.provider && ai.provider !== "gemini") {
      throw new AppError(400, "Only Google Gemini is supported");
    }
    const cfg = loadConfig();
    cfg.ai = { ...ai, provider: "gemini" };
    saveConfig(cfg);
    return { success: true };
  },

  // Live connectivity test against the configured provider.
  async testAIConnection(ai: AIConfig): Promise<{
    success: boolean;
    latencyMs?: number;
    error?: string;
    model?: string;
    provider?: string;
  }> {
    const started = Date.now();
    try {
      const provider = new OpenAICompatibleProvider({
        apiKey: ai.apiKey ?? "",
        baseUrl: ai.baseUrl ?? "",
        timeoutMs: 45000,
      });
      const result = await provider.chat({
        model: ai.model || "unknown",
        systemPrompt: "You are a connection test. Reply with exactly: OK",
        messages: [{ role: "user", content: "ping" }],
        tools: [],
        temperature: 0,
      });
      return {
        success: true,
        latencyMs: Date.now() - started,
        model: ai.model,
        provider: ai.provider,
      };
    } catch (err) {
      return {
        success: false,
        latencyMs: Date.now() - started,
        error: (err as Error).message,
        model: ai.model,
        provider: ai.provider,
      };
    }
  },
};
