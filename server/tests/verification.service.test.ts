import { describe, expect, it } from "vitest";
import {
  generate6DigitOtp,
  hashOtp,
  verificationService,
} from "../src/services/verification.service";

describe("verification service & grace period logic", () => {
  it("generates a 6-digit numeric string within 100000 - 999999", () => {
    for (let i = 0; i < 50; i++) {
      const otp = generate6DigitOtp();
      expect(otp).toHaveLength(6);
      const num = parseInt(otp, 10);
      expect(num).toBeGreaterThanOrEqual(100000);
      expect(num).toBeLessThanOrEqual(999999);
    }
  });

  it("hashes OTP consistently using SHA-256", () => {
    const code = "123456";
    const hash1 = hashOtp(code);
    const hash2 = hashOtp(" 123456 "); // whitespace trimmed
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex length
    expect(hash1).not.toBe(hashOtp("123457"));
  });

  describe("getGracePeriodStatus", () => {
    it("returns active and non-restricted when pharmacy is already verified", () => {
      const createdAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const status = verificationService.getGracePeriodStatus(createdAt, true);
      expect(status.isEmailVerified).toBe(true);
      expect(status.isRestricted).toBe(false);
      expect(status.isGracePeriodActive).toBe(false);
    });

    it("returns active grace period with correct days remaining for freshly created pharmacy", () => {
      const now = new Date();
      const status = verificationService.getGracePeriodStatus(now, false);
      expect(status.isEmailVerified).toBe(false);
      expect(status.isGracePeriodActive).toBe(true);
      expect(status.daysRemaining).toBe(7);
      expect(status.isRestricted).toBe(false);
    });

    it("returns correct days remaining for pharmacy created 3 days ago", () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const status = verificationService.getGracePeriodStatus(threeDaysAgo, false);
      expect(status.isEmailVerified).toBe(false);
      expect(status.isGracePeriodActive).toBe(true);
      expect(status.daysRemaining).toBe(4);
      expect(status.isRestricted).toBe(false);
    });

    it("marks as restricted when grace period of 7 days has expired", () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const status = verificationService.getGracePeriodStatus(eightDaysAgo, false);
      expect(status.isEmailVerified).toBe(false);
      expect(status.isGracePeriodActive).toBe(false);
      expect(status.daysRemaining).toBe(0);
      expect(status.isRestricted).toBe(true);
    });
  });
});
