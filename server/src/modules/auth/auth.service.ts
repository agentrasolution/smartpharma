import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../../services/prisma";
import { config } from "../../config/env";
import { BadRequestError, UnauthorizedError } from "../../utils/errors";

const WORDS = [
  "apple", "bridge", "cloud", "dragon", "eagle", "forest", "garden",
  "harbor", "island", "jungle", "knight", "lemon", "mountain", "noble",
  "ocean", "pencil", "queen", "river", "silver", "tiger", "umbrella",
  "valley", "whale", "xenon", "yellow", "zebra", "amber", "bloom",
  "coral", "dawn", "ember", "frost", "glow", "haven", "iris", "jade",
  "kite", "lunar", "mist", "nova", "orbit", "pearl", "ridge", "stone",
  "thaw", "unity", "vivid", "wind", "azure", "berry",
];

function generateRecoveryPhrase(): string {
  const bytes = crypto.randomBytes(24);
  const indices: number[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = (bytes[i * 2]! << 8 | bytes[i * 2 + 1]!) % WORDS.length;
    indices.push(idx);
  }
  return indices.map((i) => WORDS[i]!).join(" ");
}

export const authService = {
  async login(username: string, password: string) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) throw new UnauthorizedError("Invalid credentials");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedError("Invalid credentials");

    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      config.jwtSecret,
      { expiresIn: "24h" },
    );

    const refreshToken = crypto.randomUUID();
    const csrfToken = crypto.randomUUID();

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.authToken.create({
      data: {
        userId: user.id,
        accessToken,
        refreshToken,
        csrfToken,
        accessExpiresAt: expiresAt,
        refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    return {
      accessToken,
      refreshToken,
      csrfToken,
      user: { id: user.id, username: user.username, role: user.role },
    };
  },

  async verifyPassword(password: string) {
    const user = await prisma.user.findFirst({ where: { role: "admin" } });
    if (!user) return { valid: false };
    return { valid: await bcrypt.compare(password, user.passwordHash) };
  },

  async generateRecoveryKey() {
    await prisma.recoveryKey.updateMany({
      where: { usedAt: null },
      data: { usedAt: new Date() },
    });

    const phrase = generateRecoveryPhrase();
    const normalized = phrase.trim().toLowerCase().replace(/\s+/g, " ");
    const keyHash = await bcrypt.hash(normalized, 10);

    await prisma.recoveryKey.create({
      data: { keyHash },
    });

    return { phrase };
  },

  async recoverPassword(phrase: string, newPassword: string) {
    const normalized = phrase.trim().toLowerCase().replace(/\s+/g, " ");
    const keys = await prisma.recoveryKey.findMany({ where: { usedAt: null } });

    let matchedKey: typeof keys[0] | null = null;
    for (const key of keys) {
      const valid = await bcrypt.compare(normalized, key.keyHash);
      if (valid) {
        matchedKey = key;
        break;
      }
    }

    if (!matchedKey) throw new BadRequestError("Invalid recovery key");

    const user = await prisma.user.findFirst({ where: { role: "admin" } });
    if (!user) throw new BadRequestError("No admin user found");

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.recoveryKey.update({ where: { id: matchedKey.id }, data: { usedAt: new Date() } }),
      prisma.authToken.deleteMany({ where: { userId: user.id } }),
    ]);

    return { success: true };
  },

  async refresh(refreshToken: string) {
    const token = await prisma.authToken.findUnique({
      where: { refreshToken },
      include: { user: true },
    });

    if (!token || token.refreshExpiresAt < new Date()) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }

    const newAccessToken = jwt.sign(
      { userId: token.user.id, username: token.user.username, role: token.user.role },
      config.jwtSecret,
      { expiresIn: "24h" },
    );

    const newCsrfToken = crypto.randomUUID();
    const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.authToken.update({
      where: { id: token.id },
      data: { accessToken: newAccessToken, csrfToken: newCsrfToken, accessExpiresAt: newExpiresAt },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: token.refreshToken,
      csrfToken: newCsrfToken,
      user: { id: token.user.id, username: token.user.username, role: token.user.role },
    };
  },

  async logout(accessToken: string) {
    await prisma.authToken.deleteMany({ where: { accessToken } });
    return { success: true };
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedError("User not found");
    return { id: user.id, username: user.username, role: user.role };
  },
};
