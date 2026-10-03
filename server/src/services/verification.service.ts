import crypto from "crypto";
import { prisma } from "./prisma";
import { BadRequestError } from "../utils/errors";

const OTP_EXPIRY_MINUTES = 15;
const GRACE_PERIOD_DAYS = 7;

export function hashOtp(code: string): string {
  return crypto.createHash("sha256").update(code.trim()).digest("hex");
}

export function generate6DigitOtp(): string {
  // Cryptographically secure 6-digit OTP between 100000 and 999999
  const num = crypto.randomInt(100000, 1000000);
  return num.toString();
}

export const verificationService = {
  /**
   * Generates a new 6-digit OTP code, invalidating previous unused codes for this target & type.
   */
  async createOtp(
    target: string,
    type: "EMAIL_VERIFY" | "PASSWORD_RESET" | "PHONE_VERIFY",
    pharmacyId?: string,
  ): Promise<string> {
    const normalizedTarget = target.trim().toLowerCase();
    const code = generate6DigitOtp();
    const codeHash = hashOtp(code);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalidate earlier active codes
    await prisma.verificationCode.updateMany({
      where: {
        target: normalizedTarget,
        type,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });

    await prisma.verificationCode.create({
      data: {
        pharmacyId: pharmacyId ?? null,
        target: normalizedTarget,
        type,
        codeHash,
        expiresAt,
      },
    });

    return code;
  },

  /**
   * Validates an OTP code and marks it as used.
   */
  async verifyOtp(
    target: string,
    type: "EMAIL_VERIFY" | "PASSWORD_RESET" | "PHONE_VERIFY",
    code: string,
  ): Promise<boolean> {
    const normalizedTarget = target.trim().toLowerCase();
    const codeHash = hashOtp(code);

    const record = await prisma.verificationCode.findFirst({
      where: {
        target: normalizedTarget,
        type,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!record) {
      throw new BadRequestError("Invalid or expired verification code");
    }

    if (record.codeHash !== codeHash) {
      throw new BadRequestError("Incorrect verification code");
    }

    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return true;
  },

  /**
   * Evaluates the 7-day grace period status for email verification.
   */
  getGracePeriodStatus(createdAt: Date, isEmailVerified: boolean) {
    if (isEmailVerified) {
      return {
        isEmailVerified: true,
        isGracePeriodActive: false,
        daysRemaining: 7,
        isRestricted: false,
      };
    }

    const elapsedMs = Date.now() - createdAt.getTime();
    const daysElapsed = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, GRACE_PERIOD_DAYS - daysElapsed);
    const isGracePeriodActive = daysElapsed <= GRACE_PERIOD_DAYS;
    const isRestricted = !isGracePeriodActive;

    return {
      isEmailVerified: false,
      isGracePeriodActive,
      daysRemaining,
      isRestricted,
    };
  },
};
