import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { prisma } from "../../services/prisma";
import { config } from "../../config/env";
import { BadRequestError, UnauthorizedError } from "../../utils/errors";
import { validatePassword, PASSWORD_MIN_LENGTH } from "../../utils/password";
import { serializeUser, userWithRoleInclude } from "../../utils/user";
import { DEFAULT_ROLES } from "../../constants/permissions";

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

async function signTokens(user: { id: string; username: string; role: string }) {
  const accessToken = jwt.sign(
    { userId: user.id, username: user.username, role: user.role, jti: crypto.randomUUID() },
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

  return { accessToken, refreshToken, csrfToken };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const authService = {
  async login(username: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { username },
      include: userWithRoleInclude,
    });
    if (!user) throw new UnauthorizedError("Invalid credentials");
    if (!user.isActive) {
      throw new UnauthorizedError("Your account has been deactivated. Contact your administrator.");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedError("Invalid credentials");

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await signTokens(user);

    return {
      ...tokens,
      user: serializeUser({ ...user, lastLoginAt: new Date() }),
    };
  },

  /**
   * Self-service registration of a new pharmacy (tenant): creates the
   * pharmacy, a trial subscription, the main branch, default roles and the
   * super-admin account, then signs the new admin in.
   */
  async register(input: {
    pharmacyName: string;
    contact?: string;
    phone?: string;
    email?: string;
    address?: string;
    name: string;
    username: string;
    password: string;
  }) {
    const pharmacyName = input.pharmacyName.trim().replace(/\s+/g, " ");
    if (!pharmacyName) throw new BadRequestError("Pharmacy name is required");

    const passwordError = validatePassword(input.password);
    if (passwordError) throw new BadRequestError(passwordError);

    const [existingPharmacy, existingUsername] = await Promise.all([
      prisma.pharmacy.findUnique({ where: { name: pharmacyName } }),
      prisma.user.findUnique({ where: { username: input.username } }),
    ]);
    if (existingPharmacy) throw new BadRequestError("A pharmacy with this name is already registered");
    if (existingUsername) throw new BadRequestError("Username is already taken");

    const baseSlug = slugify(pharmacyName) || "pharmacy";
    let slug = baseSlug;
    for (let i = 1; ; i++) {
      const clash = await prisma.pharmacy.findUnique({ where: { slug } });
      if (!clash) break;
      slug = `${baseSlug}-${i}`;
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const renewsAt = new Date(Date.now() + config.subscription.trialDays * 24 * 60 * 60 * 1000);

    const pharmacy = await prisma.$transaction(async (tx) => {
      const created = await tx.pharmacy.create({
        data: {
          name: pharmacyName,
          slug,
          contact: input.contact ?? "",
          phone: input.phone ?? "",
          email: input.email ?? "",
          address: input.address ?? "",
          subscription: {
            create: {
              plan: config.subscription.plan,
              price: config.subscription.monthlyPrice,
              status: "trial",
              startedAt: new Date(),
              renewsAt,
            },
          },
          branches: {
            create: { name: "Main Branch" },
          },
        },
        include: { branches: true },
      });

      const adminRoleName = "Admin";
      for (const role of DEFAULT_ROLES) {
        const permissionNames = Array.from(new Set(role.permissions));
        await tx.role.create({
          data: {
            name: role.name,
            description: role.description,
            pharmacyId: created.id,
            permissions: {
              create: permissionNames.map((permissionName) => ({
                permission: { connect: { name: permissionName } },
              })),
            },
          },
        });
      }

      const adminRole = await tx.role.findFirst({
        where: { name: adminRoleName, pharmacyId: created.id },
      });
      if (!adminRole) throw new Error("Failed to create the Admin role");

      await tx.user.create({
        data: {
          pharmacyId: created.id,
          username: input.username,
          name: input.name || input.username,
          phone: input.phone ?? "",
          email: input.email ?? "",
          passwordHash,
          role: "admin",
          roleId: adminRole.id,
          branchId: created.branches[0]!.id,
          jobRole: "admin",
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          isActive: true,
        },
      });

      return created;
    });

    const user = await prisma.user.findUnique({
      where: { username: input.username },
      include: userWithRoleInclude,
    });
    if (!user) throw new Error("Registration failed");

    const tokens = await signTokens(user);
    return { ...tokens, user: serializeUser(user) };
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedError("User not found");

    const currentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentValid) throw new BadRequestError("Current password is incorrect");

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      throw new BadRequestError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestError("New password must be different from the current password");
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) throw new BadRequestError(passwordError);

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
        },
      }),
      prisma.authToken.deleteMany({ where: { userId: user.id } }),
    ]);

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      include: userWithRoleInclude,
    });
    if (!updated) throw new UnauthorizedError("User not found");

    // Re-authenticate so every device/session uses the new credentials.
    const tokens = await signTokens(updated);
    return { ...tokens, user: serializeUser(updated), success: true };
  },

  /**
   * Verifies a password against any admin account within the caller's
   * pharmacy. Used as a re-auth gate for sensitive destructive actions.
   */
  async verifyPassword(pharmacyId: string, password: string) {
    const user = await prisma.user.findFirst({ where: { role: "admin", pharmacyId } });
    if (!user) return { valid: false };
    return { valid: await bcrypt.compare(password, user.passwordHash) };
  },

  async generateRecoveryKey(pharmacyId: string) {
    await prisma.recoveryKey.updateMany({
      where: { pharmacyId, usedAt: null },
      data: { usedAt: new Date() },
    });

    const phrase = generateRecoveryPhrase();
    const normalized = phrase.trim().toLowerCase().replace(/\s+/g, " ");
    const keyHash = await bcrypt.hash(normalized, 10);

    await prisma.recoveryKey.create({
      data: { pharmacyId, keyHash },
    });

    return { phrase };
  },

  async recoverPassword(username: string, phrase: string, newPassword: string) {
    const normalized = phrase.trim().toLowerCase().replace(/\s+/g, " ");
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) throw new BadRequestError("Invalid recovery key");

    const keys = await prisma.recoveryKey.findMany({
      where: { pharmacyId: user.pharmacyId, usedAt: null },
    });

    let matchedKey: (typeof keys)[number] | null = null;
    for (const key of keys) {
      const valid = await bcrypt.compare(normalized, key.keyHash);
      if (valid) {
        matchedKey = key;
        break;
      }
    }

    if (!matchedKey) throw new BadRequestError("Invalid recovery key");

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      throw new BadRequestError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) throw new BadRequestError(passwordError);

    const admin = await prisma.user.findFirst({
      where: { role: "admin", pharmacyId: user.pharmacyId },
    });
    if (!admin) throw new BadRequestError("No admin user found");

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: admin.id },
        data: { passwordHash, mustChangePassword: false, passwordChangedAt: new Date() },
      }),
      prisma.recoveryKey.update({ where: { id: matchedKey.id }, data: { usedAt: new Date() } }),
      prisma.authToken.deleteMany({ where: { userId: admin.id } }),
    ]);

    return { success: true };
  },

  async refresh(refreshToken: string) {
    const token = await prisma.authToken.findUnique({
      where: { refreshToken },
      include: {
        user: { include: userWithRoleInclude },
      },
    });

    if (!token || token.refreshExpiresAt < new Date()) {
      throw new UnauthorizedError("Invalid or expired refresh token");
    }
    if (!token.user.isActive) {
      throw new UnauthorizedError("Your account has been deactivated. Contact your administrator.");
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
      user: serializeUser(token.user),
    };
  },

  async logout(accessToken: string) {
    await prisma.authToken.deleteMany({ where: { accessToken } });
    return { success: true };
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: userWithRoleInclude,
    });
    if (!user) throw new UnauthorizedError("User not found");
    if (!user.isActive) throw new UnauthorizedError("Your account has been deactivated. Contact your administrator.");
    return serializeUser(user);
  },
};