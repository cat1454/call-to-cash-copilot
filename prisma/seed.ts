import { createPrismaClient } from "../packages/db/src/client.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://call_to_cash:call_to_cash@127.0.0.1:55432/call_to_cash?schema=public";
const prisma = createPrismaClient({ databaseUrl });

function nextVietnamOccurrence(month: number, day: number, hour: number, minute: number): Date {
  const now = new Date();
  const localYear = Number(
    new Intl.DateTimeFormat("en", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric" }).format(now)
  );
  const candidate = (year: number) =>
    new Date(Date.UTC(year, month - 1, day, hour - 7, minute, 0, 0));
  const thisYear = candidate(localYear);
  return thisYear > now ? thisYear : candidate(localYear + 1);
}

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
      routeCode: "HN-SAPA-DEMO-2230",
      routeFrom: "Ha Noi",
      routeTo: "Sa Pa",
      departureAtUtc: nextVietnamOccurrence(7, 21, 22, 30),
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
      routeCode: "HN-SAPA-DEMO-2230",
      routeFrom: "Ha Noi",
      routeTo: "Sa Pa",
      departureAtUtc: nextVietnamOccurrence(7, 21, 22, 30),
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

  await prisma.tripDeparture.upsert({
    where: { publicId: "dep_danang_hanoi_demo_1900" },
    update: {
      routeCode: "DAD-HN-DEMO-1900",
      routeFrom: "Da Nang",
      routeTo: "Ha Noi",
      departureAtUtc: nextVietnamOccurrence(7, 20, 19, 0),
      departureTimezone: "Asia/Ho_Chi_Minh",
      capacity: 36,
      operationalStatus: "SCHEDULED",
      currency: "VND",
      farePerSeatMinor: 450_000,
      depositAmountMinor: 300_000,
      pricePolicyVersion: "BUS-PRICE-V1",
      refundPolicyVersion: "BUS-V1/1.0"
    },
    create: {
      publicId: "dep_danang_hanoi_demo_1900",
      routeCode: "DAD-HN-DEMO-1900",
      routeFrom: "Da Nang",
      routeTo: "Ha Noi",
      departureAtUtc: nextVietnamOccurrence(7, 20, 19, 0),
      departureTimezone: "Asia/Ho_Chi_Minh",
      capacity: 36,
      operationalStatus: "SCHEDULED",
      currency: "VND",
      farePerSeatMinor: 450_000,
      depositAmountMinor: 300_000,
      pricePolicyVersion: "BUS-PRICE-V1",
      refundPolicyVersion: "BUS-V1/1.0"
    }
  });
} finally {
  await prisma.$disconnect();
}
