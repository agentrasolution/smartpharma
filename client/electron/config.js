import fs from "fs";
import path from "path";
import os from "os";  

const DATA_DIR = path.join(os.homedir(), ".faraz-pharmacy");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { mode: null, serverUrl: "", serverPort: 3001, printer: { paperSize: "thermal", deviceName: null }, backupDirectory: "" };
  }
}

function getBackupsDir() {
  const cfg = loadConfig();
  return cfg.backupDirectory || path.join(os.homedir(), ".faraz-pharmacy", "backups");
}

function saveConfig(config) {
  ensureDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function isConfigured() {
  return loadConfig().mode !== null;
}


export { loadConfig , saveConfig, isConfigured , getBackupsDir}
