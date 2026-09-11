const prefix = "[FarazPharmacy]";

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    console.log(`${prefix} ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`${prefix} WARN: ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`${prefix} ERROR: ${message}`, ...args);
  },
};
