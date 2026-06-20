import { createPrismaClient } from "../packages/db/src/client.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://call_to_cash:call_to_cash@127.0.0.1:55432/call_to_cash?schema=public";
const prisma = createPrismaClient({ databaseUrl });

try {
  await prisma.user.upsert({
    where: { publicId: "usr_provider_demo" },
    update: {
      role: "PROVIDER_ADMIN",
      displayName: "Demo Bus Provider"
    },
    create: {
      publicId: "usr_provider_demo",
      role: "PROVIDER_ADMIN",
      displayName: "Demo Bus Provider"
    }
  });

  await prisma.tripDeparture.upsert({
    where: { publicId: "dep_hn_sapa_20260620_2230" },
    update: {
      routeCode: "HN-SAPA-20260620-2230",
      routeFrom: "Ha Noi",
      routeTo: "Sa Pa",
      departureAtUtc: new Date("2026-06-20T15:30:00.000Z"),
      departureTimezone: "Asia/Ho_Chi_Minh",
      capacity: 36,
      operationalStatus: "SCHEDULED",
      currency: "VND",
      farePerSeatMinor: 300_000,
      depositAmountMinor: 300_000,
      pricePolicyVersion: "BUS-PRICE-V1",
      refundPolicyVersion: "BUS-V1/1.0"
    },
    create: {
      publicId: "dep_hn_sapa_20260620_2230",
      routeCode: "HN-SAPA-20260620-2230",
      routeFrom: "Ha Noi",
      routeTo: "Sa Pa",
      departureAtUtc: new Date("2026-06-20T15:30:00.000Z"),
      departureTimezone: "Asia/Ho_Chi_Minh",
      capacity: 36,
      operationalStatus: "SCHEDULED",
      currency: "VND",
      farePerSeatMinor: 300_000,
      depositAmountMinor: 300_000,
      pricePolicyVersion: "BUS-PRICE-V1",
      refundPolicyVersion: "BUS-V1/1.0"
    }
  });
} finally {
  await prisma.$disconnect();
}
