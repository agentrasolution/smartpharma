import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.user.findFirst({ where: { role: "admin" } });
  if (existing) {
    console.log("Admin user already exists, skipping seed");
    return;
  }

  const passwordHash = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      username: "admin",
      passwordHash,
      role: "admin",
    },
  });

  console.log("Seeded admin user (username: admin, password: admin123)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
