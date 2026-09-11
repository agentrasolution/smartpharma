// Expiry parser/normalizer.
// The existing Product.expiry is an unvalidated string; its format must be
// inspected before parsing, never assumed. Invalid values are reported rather
// than guessed.

export type ExpiryCheckStatus = "VALID" | "EMPTY" | "INVALID" | "PAST";

export type ExpiryBucket =
  | "EXPIRED"
  | "EXPIRES_IN_30_DAYS"
  | "EXPIRES_IN_60_DAYS"
  | "EXPIRES_IN_90_DAYS"
  | "LATER"
  | "NONE";

export interface ExpiryInfo {
  raw: string | null;
  status: ExpiryCheckStatus;
  date: Date | null;
  bucket: ExpiryBucket;
  daysUntil: number | null;
}

const SUPPORTED_FORMATS: RegExp[] = [
  /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
  /^\d{2}-\d{2}-\d{4}$/, // DD-MM-YYYY
  /^\d{2}\/\d{2}\/\d{4}$/, // DD/MM/YYYY
  /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
  /^\d{2}-\d{4}$/, // MM-YYYY
  /^\d{2}\/\d{4}$/, // MM/YYYY
];

function parseDate(raw: string): Date | null {
  const s = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  }
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) {
    const [y, m, d] = s.split("/").map(Number);
    return new Date(y!, m! - 1, d!);
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) {
    const [d, m, y] = s.split("-").map(Number);
    return new Date(y!, m! - 1, d!);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/").map(Number);
    return new Date(y!, m! - 1, d!);
  }
  if (/^\d{2}-\d{4}$/.test(s)) {
    const [m, y] = s.split("-").map(Number);
    return new Date(y!, m! - 1, 1);
  }
  if (/^\d{2}\/\d{4}$/.test(s)) {
    const [m, y] = s.split("/").map(Number);
    return new Date(y!, m! - 1, 1);
  }
  return null;
}

function isValidDate(d: Date | null): d is Date {
  return d !== null && !Number.isNaN(d.getTime());
}

const isSupportedFormat = (raw: string): boolean =>
  SUPPORTED_FORMATS.some((re) => re.test(raw.trim()));

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function analyzeExpiry(raw: string | null | undefined, now = new Date()): ExpiryInfo {
  if (!raw || raw.trim() === "") {
    return {
      raw: null,
      status: "EMPTY",
      date: null,
      bucket: "NONE",
      daysUntil: null,
    };
  }

  if (!isSupportedFormat(raw)) {
    return {
      raw,
      status: "INVALID",
      date: null,
      bucket: "NONE",
      daysUntil: null,
    };
  }

  const date = parseDate(raw);
  if (!isValidDate(date)) {
    return {
      raw,
      status: "INVALID",
      date: null,
      bucket: "NONE",
      daysUntil: null,
    };
  }

  const daysUntil = Math.floor((date.getTime() - startOfDay(now)) / 86400000);

  if (daysUntil < 0) {
    return { raw, status: "PAST", date, bucket: "EXPIRED", daysUntil };
  }

  let bucket: ExpiryBucket;
  if (daysUntil <= 30) bucket = "EXPIRES_IN_30_DAYS";
  else if (daysUntil <= 60) bucket = "EXPIRES_IN_60_DAYS";
  else if (daysUntil <= 90) bucket = "EXPIRES_IN_90_DAYS";
  else bucket = "LATER";

  return { raw, status: "VALID", date, bucket, daysUntil };
}

export function expiryBucketedCounts(infos: ExpiryInfo[]): {
  expired: number;
  expiresIn30Days: number;
  expiresIn60Days: number;
  expiresIn90Days: number;
  invalid: number;
  empty: number;
} {
  let expired = 0;
  let expiresIn30Days = 0;
  let expiresIn60Days = 0;
  let expiresIn90Days = 0;
  let invalid = 0;
  let empty = 0;
  for (const info of infos) {
    if (info.status === "INVALID") invalid++;
    else if (info.status === "EMPTY") empty++;
    else if (info.bucket === "EXPIRED") expired++;
    else if (info.bucket === "EXPIRES_IN_30_DAYS") expiresIn30Days++;
    else if (info.bucket === "EXPIRES_IN_60_DAYS") expiresIn60Days++;
    else if (info.bucket === "EXPIRES_IN_90_DAYS") expiresIn90Days++;
  }
  return { expired, expiresIn30Days, expiresIn60Days, expiresIn90Days, invalid, empty };
}
